/**
 * 聊天 Durable Object（ChatDO）：把「会话历史 + 模型调用」从机器人 DO 里拆出来。
 *
 * - 机器人 DO（QQBotDO）只负责 QQ 网关收发、工具执行；
 * - 这里负责每个会话的上下文、分层记忆压缩、按优先级调用 AI（含识图过滤、重试、故障转移）。
 *
 * 每个会话一个实例（idFromName(conversationKey)），天然串行处理同一会话的请求，
 * 慢请求（带图 180s）不会卡住别的群。
 *
 * ============================ 分层记忆设计 ============================
 *
 * 只靠「保留最近 N 条 + 一段摘要」在长期使用下会持续丢信息：
 *   - 摘要被反复拼接后截断到 400 字，聊几百轮就装不下了
 *   - record() 直接 splice 丢弃，那部分内容根本没进摘要
 *   - 摘要生成失败时消息已被切走，等于永久丢失
 *
 * 现在改成三层，各司其职：
 *
 *   messages   最近 N 条原文（短期）      —— 逐字保真，负责当前话题
 *   summary    滚动摘要 ≤1500 字（中期）  —— 覆盖已滚出的历史，负责近期脉络
 *   facts      结构化长期事实（长期）      —— 只增不减，负责「这个人是谁、在意什么」
 *
 * 压缩时机：每累积 10 轮（20 条）才触发一次，避免每条消息都调模型压一次。
 * 失败一律回滚：宁可这轮不压，也不能把消息丢了却没生成摘要。
 */
import { withRetry } from './utils/retry.js';
import { providerSupportsVision } from './utils/vision.js';

const PREFIX = 'chat:';
const MAX_KEYS = 500;

/** 摘要字数上限。比原来的 400 宽裕很多，能装下较长脉络 */
const SUMMARY_MAX = 1500;
/** 长期事实条数上限，超出时淘汰最旧的 */
const FACTS_MAX = 40;
/** 单条事实长度上限 */
const FACT_MAX_LEN = 120;
/** 每累积多少「条消息」触发一次压缩（10 轮 ≈ 20 条，按消息数算更稳） */
const COMPRESS_EVERY = 20;

const SUMMARY_PROMPT =
  '把这段聊天记录压成简洁的中文摘要，保留：重要事实、用户偏好、正在做的事、未完成的约定。' +
  '不要客套话，不要复述寒暄。用分号分隔要点，总长不超过 300 字。';

const FACTS_PROMPT =
  '从这段聊天记录里抽取**值得长期记住的客观事实**，每行一条，用「- 」开头，最多 5 条。\n' +
  '只抽稳定信息：姓名/称呼、所在城市、职业或身份、技术栈偏好、长期项目、明确的好恶、重要日期。\n' +
  '不要抽一次性的问题、闲聊内容、临时情绪。没有值得记的就只输出「无」。';

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
            lastUsed: stored.lastUsed || Date.now(),
          }
        : { messages: [], summary: '', facts: [], sinceCompress: 0, lastUsed: Date.now() };
    this.cache.set(key, session);
    return session;
  }

  async save(key, session) {
    session.lastUsed = Date.now();
    // DO 单个值上限约 128KB：真超了就只裁 messages，summary/facts 必须保住
    if (JSON.stringify(session).length > 100000) {
      while (session.messages.length > 2 && JSON.stringify(session).length > 100000) {
        session.messages.shift();
      }
    }
    this.cache.set(key, session);
    await this.state.storage.put(PREFIX + key, session);
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
      // 并行拿「新摘要」和「新事实」。
      // ⚠ 这里**不能**给每个调用加 .catch(() => '')：那会让「AI 全挂」看起来像成功，
      // 然后照样 splice 掉旧消息 —— 消息没了、摘要也没有，正是要避免的记忆丢失。
      // 正确做法：任何一路抛错都让整个 compress 失败，消息原样保留。
      const [newSummary, newFacts] = await Promise.all([
        this.chatOnce(provider, [
          { role: 'system', content: SUMMARY_PROMPT },
          { role: 'user', content: text },
        ]),
        this.chatOnce(provider, [
          { role: 'system', content: FACTS_PROMPT },
          { role: 'user', content: text },
        ]).catch(() => ''), // 事实抽取失败可以容忍（摘要才是主线），但摘要必须成功
      ]);

      if (!newSummary) throw new Error('摘要为空');

      // 摘要：旧摘要 + 新摘要，超长时**保留旧摘要前半 + 新摘要**，
      // 而不是从末尾截断（末尾才是最新内容，砍末尾等于丢掉刚发生的事）
      if (newSummary) {
        const merged = [session.summary, newSummary].filter(Boolean).join('；');
        if (merged.length <= SUMMARY_MAX) {
          session.summary = merged;
        } else {
          const keepOld = Math.max(0, SUMMARY_MAX - newSummary.length - 1);
          session.summary = [session.summary.slice(0, keepOld), newSummary].filter(Boolean).join('；');
        }
      }

      // 长期事实：解析成结构化条目，去重后追加
      if (newFacts) {
        const parsed = newFacts
          .split('\n')
          .map((l) => l.replace(/^[-*•\d.\s]+/, '').trim())
          .filter((l) => l && l !== '无' && l.length <= FACT_MAX_LEN);
        for (const f of parsed) {
          // 精确比对，不用 includes（否则「编号1」会被「编号10」误判为重复）
          const nf = f.replace(/\s+/g, '');
          const exists = session.facts.some((x) => String(x.text).replace(/\s+/g, '') === nf);
          if (!exists) session.facts.push({ text: f, at: Date.now() });
        }
        // 超出上限时淘汰最旧的
        if (session.facts.length > FACTS_MAX) {
          session.facts = session.facts.slice(-FACTS_MAX);
        }
      }

      // 到这里才算成功：真正移除旧消息
      session.messages.splice(0, over);
      session.sinceCompress = 0;
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

        // 每累积 COMPRESS_EVERY 条才压一次，避免每条消息都调模型
        session.sinceCompress = (session.sinceCompress || 0) + 1;
        if (session.messages.length > limit && session.sinceCompress >= COMPRESS_EVERY) {
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

    // 长期事实：放在人设之后、摘要之前，让模型始终知道「这个人是谁」
    if (session.facts && session.facts.length) {
      out.push({
        role: 'system',
        content: `【长期记忆】关于这个用户的稳定信息（长期有效，不要反复追问）：\n${session.facts
          .map((f) => `- ${f.text}`)
          .join('\n')}`,
      });
    }

    if (session.summary) {
      out.push({ role: 'system', content: `【早前对话摘要】${session.summary}` });
    }

    // 历史里的旧图片只是占位文本，最后一轮换成本次带图的完整消息
    const history = imageMessage ? session.messages.slice(0, -1) : session.messages;
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

    // 原来这里直接 splice 丢弃，丢的内容永远进不了摘要。
    // 现在走同一套压缩：有 provider 就压，没 provider 就宁可不裁。
    if (session.messages.length > limit) {
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
   * 仍然做去重与上限控制，避免长期使用后无限膨胀。
   */
  async addFact(body) {
    const key = String(body.key || '').slice(0, 200);
    if (!key) return { error: 'missing key' };
    const text = String(body.text || '').trim().slice(0, FACT_MAX_LEN);
    if (!text) return { error: 'empty fact' };
    const session = await this.load(key);
    // 去重必须**精确比对**，不能用 includes：
    // 「事实编号1」是「事实编号10」的子串，宽松匹配会把正常事实误判成重复丢掉。
    const norm = (s) => String(s || '').replace(/\s+/g, '').trim();
    const exists = session.facts.some((x) => norm(x.text) === norm(text));
    if (!exists) {
      session.facts.push({ text, at: Date.now() });
      if (session.facts.length > FACTS_MAX) session.facts = session.facts.slice(-FACTS_MAX);
      await this.save(key, session);
      this.logger.info(`fact added: ${text} (total ${session.facts.length})`);
    }
    return { ok: true, added: !exists, facts: session.facts.length };
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
    return {
      messages: s.messages.length,
      summaryLen: s.summary.length,
      summary: s.summary,
      facts: s.facts,
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
