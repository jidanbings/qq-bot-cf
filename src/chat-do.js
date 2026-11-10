import { withRetry } from './utils/retry.js';
import { providerSupportsVision } from './utils/vision.js';
import { providerChat } from './utils/workers-ai.js';

const PREFIX = 'chat:';
const MAX_KEYS = 500;

const SUMMARY_MAX = 20000;
const FACTS_MAX = 40;
const FACT_MAX_LEN = 400;
const COMPRESS_EVERY = 20;
const COMPRESS_WATERMARK = 3;
const COMPRESS_COOLDOWN_MS = 10 * 60 * 1000;
const HISTORY_CHAR_BUDGET = 12000;
const FACTS_CHAR_BUDGET = 4000;

const FACT_SLOTS = ['name', 'city', 'job', 'stack', 'project', 'like', 'dislike', 'date', 'other'];

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

  return { summary: s, facts: '' };
}

function normFact(s) {
  return String(s || '')
    .replace(/\s+/g, '')
    .replace(/[，。；、！？,.;!?]/g, '')
    .trim();
}

function parseFactLine(line) {
  const raw = String(line || '').replace(/^[-*•\d.\s]+/, '').trim();
  if (!raw || raw === '无') return null;
  const m = raw.match(FACT_SLOT_RE);
  if (m) {
    const slot = m[1].toLowerCase();
    const text = m[2].trim();
    if (text && FACT_SLOTS.includes(slot)) return { slot, text };
  }
  if (raw.length > FACT_MAX_LEN) return null;
  return { slot: '', text: raw };
}

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
    const byteLen = () => JSON.stringify(session).length;
    if (byteLen() > 110000) {
      while (session.messages.length > 2 && byteLen() > 110000) {
        session.messages.shift();
      }
    }
    if (byteLen() > 110000 && session.summary && session.summary.length > 2000) {
      session.summary = compactOldSummary(session.summary, Math.max(2000, Math.floor(session.summary.length / 2)));
    }
    this.cache.set(key, session);
    await this.state.storage.put(PREFIX + key, session);
  }

  shouldCompress(session, limit, now = Date.now()) {
    const over = session.messages.length - limit;
    if (over <= 0) return false;

    if (session.messages.length > limit * 10) return true;

    if (over < limit * (COMPRESS_WATERMARK - 1)) return false;
    if ((session.sinceCompress || 0) < COMPRESS_EVERY) return false;

    const last = Number(session.lastCompressAt) || 0;
    if (last && now - last < COMPRESS_COOLDOWN_MS) return false;

    return true;
  }

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

      if (newFacts) {
        const parsed = newFacts
          .split('\n')
          .map(parseFactLine)
          .filter(Boolean);
        this.mergeFacts(session, parsed);
      }

      session.messages.splice(0, over);
      session.sinceCompress = 0;
      session.lastCompressAt = Date.now();
      await this.save(key, session);
      this.logger.info(
        `compressed ${over} msgs → summary=${session.summary.length}字, facts=${session.facts.length}条`
      );
      return { compressed: over };
    } catch (e) {
      this.logger.warn(`compress failed (kept ${over} msgs): ${e.message}`);
      return { compressed: 0, error: e.message };
    }
  }

  mergeFacts(session, parsed) {
    if (!Array.isArray(parsed) || !parsed.length) return;
    if (!Array.isArray(session.facts)) session.facts = [];
    const now = Date.now();

    for (const f of parsed) {
      const text = String(f.text || '').trim();
      if (!text) continue;
      const slot = String(f.slot || '');

      if (slot) {
        const idx = session.facts.findIndex((x) => x && x.slot === slot);
        if (idx >= 0) {
          if (normFact(session.facts[idx].text) !== normFact(text)) {
            session.facts[idx] = { ...session.facts[idx], text, at: now };
          } else {
            session.facts[idx].at = now;
          }
        } else {
          session.facts.push({ slot, text, at: now });
        }
        continue;
      }

      const nf = normFact(text);
      const exists = session.facts.some((x) => x && !x.slot && normFact(x.text) === nf);
      if (!exists) session.facts.push({ text, at: now });
    }

    if (session.facts.length > FACTS_MAX) {
      session.facts = session.facts.slice(-FACTS_MAX);
    }
  }

  async chatOnce(provider, messages, { timeout = 60000 } = {}) {
    return providerChat(this.env, provider, messages, { temperature: 0.3, timeout });
  }

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

    const storedUser = hasImage
      ? { role: 'user', content: content ? `${content}\n[图片]` : '[图片]' }
      : userMessage;
    session.messages.push(storedUser);
    await this.save(key, session);

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
        const text = await withRetry(
          async () =>
            providerChat(this.env, provider, msgs, {
              temperature:
                provider.temperature === '' || provider.temperature == null
                  ? 0.8
                  : Number(provider.temperature),
              timeout: hasImage ? 180000 : 90000,
            }),
          {
            maxAttempts: 2,
            delay: 800,
            shouldRetry: (e) =>
              !(e?.name === 'TimeoutError' || e?.name === 'AbortError') &&
              (e.status === undefined || e.status === 429 || e.status >= 500),
            onRetry: (err, attempt) => this.logger.warn(`retry ${attempt}: ${err.message}`),
          }
        );
        if (!text) throw new Error('AI 返回空内容');

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
    session.messages.pop();
    await this.save(key, session);
    return { error: `全部 AI 调用失败：${lastErr ? lastErr.message : '未知原因'}` };
  }

  buildMessages(session, systemPrompt, imageMessage) {
    const out = [{ role: 'system', content: String(systemPrompt || '') }];

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

    let history = imageMessage ? session.messages.slice(0, -1) : session.messages;

    if (history.length) {
      let used = 0;
      let cut = 0;
      for (let i = history.length - 1; i >= 0; i--) {
        const c = history[i] && history[i].content;
        used += typeof c === 'string' ? c.length : 200;
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

  async record(body) {
    const key = String(body.key || '').slice(0, 200);
    if (!key) return { error: 'missing key' };
    const session = await this.load(key);
    if (body.assistant) session.messages.push({ role: 'assistant', content: String(body.assistant).slice(0, 4000) });

    const limit = Math.max(2, Number(body.historyLimit) || 10);
    session.sinceCompress = (session.sinceCompress || 0) + 1;

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

  async inspect(body) {
    const key = String(body.key || '').slice(0, 200);
    if (!key) return { error: 'missing key' };
    const s = await this.load(key);
    const recent = (s.messages || []).slice(-8).map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content.slice(0, 200) : '[图片]',
    }));
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
