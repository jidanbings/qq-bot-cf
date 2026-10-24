
import { SESSION_TTL_MS, CHAT_LOG_MAX_ROWS } from './constants.js';
import { encryptText, decryptText, isEncrypted, keyFingerprint, maskId } from './utils/crypto.js';

export const CONFIG_FIELDS = {
  appId: { type: 'string', max: 64 },
  secret: { type: 'string', max: 256, secret: true },
  sandbox: { type: 'flag' },
  systemPrompt: { type: 'string', max: 4000 },
  historyLimit: { type: 'int', min: 1, max: 100 },
  groupBlacklist: { type: 'string', max: 4000 },
  sensitiveWords: { type: 'string', max: 4000 },
  markdownReply: { type: 'flag' },
  autoRecall: { type: 'flag' },
  welcomeEnabled: { type: 'flag' },
  welcomeMsg: { type: 'string', max: 4000 },
  imageGenModel: { type: 'string', max: 64 },
  imageGenBaseUrl: { type: 'url', max: 512 },
  imageGenApiKey: { type: 'string', max: 256, secret: true },
  toolCalling: { type: 'flag' },
  doVersion: { type: 'string', max: 32 },
};

export const AI_LIST_KEY = 'aiProviders';
export const AI_MAX_PROVIDERS = 10;
const LEGACY_AI_KEYS = ['aiBaseUrl', 'aiApiKey', 'aiModel', 'aiTemperature'];
const LEGACY_KEYS = [...LEGACY_AI_KEYS, 'replyAt'];

const CONFIG_KEYS = Object.keys(CONFIG_FIELDS);
const SECRET_CONFIG_KEYS = CONFIG_KEYS.filter((k) => CONFIG_FIELDS[k].secret);

export const KEY_CHECK_KEY = '__key_check';

export function randomHex(bytes) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let out = '';
  for (const b of buf) out += b.toString(16).padStart(2, '0');
  return out;
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS config (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    ip         TEXT,
    user_agent TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at)`,
  `CREATE TABLE IF NOT EXISTS chat_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at   TEXT NOT NULL,
    kind         TEXT NOT NULL,
    scope_id     TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    user_content TEXT NOT NULL DEFAULT '',
    ai_reply     TEXT NOT NULL DEFAULT '',
    model        TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_chat_log_created ON chat_log (id DESC)`,
  `CREATE TABLE IF NOT EXISTS groups (
    openid    TEXT PRIMARY KEY,
    source    TEXT NOT NULL DEFAULT 'auto',
    added_at  TEXT NOT NULL,
    last_seen TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS reminders (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    scope_key   TEXT NOT NULL,
    is_c2c      INTEGER NOT NULL DEFAULT 0,
    scope_id    TEXT NOT NULL,
    due_at      TEXT NOT NULL,
    text        TEXT NOT NULL,
    repeat_rule TEXT,
    status      TEXT NOT NULL DEFAULT 'pending',
    created_at  TEXT NOT NULL,
    fired_at    TEXT,
    last_error  TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders (status, due_at)`,
  `CREATE TABLE IF NOT EXISTS memes (
    name        TEXT PRIMARY KEY,
    description TEXT NOT NULL DEFAULT '',
    data        TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  )`,
];

async function hasSchema(env) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('config', 'sessions', 'chat_log', 'groups', 'reminders', 'memes')`
    ).all();
    const names = new Set((results || []).map((r) => r.name));
    return (
      names.has('config') &&
      names.has('sessions') &&
      names.has('chat_log') &&
      names.has('groups') &&
      names.has('reminders') &&
      names.has('memes')
    );
  } catch {
    return false;
  }
}

let idScrubDone = false;

async function scrubChatLogIds(env) {
  const { results } = await env.DB.prepare(
    'SELECT DISTINCT scope_id, user_id FROM chat_log ' +
      'WHERE length(scope_id) > 20 OR length(user_id) > 20'
  ).all();
  if (!results || !results.length) return;

  const stmts = [];
  for (const row of results) {
    if (row.scope_id && row.scope_id.length > 20) {
      stmts.push(
        env.DB.prepare('UPDATE chat_log SET scope_id = ?1 WHERE scope_id = ?2')
          .bind(await maskId(row.scope_id), row.scope_id)
      );
    }
    if (row.user_id && row.user_id.length > 20) {
      stmts.push(
        env.DB.prepare('UPDATE chat_log SET user_id = ?1 WHERE user_id = ?2')
          .bind(await maskId(row.user_id), row.user_id)
      );
    }
  }
  if (stmts.length) await env.DB.batch(stmts);
}

export async function initSchema(env) {
  if (!env.DB) return { ok: false, error: '未绑定 D1 数据库' };
  try {
    if (await hasSchema(env)) {
      if (!idScrubDone) {
        idScrubDone = true;
        try {
          await scrubChatLogIds(env);
        } catch {
          idScrubDone = false;
        }
      }
      return { ok: true, created: false };
    }
    await env.DB.batch(SCHEMA_STATEMENTS.map((sql) => env.DB.prepare(sql)));
    return { ok: true, created: true };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

function upsertConfig(env, key, value, now) {
  return env.DB.prepare(
    'INSERT INTO config (key, value, updated_at) VALUES (?1, ?2, ?3) ' +
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
  ).bind(key, value, now);
}

export async function readRawConfig(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM config').all();
  const raw = {};
  for (const row of results || []) raw[row.key] = row.value;
  return raw;
}

async function decryptSecrets(env, raw) {
  const cfg = { ...raw };
  const legacy = [];
  for (const key of SECRET_CONFIG_KEYS) {
    if (!cfg[key]) continue;
    if (!isEncrypted(cfg[key])) legacy.push(key);
    cfg[key] = await decryptText(env, cfg[key], key);
  }
  if (legacy.length) {
    const now = new Date().toISOString();
    const statements = [];
    for (const key of legacy) {
      statements.push(upsertConfig(env, key, await encryptText(env, cfg[key], key), now));
    }
    await env.DB.batch(statements);
  }
  return cfg;
}

function normalizeProvider(raw, index) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const t = p.temperature == null || p.temperature === '' ? '0.8' : String(p.temperature);
  return {
    id: String(p.id || '').slice(0, 40),
    name: String(p.name || '').trim().slice(0, 40) || `AI ${index + 1}`,
    baseUrl: String(p.baseUrl || '').trim(),
    apiKey: String(p.apiKey || ''),
    model: String(p.model || '').trim().slice(0, 128),
    temperature: Number.isFinite(Number(t)) ? String(Number(t)) : '0.8',
    enabled: p.enabled === 0 || p.enabled === '0' ? 0 : 1,
  };
}

export async function readAiProviders(env) {
  let row;
  try {
    row = await env.DB.prepare('SELECT value FROM config WHERE key = ?1').bind(AI_LIST_KEY).first();
  } catch {
    return [];
  }
  if (!row || !row.value) return [];
  let text;
  try {
    text = await decryptText(env, row.value, AI_LIST_KEY);
  } catch {
    return [];
  }
  let list;
  try {
    list = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  return list.slice(0, AI_MAX_PROVIDERS).map(normalizeProvider);
}

export async function listAiProviders(env) {
  const list = await readAiProviders(env);
  return list.map((p) => ({
    id: p.id,
    name: p.name,
    baseUrl: p.baseUrl,
    model: p.model,
    temperature: p.temperature,
    enabled: p.enabled,
    hasKey: !!p.apiKey,
  }));
}

export async function getAiProvider(env, id) {
  const list = await readAiProviders(env);
  return list.find((p) => p.id === id) || null;
}

async function migrateLegacyAi(env, cfg) {
  if (!cfg.aiBaseUrl && !cfg.aiApiKey && !cfg.aiModel) return;
  let key = cfg.aiApiKey || '';
  if (key && isEncrypted(key)) {
    try {
      key = await decryptText(env, key, 'aiApiKey');
    } catch {
      return;
    }
  }
  const provider = normalizeProvider(
    {
      id: 'ai-legacy',
      name: 'AI 1',
      baseUrl: cfg.aiBaseUrl,
      apiKey: key,
      model: cfg.aiModel,
      temperature: cfg.aiTemperature,
    },
    0
  );
  if (!provider.baseUrl || !provider.apiKey || !provider.model) return;

  try {
    const sealed = await encryptText(env, JSON.stringify([provider]), AI_LIST_KEY);
    const now = new Date().toISOString();
    const stmts = [upsertConfig(env, AI_LIST_KEY, sealed, now)];
    for (const k of LEGACY_AI_KEYS) {
      stmts.push(env.DB.prepare('DELETE FROM config WHERE key = ?1').bind(k));
    }
    await env.DB.batch(stmts);
  } catch {
    return;
  }
  cfg.aiProviders = [provider];
  for (const k of LEGACY_AI_KEYS) delete cfg[k];
}

async function dropLegacyKeys(env, cfg) {
  const present = LEGACY_KEYS.filter((k) => Object.prototype.hasOwnProperty.call(cfg, k));
  if (!present.length) return;
  try {
    await env.DB.batch(present.map((k) => env.DB.prepare('DELETE FROM config WHERE key = ?1').bind(k)));
  } catch {
    return;
  }
  for (const k of present) delete cfg[k];
}

export async function saveAiProviders(env, input) {
  if (!Array.isArray(input)) return { ok: false, error: 'AI 列表必须是数组' };
  if (!input.length) return { ok: false, error: '至少保留一个 AI' };
  if (input.length > AI_MAX_PROVIDERS) return { ok: false, error: `最多 ${AI_MAX_PROVIDERS} 个 AI` };

  const existing = await readAiProviders(env);
  const byId = new Map(existing.map((p) => [p.id, p]));
  const out = [];

  for (let i = 0; i < input.length; i++) {
    const raw = input[i] && typeof input[i] === 'object' ? input[i] : {};
    const p = normalizeProvider(raw, i);
    p.id = p.id || `ai-${Date.now().toString(36)}-${i}`;
    const url = normalizeUrl(p.baseUrl, 512);
    if (!url) return { ok: false, error: `第 ${i + 1} 个 AI 的 Base URL 不是合法的 http/https 地址` };
    p.baseUrl = url;
    const typed = String(raw.apiKey || '').trim();
    const kept = byId.get(p.id);
    p.apiKey = typed || (kept ? kept.apiKey : '');
    if (!p.model) return { ok: false, error: `第 ${i + 1} 个 AI 还没有选择模型` };
    if (!p.apiKey) return { ok: false, error: `第 ${i + 1} 个 AI 缺少 API Key` };
    const t = Number(p.temperature);
    if (!Number.isFinite(t) || t < 0 || t > 2) {
      return { ok: false, error: `第 ${i + 1} 个 AI 的 Temperature 必须在 0~2 之间` };
    }
    p.temperature = String(t);
    out.push(p);
  }

  const sealed = await encryptText(env, JSON.stringify(out), AI_LIST_KEY);
  await env.DB.batch([upsertConfig(env, AI_LIST_KEY, sealed, new Date().toISOString())]);
  try {
    await rememberKey(env);
  } catch {

  }
  return { ok: true, saved: out.map((p) => p.id) };
}

export async function getConfig(env, { decrypt = true } = {}) {
  const raw = await readRawConfig(env);
  if (!decrypt) return raw;
  const cfg = await decryptSecrets(env, raw);
  cfg.aiProviders = await readAiProviders(env);
  if (!cfg.aiProviders.length) await migrateLegacyAi(env, cfg);
  await dropLegacyKeys(env, cfg);
  return cfg;
}

async function rememberKey(env) {
  if (!env.CONFIG_ENC_KEY) return;
  const fp = await keyFingerprint(env);
  const sealed = await encryptText(env, env.CONFIG_ENC_KEY, KEY_CHECK_KEY);
  await env.DB.batch([upsertConfig(env, KEY_CHECK_KEY, `${fp}:${sealed}`, new Date().toISOString())]);
}

async function rememberKeyQuietly(env, key) {
  if (!key) return;
  try {
    await rememberKey({ ...env, CONFIG_ENC_KEY: key });
  } catch {
    
  }
}

const FINGERPRINT_LEN = 16;

function parseKeyCheck(value) {
  if (typeof value !== 'string' || value.length <= FINGERPRINT_LEN + 1) return null;
  if (value[FINGERPRINT_LEN] !== ':') return null;
  return {
    fingerprint: value.slice(0, FINGERPRINT_LEN),
    sealed: value.slice(FINGERPRINT_LEN + 1),
  };
}

export async function ensureKey(env) {
  const provided = env.CONFIG_ENC_KEY || '';
  let raw;
  try {
    raw = await readRawConfig(env);
  } catch {
    return { action: 'no-db', key: provided };
  }

  let probe = SECRET_CONFIG_KEYS.find((k) => isEncrypted(raw[k]));
  if (!probe && isEncrypted(raw[AI_LIST_KEY])) probe = AI_LIST_KEY;
  if (!probe) {
    
    if (!provided) return { action: 'nothing', key: '' };
    await rememberKeyQuietly(env, provided);
    return { action: 'recorded', key: provided };
  }

  if (!provided) return { action: 'missing', key: '' };

  let opens = false;
  try {
    await decryptText({ CONFIG_ENC_KEY: provided }, raw[probe], probe);
    opens = true;
  } catch {
    opens = false;
  }
  if (!opens) return { action: 'mismatch', key: '' };

  await rememberKeyQuietly(env, provided);
  return { action: 'ok', key: provided };
}

export function toPublicConfig(cfg) {
  const config = {};
  for (const key of CONFIG_KEYS) {
    config[key] = CONFIG_FIELDS[key].secret ? '' : (cfg[key] ?? '');
  }
  const configured = {
    secret: !!cfg.secret,
    imageGenApiKey: !!cfg.imageGenApiKey,
  };
  return { config, configured };
}

export function normalizeUrl(raw, max = 512) {
  const value = String(raw ?? '').trim();
  if (!value || value.length > max) return null;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  return value.replace(/\/+$/, '');
}

function validateField(key, spec, raw) {
  const value = raw == null ? '' : String(raw).trim();

  if (spec.secret && value === '') return { keep: true };
  if (value === '') return { value: '' };

  switch (spec.type) {
    case 'int': {
      const n = Number(value);
      if (!Number.isInteger(n) || n < spec.min || n > spec.max) {
        return { error: `${key} 必须是 ${spec.min}~${spec.max} 之间的整数` };
      }
      return { value: String(n) };
    }
    case 'float': {
      const n = Number(value);
      if (!Number.isFinite(n) || n < spec.min || n > spec.max) {
        return { error: `${key} 必须是 ${spec.min}~${spec.max} 之间的数字` };
      }
      return { value: String(n) };
    }
    case 'flag':
      if (value !== '0' && value !== '1') return { error: `${key} 只能是 0 或 1` };
      return { value };
    case 'url': {
      const url = normalizeUrl(value, spec.max);
      if (!url) return { error: `${key} 必须是 http/https 开头的合法 URL（不超过 ${spec.max} 字符）` };
      return { value: url };
    }
    default:
      if (value.length > spec.max) return { error: `${key} 长度不能超过 ${spec.max}` };
      return { value };
  }
}

export async function saveConfig(env, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return { ok: false, error: '请求体必须是 JSON 对象' };
  }
  const unknown = Object.keys(patch).filter((k) => !CONFIG_KEYS.includes(k));
  if (unknown.length) return { ok: false, error: `未知配置项: ${unknown.join(', ')}` };

  const now = new Date().toISOString();
  const statements = [];
  const saved = [];

  for (const [key, raw] of Object.entries(patch)) {
    const result = validateField(key, CONFIG_FIELDS[key], raw);
    if (result.error) return { ok: false, error: result.error };
    if (result.keep) continue;
    let value = result.value;
    if (CONFIG_FIELDS[key].secret) {
      try {
        value = await encryptText(env, value, key);
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }
    statements.push(upsertConfig(env, key, value, now));
    saved.push(key);
  }

  if (statements.length) await env.DB.batch(statements);
  
  if (statements.length && env.CONFIG_ENC_KEY) {
    try {
      await rememberKey(env);
    } catch {
      
    }
  }
  return { ok: true, saved };
}

export async function resetEncryptedConfig(env) {
  const raw = await readRawConfig(env);
  const keys = Object.keys(raw).filter((k) => k === KEY_CHECK_KEY || isEncrypted(raw[k]));
  if (!keys.length) return 0;
  await env.DB.batch(keys.map((k) => env.DB.prepare('DELETE FROM config WHERE key = ?1').bind(k)));
  return keys.length;
}

export async function createSession(env, meta = {}) {
  const id = randomHex(32);
  const now = Date.now();
  await env.DB.prepare(
    'INSERT INTO sessions (id, created_at, expires_at, ip, user_agent) VALUES (?1, ?2, ?3, ?4, ?5)'
  )
    .bind(
      id,
      new Date(now).toISOString(),
      new Date(now + SESSION_TTL_MS).toISOString(),
      meta.ip || null,
      (meta.userAgent || '').slice(0, 256) || null
    )
    .run();
  return { id, maxAge: Math.floor(SESSION_TTL_MS / 1000) };
}

export async function getSession(env, id) {
  if (!id || typeof id !== 'string' || !/^[0-9a-f]{64}$/.test(id)) return null;
  const row = await env.DB.prepare('SELECT id, expires_at FROM sessions WHERE id = ?1').bind(id).first();
  if (!row) return null;
  if (Date.parse(row.expires_at) <= Date.now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?1').bind(id).run();
    return null;
  }
  return row;
}

export async function deleteSession(env, id) {
  if (!id || !/^[0-9a-f]{64}$/.test(id)) return;
  await env.DB.prepare('DELETE FROM sessions WHERE id = ?1').bind(id).run();
}

export async function purgeExpiredSessions(env) {
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?1')
    .bind(new Date().toISOString())
    .run();
}

export async function addChatLog(env, entry) {
  // 系统消息不脱敏：scope 固定为 'system'，方便后台直接辨识
  const isSystem = entry.kind === 'system';
  const scopeKey = isSystem ? 'system' : await maskId(entry.scopeId);
  const userKey = isSystem ? '' : await maskId(entry.userId);

  await env.DB.prepare(
    'INSERT INTO chat_log (created_at, kind, scope_id, user_id, user_content, ai_reply, model) ' +
      'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)'
  )
    .bind(
      entry.time || new Date().toISOString(),
      entry.kind,
      scopeKey,
      userKey,
      String(entry.userContent ?? '').slice(0, 4000),
      String(entry.aiReply ?? '').slice(0, 4000),
      entry.model || null
    )
    .run();

  await env.DB.prepare(
    'DELETE FROM chat_log WHERE id <= (SELECT MAX(id) FROM chat_log) - ?1'
  )
    .bind(CHAT_LOG_MAX_ROWS)
    .run();
}

export async function listChatLogs(env, { page = 1, pageSize = 50, kind = '' } = {}) {
  const size = Math.min(Math.max(Number(pageSize) || 50, 1), 200);
  const k = kind === 'group' || kind === 'c2c' || kind === 'system' ? kind : '';

  const totalRow = k
    ? await env.DB.prepare('SELECT COUNT(*) AS total FROM chat_log WHERE kind = ?1').bind(k).first()
    : await env.DB.prepare('SELECT COUNT(*) AS total FROM chat_log').first();
  const total = Number(totalRow?.total) || 0;

  // 各分类条数（后台筛选按钮上显示）
  const cntRes = await env.DB.prepare('SELECT kind, COUNT(*) AS c FROM chat_log GROUP BY kind').all();
  const kindCounts = { all: 0, group: 0, c2c: 0, system: 0 };
  for (const row of cntRes.results || []) {
    if (row.kind === 'group' || row.kind === 'c2c' || row.kind === 'system') {
      const n = Number(row.c) || 0;
      kindCounts[row.kind] = n;
      kindCounts.all += n;
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  const offset = (p - 1) * size;

  const res = k
    ? await env.DB.prepare(
        'SELECT * FROM chat_log WHERE kind = ?1 ORDER BY id DESC LIMIT ?2 OFFSET ?3'
      ).bind(k, size, offset).all()
    : await env.DB.prepare(
        'SELECT * FROM chat_log ORDER BY id DESC LIMIT ?1 OFFSET ?2'
      ).bind(size, offset).all();

  const items = (res.results || []).map((r) => ({
    id: r.id,
    time: r.created_at,
    kind: r.kind,
    scopeId: r.scope_id,
    userId: r.user_id,
    userContent: r.user_content,
    aiReply: r.ai_reply,
    model: r.model,
  }));

  return {
    items,
    page: p,
    pageSize: size,
    total,
    totalPages: Math.max(1, Math.ceil(total / size)),
    kind: k || 'all',
    kindCounts,
  };
}

export async function clearChatLogs(env) {
  const res = await env.DB.prepare('DELETE FROM chat_log').run();
  return res.meta?.changes ?? 0;
}

/* ------------------------------ 会话列表 / 完整对话（后台 QQ 风格聊天记录用） ------------------------------ */

/** 每个会话（群聊/私聊）一条：最后一条消息、条数、类型，按最近活跃排序 */
export async function listConversations(env, { limit = 100 } = {}) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT scope_id, MAX(id) AS last_id, COUNT(*) AS n FROM chat_log " +
        "WHERE kind IN ('group','c2c') GROUP BY scope_id ORDER BY last_id DESC LIMIT ?1"
    )
      .bind(Math.min(Math.max(Number(limit) || 100, 1), 200))
      .all();
    const rows = results || [];
    if (!rows.length) return [];
    const ids = rows.map((r) => r.last_id);
    const { results: lastRows } = await env.DB.prepare(
      `SELECT id, kind, scope_id, user_content, ai_reply, model, created_at FROM chat_log WHERE id IN (${ids
        .map(() => '?')
        .join(',')})`
    )
      .bind(...ids)
      .all();
    const byId = new Map((lastRows || []).map((r) => [r.id, r]));
    return rows.map((r) => {
      const last = byId.get(r.last_id) || {};
      return {
        scopeId: r.scope_id,
        kind: last.kind === 'c2c' ? 'c2c' : 'group',
        count: r.n,
        lastAt: last.created_at || '',
        lastUser: last.user_content || '',
        lastReply: last.ai_reply || '',
        lastModel: last.model || null,
      };
    });
  } catch {
    return [];
  }
}

/** 单个会话的完整对话（分页：before 传上一页最小 id，返回按时间升序） */
export async function getConversationMessages(env, scopeId, { before = 0, limit = 50 } = {}) {
  const size = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const { results } = await env.DB.prepare(
    "SELECT id, kind, scope_id, user_content, ai_reply, model, created_at FROM chat_log " +
      "WHERE scope_id = ?1 AND kind IN ('group','c2c') AND id < ?2 ORDER BY id DESC LIMIT ?3"
  )
    .bind(String(scopeId || ''), Number(before) || 999999999, size)
    .all();
  const list = results || [];
  return {
    items: list.reverse().map((r) => ({
      id: r.id,
      kind: r.kind,
      scopeId: r.scope_id,
      userContent: r.user_content,
      aiReply: r.ai_reply,
      model: r.model,
      time: r.created_at,
    })),
    hasMore: list.length === size,
  };
}

/** 系统消息（配置变更 / AI 切换 / 入群欢迎等）的统计 + 最后一条，用于会话列表置顶项 */
export async function systemSummary(env) {
  try {
    const { results } = await env.DB.prepare("SELECT COUNT(*) AS n FROM chat_log WHERE kind = 'system'").all();
    const { results: last } = await env.DB.prepare(
      "SELECT created_at, user_content FROM chat_log WHERE kind = 'system' ORDER BY id DESC LIMIT 1"
    ).all();
    const first = (results && results[0]) || {};
    const tail = (last && last[0]) || null;
    return {
      count: Number(first.n) || 0,
      lastAt: tail ? tail.created_at : '',
      lastText: tail ? tail.user_content : '',
    };
  } catch {
    return { count: 0, lastAt: '', lastText: '' };
  }
}

/** 系统消息分页（按时间升序返回） */
export async function getSystemMessages(env, { before = 0, limit = 50 } = {}) {
  const size = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const { results } = await env.DB.prepare(
    "SELECT id, user_content, created_at FROM chat_log WHERE kind = 'system' AND id < ?1 ORDER BY id DESC LIMIT ?2"
  )
    .bind(Number(before) || 999999999, size)
    .all();
  const list = results || [];
  return {
    items: list.reverse().map((r) => ({ id: r.id, content: r.user_content, time: r.created_at })),
    hasMore: list.length === size,
  };
}

/** 删除整个会话的记录（群聊 / 私聊传 scope 指纹；系统消息传 'system'） */
export async function deleteConversation(env, scopeId) {
  const scope = String(scopeId || '').trim();
  if (!scope) return 0;
  const res = await env.DB.prepare('DELETE FROM chat_log WHERE scope_id = ?1').bind(scope).run();
  return res.meta?.changes ?? 0;
}

/* ------------------------------ 群列表（后台「群管理」用） ------------------------------ */

export async function upsertGroup(env, openid, source) {
  const id = String(openid || '').trim();
  if (!id || id.length > 128) return;
  const now = new Date().toISOString();
  await env.DB.prepare(
    'INSERT INTO groups (openid, source, added_at, last_seen) VALUES (?1, ?2, ?3, ?3) ' +
      'ON CONFLICT(openid) DO UPDATE SET last_seen = excluded.last_seen'
  )
    .bind(id, source === 'manual' ? 'manual' : 'auto', now)
    .run();
}

export async function listGroups(env) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT openid, source, added_at, last_seen FROM groups ORDER BY COALESCE(last_seen, added_at) DESC'
    ).all();
    return results || [];
  } catch {
    return [];
  }
}

export async function removeGroup(env, openid) {
  await env.DB.prepare('DELETE FROM groups WHERE openid = ?1').bind(String(openid || '').trim()).run();
}

/* ------------------------------ 定时提醒（AI 自主任务） ------------------------------ */

export async function addReminder(env, { scopeKey, isC2C, scopeId, dueAt, text, repeatRule }) {
  const now = new Date().toISOString();
  const res = await env.DB.prepare(
    'INSERT INTO reminders (scope_key, is_c2c, scope_id, due_at, text, repeat_rule, status, created_at) ' +
      'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)'
  )
    .bind(
      String(scopeKey || ''),
      isC2C ? 1 : 0,
      String(scopeId || ''),
      String(dueAt || ''),
      String(text || '').slice(0, 500),
      repeatRule || null,
      'pending',
      now
    )
    .run();
  return res.meta?.last_row_id ?? null;
}

export async function listReminders(env, { limit = 100 } = {}) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT id, scope_key, is_c2c, scope_id, due_at, text, repeat_rule, status, created_at, fired_at, last_error " +
        "FROM reminders ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, due_at ASC LIMIT ?1"
    )
      .bind(limit)
      .all();
    return results || [];
  } catch {
    return [];
  }
}

/** 到期待发送的任务（先到先发） */
export async function dueReminders(env, nowIso, limit = 5) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT id, scope_key, is_c2c, scope_id, due_at, text, repeat_rule FROM reminders " +
        "WHERE status = 'pending' AND due_at <= ?1 ORDER BY due_at ASC LIMIT ?2"
    )
      .bind(nowIso, limit)
      .all();
    return results || [];
  } catch {
    return [];
  }
}

/** 抢占一条待发任务，返回 true 表示本实例拿到了（防多个 cron 同时发） */
export async function claimReminder(env, id) {
  const res = await env.DB.prepare(
    "UPDATE reminders SET status = 'sending' WHERE id = ?1 AND status = 'pending'"
  )
    .bind(id)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

export async function finishReminder(env, id, ok, error) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE reminders SET status = ?1, fired_at = ?2, last_error = ?3 WHERE id = ?4"
  )
    .bind(ok ? 'done' : 'failed', now, error || null, id)
    .run();
}

/** 重复任务：到期后顺延到下一次，状态回到 pending */
export async function rescheduleReminder(env, id, nextDue) {
  await env.DB.prepare("UPDATE reminders SET due_at = ?1, status = 'pending', fired_at = ?2 WHERE id = ?3")
    .bind(nextDue, new Date().toISOString(), id)
    .run();
}

export async function cancelReminder(env, id) {
  const res = await env.DB.prepare(
    "UPDATE reminders SET status = 'cancelled' WHERE id = ?1 AND status IN ('pending', 'sending')"
  )
    .bind(id)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}


/* ------------------------------ ���ù�ͼ��D1 �洢������ʱ�Զ����룩 ------------------------------ */

export async function listMemes(env) {
  try {
    const { results } = await env.DB.prepare('SELECT name, description, data FROM memes ORDER BY name').all();
    return results || [];
  } catch {
    return [];
  }
}
