/**
 * 聊天 Durable Object（ChatDO）：把「会话历史 + 模型调用」从机器人 DO 里拆出来。
 *
 * - 机器人 DO（QQBotDO）只负责 QQ 网关收发、工具执行；
 * - 这里负责每个会话的上下文、摘要压缩、按优先级调用 AI（含识图能力过滤、重试、故障转移）。
 *
 * 每个会话一个实例（idFromName(conversationKey)），天然串行处理同一会话的请求，
 * 慢请求（带图 180s）不会卡住别的群。
 */
import { withRetry } from './utils/retry.js';
import { providerSupportsVision } from './utils/vision.js';

const PREFIX = 'chat:';
const MAX_KEYS = 500;
const SUMMARY_PROMPT =
  '把这段聊天记录压缩成不超过 120 字的中文摘要，只保留重要事实、用户偏好和未完成的事，不要客套话。';

export class ChatDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.cache = new Map();
    this.logger = {
      info: (...args) => console.log('[AIDO]', ...args),
      warn: (...args) => console.warn('[AIDO]', ...args),
      error: (...args) => console.error('[AIDO]', ...args),
    };
  }

  async load(key) {
    if (this.cache.has(key)) return this.cache.get(key);
    const stored = await this.state.storage.get(PREFIX + key);
    const session = stored && typeof stored === 'object'
      ? { messages: Array.isArray(stored.messages) ? stored.messages : [], summary: String(stored.summary || ''), lastUsed: stored.lastUsed || Date.now() }
      : { messages: [], summary: '', lastUsed: Date.now() };
    this.cache.set(key, session);
    return session;
  }

  async save(key, session) {
    session.lastUsed = Date.now();
    // DO 单个值有大小上限（约 128KB）：超了就丢最老的消息，绝不把 base64 图片写进去
    if (JSON.stringify(session).length > 100000) {
      while (session.messages.length > 2 && JSON.stringify(session).length > 100000) {
        session.messages.shift();
      }
    }
    this.cache.set(key, session);
    await this.state.storage.put(PREFIX + key, session);
  }

  /** 只保留最近 N 条对话，超出的老消息压成摘要（后台异步，失败就丢） */
  async trimAndSummarize(key, session, limit, provider) {
    const over = session.messages.length - limit;
    if (over <= 0) return;
    const old = session.messages.splice(0, over);
    if (!provider || !old.length) return;
    const run = async () => {
      try {
        const text = old
          .map((m) => `${m.role === 'user' ? '用户' : '助手'}：${typeof m.content === 'string' ? m.content : '[图片]'}`)
          .join('\n')
          .slice(0, 3500);
        const summary = await this.chatOnce(provider, [
          { role: 'system', content: SUMMARY_PROMPT },
          { role: 'user', content: text },
        ]);
        if (summary) {
          session.summary = [session.summary, summary].filter(Boolean).join('；').slice(0, 400);
          await this.save(key, session);
          this.logger.info(`summary updated: ${session.summary.length} chars`);
        }
      } catch (e) {
        this.logger.warn(`summary failed: ${e.message}`);
      }
    };
    if (this.state && typeof this.state.waitUntil === 'function') this.state.waitUntil(run());
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
    const limit = Math.max(2, Number(body.historyLimit) || 20);
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
        // 把刚塞进去的图片消息退回，避免历史里留下一个没人看的图
        session.messages.pop();
        await this.save(key, session);
        return { error: 'no_vision' };
      }
    }

    const msgs = [
      { role: 'system', content: String(body.systemPrompt || '') },
      ...(session.summary ? [{ role: 'system', content: `【早前对话摘要】${session.summary}` }] : []),
      // 历史里的旧图片只是占位文本，最后一轮换成本次带图的完整消息
      ...session.messages.slice(0, -1),
      hasImage ? userMessage : session.messages[session.messages.length - 1],
    ];

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
        await this.trimAndSummarize(key, session, limit, provider);
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

  /** 记住助手这轮说了什么（工具执行结果就记一行内部记录） */
  async record(body) {
    const key = String(body.key || '').slice(0, 200);
    if (!key) return { error: 'missing key' };
    const session = await this.load(key);
    if (body.assistant) session.messages.push({ role: 'assistant', content: String(body.assistant).slice(0, 4000) });
    const limit = Math.max(2, Number(body.historyLimit) || 20);
    if (session.messages.length > limit) {
      session.messages.splice(0, session.messages.length - limit);
    }
    await this.save(key, session);
    return { ok: true, turns: session.messages.length };
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
      if (url.pathname === '/reset') return Response.json(await this.reset(body));
      return new Response('not found', { status: 404 });
    } catch (e) {
      this.logger.error(`fetch error: ${e && e.message}`);
      return Response.json({ error: String((e && e.message) || e) }, { status: 500 });
    }
  }
}
