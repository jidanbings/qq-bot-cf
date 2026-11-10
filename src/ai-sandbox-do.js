import { withRetry } from './utils/retry.js';
import { providerChat } from './utils/workers-ai.js';

const META = 'meta';
const FILE_PREFIX = 'file:';
const LEGACY_KEY = 'sandbox';
const MAX_FILES = 5000;
const MAX_FILE_BYTES = 1.9 * 1024 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024;
const MAX_STEPS = 8;
const MAX_OPS_PER_STEP = 4;

export const AIDO_ENV_RULES = `

【沙箱】
隔离的 Durable Object，只有当前用户的虚拟文件（users/<编号>/）。单文件 ≤1.9MB，总量 ≤1GB，写不下就 WRITE 一次 + APPEND 续写。
只能动文件：不能发消息、不能联网、不能调其他 DO、不能执行命令。路径用相对路径，不要 ..。

操作（写在回复末尾，不会展示给用户）：
[ENV]{"op":"file.write","path":"a.md","content":"..."}
[ENV]{"op":"file.read","path":"a.md"}
[ENV]{"op":"file.list"}
[ENV]{"op":"file.delete","path":"a.md"}
[ENV:WRITE path="a.md"]
……正文原样写这里，多行不用转义……
[/ENV]
[ENV:APPEND path="a.md"]
……续写……
[/ENV]
[ENV]{"op":"file.send","path":"a.md"}
超过 300 字必须用 [ENV:WRITE] 块语法，别塞进 JSON 字符串。
每次最多 ${MAX_OPS_PER_STEP} 个操作；系统回执行结果后你再继续，做完了只给最终答复。

【发送文件】
只有用户明确要文件（「发我/给我/发送/下载/附件/打包」）才 file.send；列目录、聊天、改文件都不发。
要文件时创建完必须 file.send，别只回「已保存」。
沙箱不支持 zip，遇到打包要求就逐个 file.send 原文件。
用户要的文件不存在就直说「没有这个文件」，绝不要新建一个只有说明文字的空文件冒充。

【排版】
可以用 Markdown 表格，但每个格子都要填真实值。路径、大小、修改时间都照抄 file.list / 【当前沙箱】给你的原文，**不要写「暂不可知」「系统未返回」这类占位词**——系统已经把时间给你了。真没有就把那一列去掉。
表格里不要嵌套反引号，直接写文件名。
不要用 # 标题、不要用 ** 加粗（QQ 会原样显示星号）。`;


function safePath(p) {
  const s = String(p || '').replace(/\\/g, '/').trim();
  if (!s || s.startsWith('/') || s.includes('..') || s.length > 120) return null;
  return s;
}

function userBase(sb) {
  return sb && sb.owner ? `users/${sb.owner}/` : '';
}

function resolveIn(sb, p) {
  const s = safePath(p);
  if (!s) return null;
  if (s.startsWith('users/')) return s;
  return userBase(sb) + s;
}

function fmtTime(ms) {
  const n = Number(ms);
  if (!n) return '';
  const d = new Date(n);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function renderFiles(sb) {
  const paths = Object.keys(sb.files);
  if (!paths.length) return '\n\n【当前沙箱】\n文件：（空）';
  const lines = paths.map((p) => {
    const t = fmtTime((sb.fileMeta || {})[p]);
    const b = Buffer.byteLength(sb.files[p], 'utf8');
    return `- ${p} ｜ ${b}B${t ? ` ｜ 修改于 ${t}` : ''}`;
  });
  return '\n\n【当前沙箱】\n文件（共 ' + paths.length + ' 个）：\n' + lines.join('\n');
}

export function parseEnvOps(text) {
  const ops = [];
  const kept = [];
  const lines = String(text || '').split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const block = /^\[ENV:(WRITE|APPEND)\s+path="([^"]+)"\s*\]$/i.exec(trimmed);
    if (block) {
      const path = block[2];
      const content = [];
      let j = i + 1;
      for (; j < lines.length; j++) {
        if (lines[j].trim() === '[/ENV]') break;
        content.push(lines[j]);
      }
      if (j >= lines.length) {
        kept.push(line);
        continue;
      }
      ops.push({
        op: block[1].toUpperCase() === 'WRITE' ? 'file.write' : 'file.append',
        path,
        content: content.join('\n'),
      });
      i = j;
      continue;
    }

    if (trimmed.startsWith('[ENV]')) {
      try {
        const op = JSON.parse(trimmed.slice(5).trim());
        if (op && typeof op.op === 'string') ops.push(op);
      } catch {
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
        if (!paths.length) {
          results.push('文件列表：（空）');
        } else {
          const lines = paths.map((p) => {
            const t = fmtTime((sb.fileMeta || {})[p]);
            const b = Buffer.byteLength(sb.files[p], 'utf8');
            return `- ${p} ｜ ${b}B${t ? ` ｜ 修改于 ${t}` : ''}`;
          });
          results.push(`文件列表（共 ${paths.length} 个）：\n` + lines.join('\n'));
        }
      } else if (op.op === 'file.write') {
        const p = resolveIn(sb, op.path);
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
      } else if (op.op === 'file.append') {
        const p = resolveIn(sb, op.path);
        if (!p) {
          results.push(`追加失败：非法路径 ${op.path}`);
          continue;
        }
        const add = String(op.content == null ? '' : op.content);
        const merged = (sb.files[p] || '') + (sb.files[p] ? '\n' : '') + add;
        if (Buffer.byteLength(merged, 'utf8') > MAX_FILE_BYTES) {
          results.push(`追加失败：${p} 超过 ${MAX_FILE_BYTES / 1024}KB`);
          continue;
        }
        const nextAppend = { ...sb.files, [p]: merged };
        if (totalBytes(nextAppend) > MAX_TOTAL_BYTES) {
          results.push(`追加失败：沙箱总量超过 ${MAX_TOTAL_BYTES / 1024}KB`);
          continue;
        }
        sb.files = nextAppend;
        results.push(`已追加 ${p}（现在 ${Buffer.byteLength(merged, 'utf8')}B）`);
      } else if (op.op === 'file.read') {
        const p = resolveIn(sb, op.path);
        if (!p || !(p in sb.files)) {
          results.push(`读取失败：${op.path} 不存在`);
          continue;
        }
        results.push(`${p} 的内容：\n${sb.files[p]}`);
      } else if (op.op === 'file.delete') {
        const p = resolveIn(sb, op.path);
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
    const meta = (await this.state.storage.get(META)) || {};
    const files = {};
    try {
      const list = await this.state.storage.list({ prefix: FILE_PREFIX });
      for (const [k, v] of list) files[k.slice(FILE_PREFIX.length)] = String(v);
    } catch {
    }
    if (!Object.keys(files).length) {
      try {
        const legacy = await this.state.storage.get(LEGACY_KEY);
        if (legacy && typeof legacy === 'object' && legacy.files) {
          for (const [p, v] of Object.entries(legacy.files)) files[p] = String(v);
          await this.state.storage.put(META, {
            owner: legacy.owner || '',
            runs: legacy.runs || 0,
            updatedAt: legacy.updatedAt || Date.now(),
            log: legacy.log || [],
          });
          await this.state.storage.delete(LEGACY_KEY);
        }
      } catch {
      }
    }
    const fileMeta = meta.fileMeta && typeof meta.fileMeta === 'object' ? meta.fileMeta : {};
    return {
      files,
      fileMeta,
      owner: typeof meta.owner === 'string' ? meta.owner : '',
      scope: typeof meta.scope === 'string' ? meta.scope : '',
      kind: typeof meta.kind === 'string' ? meta.kind : '',
      runs: Number(meta.runs) || 0,
      updatedAt: Number(meta.updatedAt) || 0,
      log: Array.isArray(meta.log) ? meta.log : [],
    };
  }

  async save(sb, before) {
    sb.updatedAt = Date.now();
    const prev = before || {};
    const puts = {};
    const fileMeta = { ...(sb.fileMeta || {}) };
    for (const [p, v] of Object.entries(sb.files)) {
      if (prev[p] !== v) {
        puts[FILE_PREFIX + p] = v;
        fileMeta[p] = sb.updatedAt;
      } else if (!fileMeta[p]) {
        fileMeta[p] = sb.updatedAt;
      }
    }
    const dels = Object.keys(prev).filter((p) => !(p in sb.files)).map((p) => FILE_PREFIX + p);
    for (const k of Object.keys(fileMeta)) {
      if (!(k in sb.files)) delete fileMeta[k];
    }
    sb.fileMeta = fileMeta;
    if (Object.keys(puts).length) await this.state.storage.put(puts);
    if (dels.length) await this.state.storage.delete(dels);
    await this.state.storage.put(META, {
      owner: sb.owner || '',
      scope: sb.scope || '',
      kind: sb.kind || '',
      runs: sb.runs,
      updatedAt: sb.updatedAt,
      fileMeta,
      log: sb.log,
    });
  }

  async callProvider(provider, messages) {
    return withRetry(
      () =>
        providerChat(this.env, provider, messages, {
          temperature: provider.temperature === '' || provider.temperature == null ? 0.6 : Number(provider.temperature),
          timeout: 180000,
        }),
      {
        maxAttempts: 2,
        delay: 800,
        shouldRetry: (e) => e.status === undefined || e.status === 429 || e.status >= 500,
      }
    );
  }

  async run({ task, systemPrompt, providers, scope, kind, owner }) {
    const sb = await this.load();
    if (owner) sb.owner = String(owner).slice(0, 32);
    if (scope) sb.scope = String(scope).slice(0, 120);
    if (kind) sb.kind = String(kind).slice(0, 16);
    const basePrompt = String(systemPrompt || '') + AIDO_ENV_RULES + renderFiles(sb);
    const messages = [
      { role: 'system', content: basePrompt },
      { role: 'user', content: String(task || '').slice(0, 16000) },
    ];

    let reply = '';
    let steps = 0;
    const sendQueue = [];
    let lastErr = null;
    let usedProvider = null;
    for (; steps < MAX_STEPS; steps++) {
      let raw = null;
      for (const provider of providers || []) {
        try {
          raw = await this.callProvider(provider, messages);
          usedProvider = provider;
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!raw) return { error: `全部 AI 调用失败：${lastErr ? lastErr.message : '未配置 AI'}` };

      const { reply: text, ops } = parseEnvOps(raw);
      if (text) reply = text;
      if (!ops.length) break;

      const sendOps = ops.filter((o) => o.op === 'file.send');
      const otherOps = ops.filter((o) => o.op !== 'file.send');
      const before = { ...sb.files };
      const results = applyEnvOps(sb, otherOps);
      for (const op of sendOps) {
        const p = resolveIn(sb, op.path);
        if (!p || !(p in sb.files)) {
          results.push(`发送失败：${op.path} 不存在`);
        } else if (sendQueue.length >= 50) {
          results.push('发送失败：一次最多 50 个文件');
        } else if (!sendQueue.includes(p)) {
          sendQueue.push(p);
          results.push(`已加入发送队列：${p}（系统会把它作为附件发出）`);
        }
      }
      await this.save(sb, before);
      messages.push({ role: 'assistant', content: raw });
      messages.push({
        role: 'user',
        content:
          '执行结果：\n' +
          results.join('\n') +
          '\n如果任务已完成，请直接给最终答复（不要再输出 [ENV]）；否则继续输出需要的 [ENV] 操作。',
      });
    }

    const wantsSend = /(发我|发给我|发一下|发过来|发送|给我|附件|下载|传给我|导出|打包|zip)/i.test(String(task || ''));
    if (!wantsSend && sendQueue.length) {
      sendQueue.length = 0;
    }

    sb.runs += 1;
    sb.log.push({ task: String(task).slice(0, 120), reply: String(reply).slice(0, 160), at: Date.now(), steps: steps + 1 });
    if (sb.log.length > 20) sb.log.shift();
    await this.save(sb, {});
    await this.syncIndex(scope, kind, sb, task);
    return {
      reply: reply || '（任务处理完了，但没有给出正文）',
      steps: steps + 1,
      files: Object.keys(sb.files).length,
      runs: sb.runs,
      send: sendQueue,
      model: usedProvider ? `${usedProvider.name} · ${usedProvider.model}` : '',
    };
  }

  async touch({ scope, kind, owner, lastTask }) {
    const sb = await this.load();
    if (owner && !sb.owner) sb.owner = String(owner).slice(0, 32);
    const task = String(lastTask || '').slice(0, 120);
    await this.syncIndex(scope || sb.scope || '', kind || sb.kind || 'group', sb, task, {
      keepUpdatedAt: true,
    });
    return { ok: true };
  }

  async syncIndex(scope, kind, sb, lastTask, { keepUpdatedAt = false } = {}) {
    try {
      if (!scope || !this.env || !this.env.DB) return;
      const { getSandbox } = await import('./db.js');
      const prev = keepUpdatedAt ? await getSandbox(this.env, scope).catch(() => null) : null;
      const { upsertSandbox } = await import('./db.js');
      await upsertSandbox(this.env, {
        scope,
        kind,
        runs: sb.runs,
        files: Object.keys(sb.files).length,
        lastTask,
        updatedAt: keepUpdatedAt && prev ? prev.updated_at : sb.updatedAt,
      });
    } catch (e) {
      console.warn('[AIDO] index sync failed:', e && e.message);
    }
  }

  async getState() {
    const sb = await this.load();
    return {
      files: Object.keys(sb.files).map((p) => ({
        path: p,
        bytes: Buffer.byteLength(sb.files[p], 'utf8'),
        updatedAt: Number((sb.fileMeta || {})[p]) || sb.updatedAt || 0,
        content: sb.files[p].slice(0, 4000),
      })),
      runs: sb.runs,
      updatedAt: sb.updatedAt,
    };
  }

  async putFile({ name, content, path, owner, scope, kind }) {
    const sb = await this.load();
    if (owner) sb.owner = String(owner).slice(0, 32);
    const rawName = String(name || '').trim() || 'upload.txt';
    const base = rawName.replace(/\\/g, '/').split('/').pop().slice(0, 80) || 'upload.txt';
    const target = resolveIn(sb, String(path || base));
    if (!target) return { error: '非法文件名' };
    const text = String(content == null ? '' : content);
    if (Buffer.byteLength(text, 'utf8') > MAX_FILE_BYTES) {
      return { error: `文件超过 ${Math.round(MAX_FILE_BYTES / 1024)}KB` };
    }
    if (!(target in sb.files) && Object.keys(sb.files).length >= MAX_FILES) {
      return { error: `文件数已达上限 ${MAX_FILES}` };
    }
    const next = { ...sb.files, [target]: text };
    if (totalBytes(next) > MAX_TOTAL_BYTES) return { error: '沙箱总量已满' };
    const before = { ...sb.files };
    sb.files = next;
    sb.runs = (sb.runs || 0) + 1;
    if (scope) sb.scope = String(scope).slice(0, 120);
    if (kind) sb.kind = String(kind).slice(0, 16);
    await this.save(sb, before);
    await this.syncIndex(sb.scope || '', sb.kind || '', sb, sb.lastTask || '');
    return { ok: true, path: target, bytes: Buffer.byteLength(text, 'utf8') };
  }

  async readFile(path) {
    const meta = (await this.state.storage.get(META)) || {};
    const resolved = resolveIn({ owner: meta.owner || '' }, path);
    const raw = safePath(path);
    for (const p of [resolved, raw]) {
      if (!p) continue;
      try {
        const v = await this.state.storage.get(FILE_PREFIX + p);
        if (typeof v === 'string') return { path: p, content: v, bytes: Buffer.byteLength(v, 'utf8') };
      } catch {
      }
    }
    return { error: '文件不存在' };
  }

  async reset() {
    try {
      const list = await this.state.storage.list({ prefix: FILE_PREFIX });
      const keys = [...list.keys()];
      if (keys.length) await this.state.storage.delete(keys);
    } catch {
    }
    await this.state.storage.delete(META);
    await this.state.storage.delete(LEGACY_KEY).catch?.(() => {});
    return { ok: true };
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });
    try {
      const body = await request.json().catch(() => ({}));
      if (url.pathname === '/run') return Response.json(await this.run(body));
      if (url.pathname === '/state') return Response.json(await this.getState());
      if (url.pathname === '/touch') return Response.json(await this.touch(body));
      if (url.pathname === '/file') return Response.json(await this.readFile(body.path));
      if (url.pathname === '/put') return Response.json(await this.putFile(body));
      if (url.pathname === '/reset') return Response.json(await this.reset());
      return new Response('not found', { status: 404 });
    } catch (e) {
      return Response.json({ error: String((e && e.message) || e) }, { status: 500 });
    }
  }
}
