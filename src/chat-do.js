/**
 * 聊天 Durable Object（ChatDO）：每个会话一个实例，负责上下文与模型调用。
 *
 * QQBotDO 只管 QQ 收发和工具；上下文、分层记忆压缩、按优先级调 AI（含识图过滤、
 * 重试、故障转移）都在这里。同一会话天然串行，慢请求（带图 180s）不卡别的群。
 *
 * 分层记忆三层：
 *   messages   最近 N 条原文（短期）      —— 逐字保真，负责当前话题
 *   summary    滚动摘要 ≤1500 字（中期）  —— 覆盖已滚出的历史
 *   facts      结构化长期事实（长期）      —— 按槽位覆盖更新，负责「这个人是谁」
 *
 * 每累积 20 条才压缩一次；压缩失败一律回滚，宁可这轮不压，也不能丢消息却没摘要。
 */
import { withRetry } from './utils/retry.js';
import { providerSupportsVision } from './utils/vision.js';

const PREFIX = 'chat:';
const MAX_KEYS = 500;

/** 摘要字数上限：够记下很长的脉络 */
const SUMMARY_MAX = 20000;
/** 长期事实条数上限，超出时淘汰最旧的 */
const FACTS_MAX = 40;
/** 单条事实长度上限：有的项目描述很长，给足空间 */
const FACT_MAX_LEN = 400;
/** 每累积多少「条消息」才允许触发一次压缩（按消息数算比按轮数稳） */
const COMPRESS_EVERY = 20;
/**
 * 压缩的「最低水位」：消息数超过 limit 的这么多倍才压。
 *
 * 为什么需要：原来只要超过 limit 就压，等于每轮对话都要调 2 次 AI（摘要 + 事实），
 * token 消耗是对话本身的 2~3 倍。实际不需要这么勤——多留一些原文反而更准，
 * 摘要压缩本质是「省 token」，太频繁就本末倒置了。
 * 设成 3 倍：limit=10 时攒到 30 条才压，压缩频率降到原来的 1/3。
 */
const COMPRESS_WATERMARK = 3;
/** 压缩冷却时间：两次压缩至少间隔这么久，防止短时间狂聊时被反复触发 */
const COMPRESS_COOLDOWN_MS = 10 * 60 * 1000;
/** 最近消息层的字符预算：一条贴进来的长文就能顶几十轮，光看条数会撑爆上下文 */
const HISTORY_CHAR_BUDGET = 12000;
/** 长期事实注入时的字符预算：事实长了也不能无脑全塞进每次请求 */
const FACTS_CHAR_BUDGET = 4000;

/**
 * 长期事实的「槽位」。
 *
 * 为什么需要：事实是随时会被推翻的（"在杭州" → "搬到上海了"）。
 * 没有槽位就是两条并存，模型每次看到都要自己猜哪个有效。
 * 有槽位就能「后者替换前者」，同一个槽位永远只有一条最新值。
 */
const FACT_SLOTS = ['name', 'city', 'job', 'stack', 'project', 'like', 'dislike', 'date', 'other'];

/** AI 输出的「槽位|内容」或「槽位：内容」格式 */
const FACT_SLOT_RE = /^([a-z_]{2,12})\s*[|｜:：]\s*(.+)$/i;

const SUMMARY_PROMPT =
  '把这段聊天记录压成简洁的中文摘要，保留：重要事实、用户偏好、正在做的事、未完成的约定。' +
  '不要客套话，不要复述寒暄。用分号分隔要点，总长不超过 300 字。';

const FACTS_PROMPT =
  '从这段聊天记录里抽取**值得长期记住的客观事实**，每行一条，最多 5 条。\n' +
  '格式固定为「槽位|内容」，槽位只能从这些里选：\n' +
  '  name=姓名或称呼, city=城市或所在地, job=职业或身份, stack=技术栈偏好,\n' +
  '  project=长期项目, like=明确喜欢的东西, dislike=明确讨厌的东西, date=重要日期, other=其它稳定信息\n' +
  '例子：name|用户叫小王；city|用户在杭州；dislike|讨厌 Java。\n' +
  '只抽稳定信息，不要抽一次性的问题、闲聊内容、临时情绪。没有值得记的就只输出「无」。';

/**
 * 解析「一次性产出摘要 + 事实」的合并回复。
 * 格式不对时尽量兜底：整段当摘要，事实留空（摘要才是主线）。
 */
function splitSummaryAndFacts(raw) {
  const s = String(raw || '').trim();
  if (!s) return { summary: '', facts: '' };

  const mSum = s.match(/===SUMMARY===\s*([\s\S]*?)(?====FACTS===|$)/i);
  const mFacts = s.match(/===FACTS===\s*([\s\S]*)$/i);

  if (mSum || mFacts) {
    return {
      summary: (mSum ? mSum[1] : '').trim(),
      facts: (mFacts ? mFacts[1] : '').trim(),
    };
  }

  // 模型没按格式走：整段当摘要，事实靠下面的启发式兜一下
  return { summary: s, facts: '' };
}

/** 归一化：去多余空白与常见标点差异，用于判重 */
function normFact(s) {
  return String(s || '')
    .replace(/\s+/g, '')
    .replace(/[，。；、！？,.;!?]/g, '')
    .trim();
}

/**
 * 解析 AI 抽出来的一行事实。
 * 兼容两种：带槽位的「city|用户在杭州」、不带槽位的历史格式「用户在杭州」。
 * 只有显式带槽位才参与「同槽位替换」；裸文本按老办法判重追加，
 * 否则像「事实编号1」「事实编号2」这种会被错误地当成同一条而互相覆盖。
 */
function parseFactLine(line) {
  const raw = String(line || '').replace(/^[-*•\d.\s]+/, '').trim();
  if (!raw || raw === '无') return null;
  const m = raw.match(FACT_SLOT_RE);
  if (m) {
    const slot = m[1].toLowerCase();
    const text = m[2].trim();
    if (text && FACT_SLOTS.includes(slot)) return { slot, text };
    // 槽位不认识就整行当内容，别把「姓名：小王」里的「姓名」切掉
  }
  if (raw.length > FACT_MAX_LEN) return null;
  return { slot: '', text: raw };
}

/**
 * 把旧摘要压到 n 字：保留开头和结尾，砍中间。
 *
 * 为什么不是只留开头：「开头」是最早的话题，最新丢失的信息反而在尾部。
 * 中间通常是过程细节，砍掉损失最小。
 */
function compactOldSummary(s, n) {
  const str = String(s || '');
  if (str.length <= n) return str;
  if (n <= 4) return str.slice(0, Math.max(0, n));
  const head = Math.ceil((n - 1) * 0.5);
  const tail = n - 1 - head;
  return str.slice(0, head) + '…' + (tail > 0 ? str.slice(-tail) : '');
}

export class ChatDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.cache = new Map();
    this.logger = {
      info: (...args) => console.log('[ChatDO]', ...args),
      warn: (...args) => console.warn('[ChatDO]', ...args),
      error: (...args) => console.error('[ChatDO]', ...args),
    };
  }

  async load(key) {
    if (this.cache.has(key)) return this.cache.get(key);
    const stored = await this.state.storage.get(PREFIX + key);
    const session =
      stored && typeof stored === 'object'
        ? {
            messages: Array.isArray(stored.messages) ? stored.messages : [],
            summary: String(stored.summary || ''),
            facts: Array.isArray(stored.facts) ? stored.facts : [],
            sinceCompress: Number(stored.sinceCompress) || 0,
            lastCompressAt: Number(stored.lastCompressAt) || 0,
            lastUsed: stored.lastUsed || Date.now(),
          }
        : {
            messages: [],
            summary: '',
            facts: [],
            sinceCompress: 0,
            lastCompressAt: 0,
            lastUsed: Date.now(),
          };
    this.cache.set(key, session);
    return session;
  }

  async save(key, session) {
    session.lastUsed = Date.now();
    // DO 单个值上限约 128KB。摘要放宽到 2 万字后，单是摘要就可能占 60KB，
    // 真撞上限时按「先裁 messages，再压缩摘要，最后才动 facts」的顺序腾地方 ——
    // facts 是最贵的信息（要跨几十轮才能重新学到），宁可少留原文也不能丢。
    const byteLen = () => JSON.stringify(session).length;
    if (byteLen() > 110000) {
      while (session.messages.length > 2 && byteLen() > 110000) {
        session.messages.shift();
      }
    }
    if (byteLen() > 110000 && session.summary && session.summary.length > 2000) {
      // 摘要还在超：留头留尾砍中间，保住最早的人设和最新进展
      session.summary = compactOldSummary(session.summary, Math.max(2000, Math.floor(session.summary.length / 2)));
    }
    this.cache.set(key, session);
    await this.state.storage.put(PREFIX + key, session);
  }

  /**
   * 是否该压缩了。
   *
   * 三个条件同时满足才压，任何一条不满足就继续攒原文：
   *   1. 消息数超过「limit × 水位」—— 光超 limit 一点不急着压，多留原文更准
   *   2. 距上次压缩满 20 条 —— 压缩是调 2 次 AI 的贵操作，不能每轮都来
   *   3. 距上次压缩过了冷却期 —— 防止短时间狂聊被反复触发
   *
   * 例外：消息数超过 limit 的 10 倍时无条件压，避免上下文无限膨胀。
   */
  shouldCompress(session, limit, now = Date.now()) {
    const over = session.messages.length - limit;
    if (over <= 0) return false;

    // 极端情况兜底：涨到 10 倍必须压，否则迟早撑爆上下文
    if (session.messages.length > limit * 10) return true;

    if (over < limit * (COMPRESS_WATERMARK - 1)) return false;
    if ((session.sinceCompress || 0) < COMPRESS_EVERY) return false;

    const last = Number(session.lastCompressAt) || 0;
    if (last && now - last < COMPRESS_COOLDOWN_MS) return false;

    return true;
  }

  /**
   * 把 messages 里超出 limit 的部分滚进 summary / facts。
   *
   * 关键约束：**只有压缩成功才真正移除旧消息**。
   * 原实现先 splice 再异步生成摘要，一旦摘要失败，那批消息就永久没了。
   * 现在改成：先算要滚出的部分 → 生成摘要/事实 → 成功后才 splice + 落盘。
   */
  async compress(key, session, limit, provider) {
    const over = session.messages.length - limit;
    if (over <= 0) return { compressed: 0 };

    const old = session.messages.slice(0, over);
    if (!old.length) return { compressed: 0 };

    const text = old
      .map((m) => {
        const role = m.role === 'user' ? '用户' : '助手';
        const body = typeof m.content === 'string' ? m.content : '[图片]';
        return `${role}：${body}`;
      })
      .join('\n')
      .slice(0, 6000);

    if (!provider) return { compressed: 0, reason: 'no-provider' };

    try {
      // 一次调用同时拿摘要和事实：把两份指令合成一个请求。
      // 原来并行发两次请求，同样的聊天记录要付两遍 input token；
      // 合成一次后 input 只算一份，输出也就多几十个字，综合更省。
      const combined = await this.chatOnce(provider, [
        {
          role: 'system',
          content:
            '你在整理聊天记录，需要同时产出两样东西。严格按下面的格式输出，不要任何多余文字：\n\n' +
            '===SUMMARY===\n' +
            '<中文摘要，保留重要事实、用户偏好、正在做的事、未完成的约定，不要客套话，不超过 300 字>\n' +
            '===FACTS===\n' +
            '<每行一条长期事实，格式「槽位|内容」，最多 5 条；没有就写「无」>\n\n' +
            '槽位只能从这些里选：\n' +
            'name=姓名或称呼, city=城市或所在地, job=职业或身份, stack=技术栈偏好, project=长期项目, ' +
            'like=明确喜欢的东西, dislike=明确讨厌的东西, date=重要日期, other=其它稳定信息\n' +
            '只抽稳定的客观信息，不要抽一次性问题、闲聊、临时情绪。',
        },
        { role: 'user', content: text },
      ]);

      const parsedOut = splitSummaryAndFacts(combined);
      const newSummary = parsedOut.summary;
      const newFacts = parsedOut.facts;

      if (!newSummary) throw new Error('摘要为空');

      // 摘要：旧摘要 + 新摘要。超长时旧摘要「留头留尾、砍中间」，
      // 不能只截开头——最新发生的事在尾部，砍掉尾部等于把刚聊的丢了。
      if (newSummary) {
        const merged = [session.summary, newSummary].filter(Boolean).join('；');
        if (merged.length <= SUMMARY_MAX) {
          session.summary = merged;
        } else {
          const room = Math.max(0, SUMMARY_MAX - newSummary.length - 1);
          session.summary = [compactOldSummary(session.summary, room), newSummary]
            .filter(Boolean)
            .join('；');
        }
      }

      // 长期事实：解析成结构化条目，按槽位覆盖写回
      if (newFacts) {
        const parsed = newFacts
          .split('\n')
          .map(parseFactLine)
          .filter(Boolean);
        this.mergeFacts(session, parsed);
      }

      // 到这里才算成功：真正移除旧消息
      session.messages.splice(0, over);
      session.sinceCompress = 0;
      session.lastCompressAt = Date.now();
      await this.save(key, session);
      this.logger.info(
        `compressed ${over} msgs → summary=${session.summary.length}字, facts=${session.facts.length}条`
      );
      return { compressed: over };
    } catch (e) {
      // 失败：消息原样保留，等下次再试
      this.logger.warn(`compress failed (kept ${over} msgs): ${e.message}`);
      return { compressed: 0, error: e.message };
    }
  }

  /**
   * 把新事实合并进 session.facts。
   *
   * 两条规则：
   *   1. 带槽位的事实 → 覆盖同槽位的旧值（"在杭州" 被 "搬到上海了" 换掉），
   *      这样模型看到的信息永远是当前有效的，不用自己判断哪条更新。
   *   2. 不带槽位的裸文本 → 精确判重后追加（兼容老数据与手工写入）。
   *
   * 判重必须精确比对，不能用 includes：否则「编号1」会被「编号10」吞掉。
   */
  mergeFacts(session, parsed) {
    if (!Array.isArray(parsed) || !parsed.length) return;
    if (!Array.isArray(session.facts)) session.facts = [];
    const now = Date.now();

    for (const f of parsed) {
      const text = String(f.text || '').trim();
      if (!text) continue;
      const slot = String(f.slot || '');

      if (slot) {
        // 同槽位：就地替换，保留这一条的位置（不排到末尾），
        // 否则「最近更新」的顺序会被打乱，超限淘汰时容易先把别的新事实挤掉。
        const idx = session.facts.findIndex((x) => x && x.slot === slot);
        if (idx >= 0) {
          if (normFact(session.facts[idx].text) !== normFact(text)) {
            session.facts[idx] = { ...session.facts[idx], text, at: now };
          } else {
            // 内容没变，只更新时间，不需要重复写
            session.facts[idx].at = now;
          }
        } else {
          session.facts.push({ slot, text, at: now });
        }
        continue;
      }

      // 无槽位：精确判重后追加
      const nf = normFact(text);
      const exists = session.facts.some((x) => x && !x.slot && normFact(x.text) === nf);
      if (!exists) session.facts.push({ text, at: now });
    }

    if (session.facts.length > FACTS_MAX) {
      // 淘汰最旧的：数组本身就是写入顺序（push 追加），直接保留末尾 N 条即最新。
      // 不能按 at 排序 —— 同一毫秒内连续写入时 at 全相同，排序结果不确定，
      // 会把刚写进去的新事实当成旧的淘汰掉。
      session.facts = session.facts.slice(-FACTS_MAX);
    }
  }

  async chatOnce(provider, messages, { timeout = 60000 } = {}) {
    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
      body: JSON.stringify({ model: provider.model, messages, temperature: 0.3 }),
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return String(data.choices?.[0]?.message?.content || '').trim();
  }

  /** 一轮对话：追加用户消息 → 调模型（按优先级 + 重试）→ 返回回复 */
  async chat(body) {
    const key = String(body.key || '').slice(0, 200);
    if (!key) return { error: 'missing key' };
    const providers = Array.isArray(body.providers) ? body.providers : [];
    if (!providers.length) return { error: '没有可用的 AI' };

    const session = await this.load(key);
    const limit = Math.max(2, Number(body.historyLimit) || 10);
    const hasImage = typeof body.image === 'string' && body.image.startsWith('data:');
    const content = String(body.content || '');

    const userMessage = hasImage
      ? {
          role: 'user',
          content: [
            { type: 'text', text: content || '看看这张图' },
            { type: 'image_url', image_url: { url: body.image } },
          ],
        }
      : { role: 'user', content };

    // 落盘只存文本（data URI 可能几 MB，超过 DO 单值上限），图片只拼进本次请求
    const storedUser = hasImage
      ? { role: 'user', content: content ? `${content}\n[图片]` : '[图片]' }
      : userMessage;
    session.messages.push(storedUser);
    await this.save(key, session);

    // 带图：只交给支持识图的模型
    let usable = providers;
    if (hasImage) {
      usable = providers.filter((p) => providerSupportsVision(p));
      if (!usable.length) {
        session.messages.pop();
        await this.save(key, session);
        return { error: 'no_vision' };
      }
    }

    const msgs = this.buildMessages(session, body.systemPrompt, hasImage ? userMessage : null);

    let lastErr = null;
    for (const provider of usable) {
      try {
        const res = await withRetry(
          async () => {
            const r = await fetch(`${provider.baseUrl}/chat/completions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
              body: JSON.stringify({
                model: provider.model,
                messages: msgs,
                temperature:
                  provider.temperature === '' || provider.temperature == null
                    ? 0.8
                    : Number(provider.temperature),
              }),
              signal: AbortSignal.timeout(hasImage ? 180000 : 90000),
            });
            if (!r.ok) {
              const text = await r.text().catch(() => '');
              const err = new Error(`HTTP ${r.status}${text ? ' ' + text.slice(0, 120) : ''}`);
              err.status = r.status;
              throw err;
            }
            return r;
          },
          {
            maxAttempts: 2,
            delay: 800,
            shouldRetry: (e) =>
              !(e?.name === 'TimeoutError' || e?.name === 'AbortError') &&
              (e.status === undefined || e.status === 429 || e.status >= 500),
            onRetry: (err, attempt) => this.logger.warn(`retry ${attempt}: ${err.message}`),
          }
        );
        const data = await res.json();
        const text = String(data.choices?.[0]?.message?.content || '').trim();
        if (!text) throw new Error('AI 返回空内容');

        // 攒够（水位数 + 条数 + 冷却期）才压，避免每轮都调 2 次 AI
        session.sinceCompress = (session.sinceCompress || 0) + 1;
        if (this.shouldCompress(session, limit)) {
          await this.compress(key, session, limit, provider);
        }
        await this.save(key, session);
        return {
          text,
          provider: { id: provider.id || '', name: provider.name || '', model: provider.model || '' },
        };
      } catch (e) {
        lastErr = e;
        this.logger.warn(`${provider.name || provider.model} 失败: ${e.message}`);
      }
    }
    // 全部失败：把用户消息退回去，下次重试不会重复堆叠
    session.messages.pop();
    await this.save(key, session);
    return { error: `全部 AI 调用失败：${lastErr ? lastErr.message : '未知原因'}` };
  }

  /** 拼出送给模型的 messages：人设 + 长期事实 + 摘要 + 最近原文 */
  buildMessages(session, systemPrompt, imageMessage) {
    const out = [{ role: 'system', content: String(systemPrompt || '') }];

    // 长期事实：放在人设之后、摘要之前，让模型始终知道「这个人是谁」。
    // 带槽位的按中文标签归类，读起来像「人物档案」，比一串平铺 bullet 更省 token 也更准。
    // 事实可能很长（整段项目描述），注入时按字符预算截断，超出的宁可省略也不能每次请求都全塞。
    if (session.facts && session.facts.length) {
      const SLOT_LABEL = {
        name: '称呼',
        city: '所在地',
        job: '职业',
        stack: '技术栈',
        project: '在做的事',
        like: '喜欢',
        dislike: '讨厌',
        date: '重要日期',
        other: '其它',
      };
      const grouped = [];
      const loose = [];
      for (const f of session.facts) {
        if (!f || !f.text) continue;
        const label = SLOT_LABEL[f.slot];
        if (label) grouped.push(`${label}：${f.text}`);
        else loose.push(f.text);
      }
      // 逐条累加，超预算就停；截断的那条带上省略号，让模型知道还有更多
      const picked = [];
      let used = 0;
      for (const line of [...grouped, ...loose]) {
        const remain = FACTS_CHAR_BUDGET - used;
        if (remain <= 0) break;
        if (line.length <= remain) {
          picked.push(`- ${line}`);
          used += line.length + 3;
        } else {
          picked.push(`- ${line.slice(0, Math.max(0, remain - 8))}…`);
          used = FACTS_CHAR_BUDGET;
          break;
        }
      }
      const lines = picked.join('\n');
      out.push({
        role: 'system',
        content: `【长期记忆】关于这个用户的稳定信息（长期有效，不要反复追问）：\n${lines}`,
      });
    }

    if (session.summary) {
      out.push({ role: 'system', content: `【早前对话摘要】${session.summary}` });
    }

    // 历史里的旧图片只是占位文本，最后一轮换成本次带图的完整消息
    let history = imageMessage ? session.messages.slice(0, -1) : session.messages;

    // 字符预算裁剪：光按「条数」限制挡不住长文（一条贴进来的日志就几十 KB）。
    // 从最新往前累加，超预算就停，保证送进去的永远是最贴近当前话题的那部分。
    if (history.length) {
      let used = 0;
      let cut = 0;
      for (let i = history.length - 1; i >= 0; i--) {
        const c = history[i] && history[i].content;
        used += typeof c === 'string' ? c.length : 200; // 图片/多段内容按 200 估
        if (used > HISTORY_CHAR_BUDGET) {
          cut = i + 1;
          break;
        }
      }
      if (cut > 0) history = history.slice(cut);
    }

    out.push(...history);
    if (imageMessage) out.push(imageMessage);
    return out;
  }

  /** 记住助手这轮说了什么（工具执行结果就记一行内部记录） */
  async record(body) {
    const key = String(body.key || '').slice(0, 200);
    if (!key) return { error: 'missing key' };
    const session = await this.load(key);
    if (body.assistant) session.messages.push({ role: 'assistant', content: String(body.assistant).slice(0, 4000) });

    const limit = Math.max(2, Number(body.historyLimit) || 10);
    session.sinceCompress = (session.sinceCompress || 0) + 1;

    // 同样是「攒够才压」：record 是每次工具执行都会调的，原来只要超一点就压，
    // 等于每执行一次工具就白烧一轮压缩 token。
    if (this.shouldCompress(session, limit)) {
      const provider = Array.isArray(body.providers) ? body.providers[0] : null;
      if (provider) {
        await this.compress(key, session, limit, provider);
      } else {
        this.logger.warn(`record: ${session.messages.length - limit} msgs kept (no provider to summarize)`);
      }
    }
    await this.save(key, session);
    return { ok: true, turns: session.messages.length, facts: session.facts.length };
  }

  /**
   * 直接写入一条长期事实（不经过 AI 抽取）。
   *
   * 用途：工具执行后，把「发过什么文件、做过什么任务、定过什么提醒」这类
   * 一定会被再次问起的信息记下来。这类事实结构清晰，让 AI 再抽一遍纯属浪费 token。
   *
   * 支持传 slot（如 slot:'city'），带 slot 时走「同槽位覆盖」，
   * 不带就是普通的精确判重追加。上限控制与 compress 共用 mergeFacts。
   */
  async addFact(body) {
    const key = String(body.key || '').slice(0, 200);
    if (!key) return { error: 'missing key' };
    const text = String(body.text || '').trim().slice(0, FACT_MAX_LEN);
    if (!text) return { error: 'empty fact' };
    const slot = FACT_SLOTS.includes(String(body.slot || '').toLowerCase())
      ? String(body.slot).toLowerCase()
      : '';
    const session = await this.load(key);
    const before = (session.facts || []).length;
    const beforeText = slot ? (session.facts || []).find((x) => x && x.slot === slot)?.text : null;

    this.mergeFacts(session, [{ slot, text }]);

    const after = (session.facts || []).length;
    const nowText = slot ? (session.facts || []).find((x) => x && x.slot === slot)?.text : null;
    const changed = slot ? beforeText !== nowText : after > before;

    if (changed) await this.save(key, session);
    this.logger.info(
      `fact ${changed ? 'written' : 'skipped'}${slot ? ` [${slot}]` : ''}: ${text} (total ${after})`
    );
    return { ok: true, added: changed, slot: slot || undefined, facts: after };
  }

  /** 只读状态：给后台排查用（不能叫 state，会和 DO 的 this.state 撞名） */
  async inspect(body) {
    const key = String(body.key || '').slice(0, 200);
    if (!key) return { error: 'missing key' };
    const s = await this.load(key);
    // recent：最近几轮原文，供后台「记忆分层图」展示（只给文本）
    const recent = (s.messages || []).slice(-8).map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content.slice(0, 200) : '[图片]',
    }));
    // 带上每层的体积估算，后台能直观看到「这一层占了多少上下文」
    const historyChars = (s.messages || []).reduce(
      (n, m) => n + (typeof m.content === 'string' ? m.content.length : 200),
      0
    );
    return {
      messages: s.messages.length,
      messagesChars: historyChars,
      summaryLen: s.summary.length,
      summary: s.summary,
      facts: s.facts,
      factsSlotted: (s.facts || []).filter((f) => f && f.slot).length,
      sinceCompress: s.sinceCompress,
      recent,
    };
  }

  /** 清掉某个会话的记忆 */
  async reset(body) {
    const key = String(body.key || '').slice(0, 200);
    if (!key) return { error: 'missing key' };
    this.cache.delete(key);
    await this.state.storage.delete(PREFIX + key);
    return { ok: true };
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });
    try {
      const body = await request.json().catch(() => ({}));
      if (url.pathname === '/chat') return Response.json(await this.chat(body));
      if (url.pathname === '/record') return Response.json(await this.record(body));
      if (url.pathname === '/fact') return Response.json(await this.addFact(body));
      if (url.pathname === '/state') return Response.json(await this.inspect(body));
      if (url.pathname === '/reset') return Response.json(await this.reset(body));
      return new Response('not found', { status: 404 });
    } catch (e) {
      this.logger.error(`fetch error: ${e && e.message}`);
      return Response.json({ error: String((e && e.message) || e) }, { status: 500 });
    }
  }
}
