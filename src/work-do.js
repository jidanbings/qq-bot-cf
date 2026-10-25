/**
 * AI 工作区 Durable Object：一个会话一个实例（idFromName('group:<id>' / 'c2c:<id>')）。
 *
 * 用来「干活」而不是聊天：`/do <任务>` 会把任务带进这里执行，AI 可以维护
 * 任务清单（task.add / task.done）和笔记（note），状态存在 DO 自己的存储里，
 * 同时往 D1 的 workspaces 表写一份索引，后台「AI 工作区」页据此管理。
 */
import { withRetry } from './utils/retry.js';

const KEY = 'ws';
const MAX_TASKS = 50;
const MAX_NOTES = 50;
const MAX_LOG = 20;

const WS_RULES = `

【工作区模式】你现在不在聊天，而是在执行用户交代的任务。你可以维护「任务清单」和「笔记」，规则：
- 正常用中文回答任务结果，简洁、可执行；
- 需要新增任务时，在回复最后单独一行输出：[WS]{"op":"task.add","text":"要做的事"}
- 需要把某条任务标记完成时：[WS]{"op":"task.done","id":任务编号}
- 需要记一条笔记时：[WS]{"op":"note","text":"笔记内容"}
- 这些 [WS] 行不会发给用户，不要放进代码块，也不要解释它们；
- 当前工作区状态见下方，不要编造不存在的任务编号。`;

function renderState(ws) {
  const tasks = ws.tasks.length
    ? ws.tasks.map((t) => `${t.id}. ${t.done ? '✅' : '⬜'} ${t.text}`).join('\n')
    : '（空）';
  const notes = ws.notes.length ? ws.notes.map((n) => `- ${n.text}`).join('\n') : '（空）';
  return `\n\n【当前工作区】\n任务：\n${tasks}\n笔记：\n${notes}`;
}

/** 从回复里抠出 [WS]{...} 操作行，返回纯文本与操作列表 */
export function parseWorkspaceOps(text) {
  const ops = [];
  const lines = String(text || '').split('\n');
  const kept = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('[WS]')) {
      try {
        const op = JSON.parse(t.slice(4).trim());
        if (op && typeof op.op === 'string') ops.push(op);
      } catch {
        // 解析失败就丢掉这一行，不影响正文
      }
      continue;
    }
    kept.push(line);
  }
  return { reply: kept.join('\n').trim(), ops };
}

export function applyWorkspaceOps(ws, ops) {
  const applied = [];
  for (const op of ops) {
    if (op.op === 'task.add' && op.text) {
      if (ws.tasks.length >= MAX_TASKS) ws.tasks.shift();
      const id = ws.nextId || ws.tasks.reduce((m, t) => Math.max(m, t.id), 0) + 1;
      ws.tasks.push({ id, text: String(op.text).slice(0, 200), done: false, createdAt: Date.now() });
      ws.nextId = id + 1;
      applied.push(`新增任务 #${id}`);
    } else if (op.op === 'task.done' && op.id) {
      const t = ws.tasks.find((x) => x.id === Number(op.id));
      if (t && !t.done) {
        t.done = true;
        t.doneAt = Date.now();
        applied.push(`完成任务 #${t.id}`);
      }
    } else if (op.op === 'note' && op.text) {
      if (ws.notes.length >= MAX_NOTES) ws.notes.shift();
      ws.notes.push({ text: String(op.text).slice(0, 300), createdAt: Date.now() });
      applied.push('记了一条笔记');
    }
  }
  return applied;
}

export class WorkspaceDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async load() {
    const saved = await this.state.storage.get(KEY);
    const ws = saved && typeof saved === 'object' ? saved : {};
    return {
      tasks: Array.isArray(ws.tasks) ? ws.tasks : [],
      notes: Array.isArray(ws.notes) ? ws.notes : [],
      log: Array.isArray(ws.log) ? ws.log : [],
      runs: Number(ws.runs) || 0,
      nextId: Number(ws.nextId) || 1,
      updatedAt: Number(ws.updatedAt) || 0,
    };
  }

  async save(ws) {
    ws.updatedAt = Date.now();
    await this.state.storage.put(KEY, ws);
  }

  async syncIndex(scope, kind, ws, lastTask) {
    try {
      if (!this.env || !this.env.DB) return;
      const { upsertWorkspace } = await import('./db.js');
      await upsertWorkspace(this.env, {
        scope,
        kind,
        runs: ws.runs,
        tasks: ws.tasks.length,
        notes: ws.notes.length,
        lastTask,
        updatedAt: ws.updatedAt,
      });
    } catch (e) {
      console.warn('[WS] index sync failed:', e && e.message);
    }
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
            temperature: provider.temperature === '' || provider.temperature == null ? 0.5 : Number(provider.temperature),
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

  async run({ scope, kind, task, systemPrompt, providers }) {
    const ws = await this.load();
    const messages = [
      { role: 'system', content: String(systemPrompt || '') + WS_RULES + renderState(ws) },
      { role: 'user', content: String(task || '').slice(0, 2000) },
    ];

    let lastErr = null;
    for (const provider of providers || []) {
      try {
        const raw = await this.callProvider(provider, messages);
        const { reply, ops } = parseWorkspaceOps(raw);
        const applied = applyWorkspaceOps(ws, ops);
        ws.runs += 1;
        ws.log.push({ task: String(task).slice(0, 120), reply: reply.slice(0, 160), at: Date.now() });
        if (ws.log.length > MAX_LOG) ws.log.shift();
        await this.save(ws);
        await this.syncIndex(scope, kind, ws, String(task).slice(0, 120));
        return {
          reply: reply || '（任务执行完了，但没有正文）',
          applied,
          tasks: ws.tasks,
          notes: ws.notes,
          runs: ws.runs,
        };
      } catch (e) {
        lastErr = e;
        console.warn('[WS] provider failed:', e && e.message);
      }
    }
    return { error: `全部 AI 调用失败：${lastErr ? lastErr.message : '未配置 AI'}` };
  }

  async getState() {
    const ws = await this.load();
    return { tasks: ws.tasks, notes: ws.notes, log: ws.log, runs: ws.runs, updatedAt: ws.updatedAt };
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
