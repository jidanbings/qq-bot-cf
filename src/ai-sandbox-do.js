/**
 * AiDO —— 给 AI 的最高权限沙箱（一个会话一个实例）。
 *
 * 设计边界（写进系统提示词，也由代码强制执行）：
 * - 只能读写自己实例内的虚拟文件系统（最多 20 个文件、单文件 8KB、总量 40KB）
 * - 不能发 QQ 消息、不能访问网络、不能调用其他 DO、不能执行任意代码或命令
 * - 每轮最多执行 4 个文件操作，最多 6 轮，避免死循环
 *
 * AI 通过 [ENV]{"op":...} 行申请操作，沙箱执行后把结果喂回去，直到它给出最终答案。
 */
import { withRetry } from './utils/retry.js';

const KEY = 'sandbox';
const MAX_FILES = 20;
const MAX_FILE_BYTES = 8 * 1024;
const MAX_TOTAL_BYTES = 40 * 1024;
const MAX_STEPS = 6;
const MAX_OPS_PER_STEP = 4;

export const AIDO_ENV_RULES = `

【运行环境（必须遵守）】
- 你运行在一个隔离的沙箱 Durable Object（AiDO）里，实例只属于当前这个会话。
- 你唯一能操作的是这个沙箱里的虚拟文件系统：最多 ${MAX_FILES} 个文件，单文件不超过 ${MAX_FILE_BYTES / 1024}KB，总量不超过 ${MAX_TOTAL_BYTES / 1024}KB。
- 文件路径用相对路径（例如 notes/todo.md），不要用绝对路径或 .. 跳出沙箱。
- 你**不能**发 QQ 消息、不能访问网络、不能调用其他 DO、不能执行任意代码或系统命令；这些操作会被直接拒绝。
- 需要操作文件时，在回复最后单独输出：
  [ENV]{"op":"file.write","path":"notes/todo.md","content":"..."}
  [ENV]{"op":"file.read","path":"notes/todo.md"}
  [ENV]{"op":"file.list"}
  [ENV]{"op":"file.delete","path":"notes/todo.md"}
- 每次最多 ${MAX_OPS_PER_STEP} 个操作；系统执行后会把结果回给你，然后你再继续，任务完成就只给最终答复、不要再输出操作。
- [ENV] 行不会展示给用户，也不要放进代码块。`;

function safePath(p) {
  const s = String(p || '').replace(/\\/g, '/').trim();
  if (!s || s.startsWith('/') || s.includes('..') || s.length > 120) return null;
  return s;
}

function renderFiles(sb) {
  const paths = Object.keys(sb.files);
  if (!paths.length) return '\n\n【当前沙箱】\n文件：（空）';
  return '\n\n【当前沙箱】\n文件：\n' + paths.map((p) => `- ${p}（${Buffer.byteLength(sb.files[p], 'utf8')}B）`).join('\n');
}

export function parseEnvOps(text) {
  const ops = [];
  const kept = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (t.startsWith('[ENV]')) {
      try {
        const op = JSON.parse(t.slice(5).trim());
        if (op && typeof op.op === 'string') ops.push(op);
      } catch {
        /* 解析失败丢弃该行 */
      }
      continue;
    }
    kept.push(line);
  }
  return { reply: kept.join('\n').trim(), ops: ops.slice(0, MAX_OPS_PER_STEP) };
}

function totalBytes(files) {
  return Object.values(files).reduce((n, s) => n + Buffer.byteLength(s, 'utf8'), 0);
}

export function applyEnvOps(sb, ops) {
  const results = [];
  for (const op of ops) {
    try {
      if (op.op === 'file.list') {
        const paths = Object.keys(sb.files);
        results.push(paths.length ? '文件列表：\n' + paths.map((p) => `- ${p}`).join('\n') : '文件列表：（空）');
      } else if (op.op === 'file.write') {
        const p = safePath(op.path);
        if (!p) {
          results.push(`写入失败：非法路径 ${op.path}`);
          continue;
        }
        const content = String(op.content == null ? '' : op.content);
        if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) {
          results.push(`写入失败：${p} 超过 ${MAX_FILE_BYTES / 1024}KB`);
          continue;
        }
        if (!(p in sb.files) && Object.keys(sb.files).length >= MAX_FILES) {
          results.push(`写入失败：文件数已达上限 ${MAX_FILES}`);
          continue;
        }
        const next = { ...sb.files, [p]: content };
        if (totalBytes(next) > MAX_TOTAL_BYTES) {
          results.push(`写入失败：沙箱总量超过 ${MAX_TOTAL_BYTES / 1024}KB`);
          continue;
        }
        sb.files = next;
        results.push(`已写入 ${p}（${Buffer.byteLength(content, 'utf8')}B）`);
      } else if (op.op === 'file.read') {
        const p = safePath(op.path);
        if (!p || !(p in sb.files)) {
          results.push(`读取失败：${op.path} 不存在`);
          continue;
        }
        results.push(`${p} 的内容：\n${sb.files[p]}`);
      } else if (op.op === 'file.delete') {
        const p = safePath(op.path);
        if (!p || !(p in sb.files)) {
          results.push(`删除失败：${op.path} 不存在`);
          continue;
        }
        delete sb.files[p];
        results.push(`已删除 ${p}`);
      } else {
        results.push(`不支持的沙箱操作：${op.op}（只允许 file.write / file.read / file.list / file.delete）`);
      }
    } catch (e) {
      results.push(`操作失败：${e.message}`);
    }
  }
  return results;
}

export class AiDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async load() {
    const saved = await this.state.storage.get(KEY);
    const sb = saved && typeof saved === 'object' ? saved : {};
    return {
      files: sb.files && typeof sb.files === 'object' ? sb.files : {},
      runs: Number(sb.runs) || 0,
      updatedAt: Number(sb.updatedAt) || 0,
      log: Array.isArray(sb.log) ? sb.log : [],
    };
  }

  async save(sb) {
    sb.updatedAt = Date.now();
    await this.state.storage.put(KEY, sb);
  }

  async callProvider(provider, messages) {
    return withRetry(
      async () => {
        const res = await fetch(`${provider.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
          body: JSON.stringify({
            model: provider.model,
            messages,
            temperature: provider.temperature === '' || provider.temperature == null ? 0.6 : Number(provider.temperature),
          }),
          signal: AbortSignal.timeout(120000),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          const err = new Error(`HTTP ${res.status}${text ? ' ' + text.slice(0, 120) : ''}`);
          err.status = res.status;
          throw err;
        }
        const data = await res.json();
        const out = String(data.choices?.[0]?.message?.content || '').trim();
        if (!out) throw new Error('AI 返回空内容');
        return out;
      },
      {
        maxAttempts: 2,
        delay: 800,
        shouldRetry: (e) => e.status === undefined || e.status === 429 || e.status >= 500,
      }
    );
  }

  async run({ task, systemPrompt, providers }) {
    const sb = await this.load();
    const basePrompt = String(systemPrompt || '') + AIDO_ENV_RULES + renderFiles(sb);
    const messages = [
      { role: 'system', content: basePrompt },
      { role: 'user', content: String(task || '').slice(0, 2000) },
    ];

    let reply = '';
    let steps = 0;
    let lastErr = null;
    for (; steps < MAX_STEPS; steps++) {
      let raw = null;
      for (const provider of providers || []) {
        try {
          raw = await this.callProvider(provider, messages);
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!raw) return { error: `全部 AI 调用失败：${lastErr ? lastErr.message : '未配置 AI'}` };

      const { reply: text, ops } = parseEnvOps(raw);
      if (text) reply = text;
      if (!ops.length) break;

      const results = applyEnvOps(sb, ops);
      await this.save(sb);
      messages.push({ role: 'assistant', content: raw });
      messages.push({
        role: 'user',
        content:
          '执行结果：\n' +
          results.join('\n') +
          '\n如果任务已完成，请直接给最终答复（不要再输出 [ENV]）；否则继续输出需要的 [ENV] 操作。',
      });
    }

    sb.runs += 1;
    sb.log.push({ task: String(task).slice(0, 120), reply: String(reply).slice(0, 160), at: Date.now(), steps: steps + 1 });
    if (sb.log.length > 20) sb.log.shift();
    await this.save(sb);
    return {
      reply: reply || '（任务处理完了，但没有给出正文）',
      steps: steps + 1,
      files: Object.keys(sb.files).length,
      runs: sb.runs,
    };
  }

  async getState() {
    const sb = await this.load();
    return {
      files: Object.keys(sb.files).map((p) => ({ path: p, bytes: Buffer.byteLength(sb.files[p], 'utf8') })),
      runs: sb.runs,
      updatedAt: sb.updatedAt,
    };
  }

  async reset() {
    await this.state.storage.delete(KEY);
    return { ok: true };
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });
    try {
      const body = await request.json().catch(() => ({}));
      if (url.pathname === '/run') return Response.json(await this.run(body));
      if (url.pathname === '/state') return Response.json(await this.getState());
      if (url.pathname === '/reset') return Response.json(await this.reset());
      return new Response('not found', { status: 404 });
    } catch (e) {
      return Response.json({ error: String((e && e.message) || e) }, { status: 500 });
    }
  }
}
