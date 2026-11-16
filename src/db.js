
import { SESSION_TTL_MS, CHAT_LOG_MAX_ROWS } from './constants.js';
import { encryptText, decryptText, isEncrypted, keyFingerprint, maskId } from './utils/crypto.js';

export const CONFIG_FIELDS = {
  appId: { type: 'string', max: 64 },
  secret: { type: 'string', max: 256, secret: true },
  sandbox: { type: 'flag' },
  systemPrompt: { type: 'string', max: 4000 },
  historyLimit: { type: 'int', min: 1, max: 50 },
  groupBlacklist: { type: 'string', max: 4000 },
  sensitiveWords: { type: 'string', max: 4000 },
  markdownReply: { type: 'flag' },
  autoRecall: { type: 'flag' },
  welcomeEnabled: { type: 'flag' },
  welcomeMsg: { type: 'string', max: 4000 },
  imageGenModel: { type: 'string', max: 64 },
  imageGenBaseUrl: { type: 'url', max: 512 },
  imageGenApiKey: { type: 'string', max: 256, secret: true },
  cfChatEnabled: { type: 'flag' },
  cfImageGenEnabled: { type: 'flag' },
  cfVoiceEnabled: { type: 'flag' },
  voiceBaseUrl: { type: 'url', max: 512 },
  voiceApiKey: { type: 'string', max: 256, secret: true },
  voiceModel: { type: 'string', max: 128 },
  voiceSpeaker: { type: 'string', max: 64 },
  toolCalling: { type: 'flag' },
  groupReplyMode: { type: 'string', max: 8 },
  groupContextLen: { type: 'int', min: 1, max: 50 },
  voiceLang: { type: 'string', max: 8 },
  voiceGain: { type: 'string', max: 4 },
  platformMode: { type: 'string', max: 8 },
  webhookVerifiedAt: { type: 'string', max: 32 },
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
    bot_id       TEXT NOT NULL DEFAULT 'default',
    created_at   TEXT NOT NULL,
    kind         TEXT NOT NULL,
    scope_id     TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    user_content TEXT NOT NULL DEFAULT '',
    ai_reply     TEXT NOT NULL DEFAULT '',
    model        TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_chat_log_created ON chat_log (id DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_chat_log_bot ON chat_log (bot_id)`,
  `CREATE TABLE IF NOT EXISTS groups (
    openid    TEXT PRIMARY KEY,
    bot_id    TEXT NOT NULL DEFAULT 'default',
    source    TEXT NOT NULL DEFAULT 'auto',
    added_at  TEXT NOT NULL,
    last_seen TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_groups_bot ON groups (bot_id)`,
  `CREATE TABLE IF NOT EXISTS reminders (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id      TEXT NOT NULL DEFAULT 'default',
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
  `CREATE INDEX IF NOT EXISTS idx_reminders_bot ON reminders (bot_id)`,
  `CREATE TABLE IF NOT EXISTS workspaces (
    scope      TEXT PRIMARY KEY,
    bot_id     TEXT NOT NULL DEFAULT 'default',
    kind       TEXT NOT NULL DEFAULT 'group',
    runs       INTEGER NOT NULL DEFAULT 0,
    tasks      INTEGER NOT NULL DEFAULT 0,
    notes      INTEGER NOT NULL DEFAULT 0,
    last_task  TEXT,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_workspaces_bot ON workspaces (bot_id)`,
  `CREATE TABLE IF NOT EXISTS sandboxes (
    scope      TEXT PRIMARY KEY,
    bot_id     TEXT NOT NULL DEFAULT 'default',
    kind       TEXT NOT NULL DEFAULT 'group',
    runs       INTEGER NOT NULL DEFAULT 0,
    files      INTEGER NOT NULL DEFAULT 0,
    last_task  TEXT,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sandboxes_bot ON sandboxes (bot_id)`,
  `CREATE TABLE IF NOT EXISTS memes (
    name        TEXT PRIMARY KEY,
    description TEXT NOT NULL DEFAULT '',
    data        TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS bots (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL DEFAULT '',
    app_id      TEXT NOT NULL DEFAULT '',
    enabled     INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_bots_app ON bots (app_id)`,
];

async function hasSchema(env) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('config', 'sessions', 'chat_log', 'groups', 'reminders', 'memes', 'workspaces', 'sandboxes', 'bots')`
    ).all();
    const names = new Set((results || []).map((r) => r.name));
    return (
      names.has('config') &&
      names.has('sessions') &&
      names.has('chat_log') &&
      names.has('groups') &&
      names.has('reminders') &&
      names.has('memes') &&
      names.has('workspaces') &&
      names.has('sandboxes') &&
      names.has('bots')
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
      await migrateBotColumns(env).catch(() => {});
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
    // Fresh tables already declare bot_id, but an install whose tables were
    // created by an older version still needs the ALTER path.
    await migrateBotColumns(env).catch(() => {});
    return { ok: true, created: true };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

// Multi-bot: chat log / groups / reminders / workspaces / sandboxes all gain a
// bot_id column so each bot keeps its own history and workspaces. Existing rows
// belong to the default bot, so they stay visible after upgrading.
// Table and column names below are hardcoded literals (never user input), and
// each statement is written out in full so no identifier is interpolated.
const BOT_COLUMN_MIGRATIONS = [
  ['chat_log', 'SELECT bot_id FROM chat_log LIMIT 1',
    "ALTER TABLE chat_log ADD COLUMN bot_id TEXT NOT NULL DEFAULT 'default'",
    'CREATE INDEX IF NOT EXISTS idx_chat_log_bot ON chat_log (bot_id)'],
  ['groups', 'SELECT bot_id FROM groups LIMIT 1',
    "ALTER TABLE groups ADD COLUMN bot_id TEXT NOT NULL DEFAULT 'default'",
    'CREATE INDEX IF NOT EXISTS idx_groups_bot ON groups (bot_id)'],
  ['reminders', 'SELECT bot_id FROM reminders LIMIT 1',
    "ALTER TABLE reminders ADD COLUMN bot_id TEXT NOT NULL DEFAULT 'default'",
    'CREATE INDEX IF NOT EXISTS idx_reminders_bot ON reminders (bot_id)'],
  ['workspaces', 'SELECT bot_id FROM workspaces LIMIT 1',
    "ALTER TABLE workspaces ADD COLUMN bot_id TEXT NOT NULL DEFAULT 'default'",
    'CREATE INDEX IF NOT EXISTS idx_workspaces_bot ON workspaces (bot_id)'],
  ['sandboxes', 'SELECT bot_id FROM sandboxes LIMIT 1',
    "ALTER TABLE sandboxes ADD COLUMN bot_id TEXT NOT NULL DEFAULT 'default'",
    'CREATE INDEX IF NOT EXISTS idx_sandboxes_bot ON sandboxes (bot_id)'],
];

let botColumnsDone = false;
async function migrateBotColumns(env) {
  if (botColumnsDone) return;
  for (const [, probeSql, alterSql, indexSql] of BOT_COLUMN_MIGRATIONS) {
    try {
      await env.DB.prepare(probeSql).all();
    } catch {
      try {
        await env.DB.prepare(alterSql).run();
        await env.DB.prepare(indexSql).run();
      } catch {
        // Table may not exist yet (older install); retry on the next boot.
        return;
      }
    }
  }
  botColumnsDone = true;
}

function upsertConfig(env, key, value, now) {
  return env.DB.prepare(
    'INSERT INTO config (key, value, updated_at) VALUES (?1, ?2, ?3) ' +
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
  ).bind(key, value, now);
}

// Multi-bot config isolation.
// Every bot stores its own keys under "bot:<id>:<field>" in the existing config
// table. Keys without a prefix belong to the legacy single-bot install and are
// treated as the default bot, so upgrading never loses the current settings.
export const DEFAULT_BOT_ID = 'default';
export const MAX_BOTS = 5;
const BOT_KEY_PREFIX = 'bot:';
// Sentinel meaning "every bot" — used by key probing / recovery, not by config reads.
const ALL_BOTS = '__all__';

export function botConfigKey(botId, field) {
  return `${BOT_KEY_PREFIX}${botId || DEFAULT_BOT_ID}:${field}`;
}

function isBotScopedKey(key) {
  return typeof key === 'string' && key.startsWith(BOT_KEY_PREFIX);
}

// Flatten a namespaced key for "__all__" reads so probes can see every secret:
// "bot:abc:secret" -> "secret", "bot:abc:aiProviders" -> "aiProviders".
function stripBotPrefix(key) {
  const rest = key.slice(BOT_KEY_PREFIX.length);
  const i = rest.indexOf(':');
  return i >= 0 ? rest.slice(i + 1) : rest;
}

export async function readRawConfig(env, botId) {
  const { results } = await env.DB.prepare('SELECT key, value FROM config').all();
  const raw = {};
  if ((botId || '') === ALL_BOTS) {
    for (const row of results || []) {
      raw[isBotScopedKey(row.key) ? stripBotPrefix(row.key) : row.key] = row.value;
    }
    return raw;
  }
  const prefix = botConfigKey(botId || DEFAULT_BOT_ID, '');
  for (const row of results || []) {
    const k = row.key;
    if (isBotScopedKey(k)) {
      // Only this bot's namespaced keys
      if (k.startsWith(prefix)) raw[k.slice(prefix.length)] = row.value;
      continue;
    }
    // Legacy unprefixed keys belong to the default bot
    if ((botId || DEFAULT_BOT_ID) === DEFAULT_BOT_ID) raw[k] = row.value;
  }
  return raw;
}

async function decryptSecrets(env, raw, botId) {
  const cfg = { ...raw };
  const legacy = [];
  const bid = botId || DEFAULT_BOT_ID;
  for (const key of SECRET_CONFIG_KEYS) {
    if (!cfg[key]) continue;
    // Values that are not encrypted yet are stored as-is; re-encrypt below.
    if (!isEncrypted(cfg[key])) {
      legacy.push(key);
      continue;
    }
    // The storage key is the AES-GCM AAD. A pre-multi-bot install encrypted
    // with the bare field name ("secret"), which no longer matches, so decryption
    // legitimately fails — surface it loudly instead of silently returning empty
    // credentials (that looked like "AppID/Secret missing" + wrong transport).
    const namespaced = botConfigKey(bid, key);
    let plaintext;
    try {
      plaintext = await decryptText(env, cfg[key], namespaced);
    } catch {
      throw new Error(
        `配置「${key}」无法解密：CONFIG_ENC_KEY 与库里的数据不匹配。` +
          '请到「恢复密钥」页面用管理员密钥验证后重新填写配置。'
      );
    }
    cfg[key] = plaintext;
  }
  if (legacy.length) {
    const now = new Date().toISOString();
    const statements = [];
    for (const key of legacy) {
      const namespaced = botConfigKey(bid, key);
      statements.push(upsertConfig(env, namespaced, await encryptText(env, cfg[key], namespaced), now));
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
    vision: p.vision === '1' || p.vision === 1 ? '1' : p.vision === '0' || p.vision === 0 ? '0' : 'auto',
  };
}

// AI model list is per-bot: each bot keeps its own providers and keys,
// so two bots can point at different models without interfering.
export async function readAiProviders(env, botId) {
  const storageKey = botConfigKey(botId, AI_LIST_KEY);
  let row;
  try {
    row = await env.DB.prepare('SELECT value FROM config WHERE key = ?1').bind(storageKey).first();
  } catch {
    return [];
  }
  if (!row || !row.value) return [];
  let text;
  try {
    text = await decryptText(env, row.value, storageKey);
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

export async function listAiProviders(env, botId) {
  const list = await readAiProviders(env, botId);
  return list.map((p) => ({
    id: p.id,
    name: p.name,
    baseUrl: p.baseUrl,
    model: p.model,
    temperature: p.temperature,
    enabled: p.enabled,
    vision: p.vision,
    hasKey: !!p.apiKey,
  }));
}

export async function getAiProvider(env, id, botId) {
  const list = await readAiProviders(env, botId);
  return list.find((p) => p.id === id) || null;
}

async function migrateLegacyAi(env, cfg, botId) {
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
    const listKey = botConfigKey(botId, AI_LIST_KEY);
    const sealed = await encryptText(env, JSON.stringify([provider]), listKey);
    const now = new Date().toISOString();
    const stmts = [upsertConfig(env, listKey, sealed, now)];
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

export async function saveAiProviders(env, input, botId) {
  if (!Array.isArray(input)) return { ok: false, error: 'AI 列表必须是数组' };
  if (!input.length) return { ok: false, error: '至少保留一个 AI' };
  if (input.length > AI_MAX_PROVIDERS) return { ok: false, error: `最多 ${AI_MAX_PROVIDERS} 个 AI` };

  const existing = await readAiProviders(env, botId);
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
  const listKey = botConfigKey(botId, AI_LIST_KEY);
  const sealed = await encryptText(env, JSON.stringify(out), listKey);
  await env.DB.batch([upsertConfig(env, listKey, sealed, new Date().toISOString())]);
  try {
    await rememberKey(env);
  } catch {

  }
  return { ok: true, saved: out.map((p) => p.id) };
}

export async function getConfig(env, { decrypt = true, botId } = {}) {
  const bid = botId || DEFAULT_BOT_ID;
  const raw = await readRawConfig(env, bid);
  if (!decrypt) return raw;
  const cfg = await decryptSecrets(env, raw, bid);
  cfg.aiProviders = await readAiProviders(env, bid);
  if (!cfg.aiProviders.length && bid === DEFAULT_BOT_ID) await migrateLegacyAi(env, cfg, bid);
  await dropLegacyKeys(env, cfg);
  // "== null" misses the empty string, which is what a legacy DB stores when a
  // flag was never explicitly set. Treat "" as unset so the default "on" holds.
  if (cfg.cfChatEnabled == null || cfg.cfChatEnabled === '') cfg.cfChatEnabled = '1';
  if (cfg.cfImageGenEnabled == null || cfg.cfImageGenEnabled === '') cfg.cfImageGenEnabled = '1';
  if (cfg.cfVoiceEnabled == null || cfg.cfVoiceEnabled === '') cfg.cfVoiceEnabled = '1';
  if (!cfg.groupReplyMode) cfg.groupReplyMode = 'smart';
  if (cfg.groupContextLen == null) cfg.groupContextLen = '20';
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
  let rows;
  try {
    const res = await env.DB.prepare('SELECT key, value FROM config').all();
    rows = res.results || [];
  } catch {
    return { action: 'no-db', key: provided };
  }

  // Collect every encrypted secret-ish value together with the AAD that
  // getConfig would actually use for it. Probing with a DIFFERENT AAD than the
  // read path is what made this report "ok" while getConfig still failed,
  // sending users to a /recover page that simply redirected home.
  const probes = [];
  for (const r of rows) {
    if (r.key === KEY_CHECK_KEY) continue;
    if (!isEncrypted(r.value)) continue;
    const scoped = isBotScopedKey(r.key);
    const field = scoped ? stripBotPrefix(r.key) : r.key;
    if (!SECRET_CONFIG_KEYS.includes(field) && field !== AI_LIST_KEY) continue;
    // Where the value should live, and what AAD the read path uses.
    const botId = scoped ? r.key.slice(BOT_KEY_PREFIX.length, r.key.lastIndexOf(':')) : DEFAULT_BOT_ID;
    probes.push({ row: r, aad: botConfigKey(botId, field) });
  }

  if (!probes.length) {
    if (!provided) return { action: 'nothing', key: '' };
    await rememberKeyQuietly(env, provided);
    return { action: 'recorded', key: provided };
  }

  if (!provided) return { action: 'missing', key: '' };

  // The key is "good" only if EVERY secret decrypts with its expected AAD.
  // A single failure means the config cannot be fully read, so the operator
  // must be sent to /recover.
  for (const p of probes) {
    try {
      await decryptText({ CONFIG_ENC_KEY: provided }, p.row.value, p.aad);
    } catch {
      return { action: 'mismatch', key: '' };
    }
  }

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
    voiceApiKey: !!cfg.voiceApiKey,
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
      return { value: String(value) };
  }
}

export async function saveConfig(env, patch, botId) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return { ok: false, error: '请求体必须是 JSON 对象' };
  }
  const unknown = Object.keys(patch).filter((k) => !CONFIG_KEYS.includes(k));
  if (unknown.length) return { ok: false, error: `未知配置项: ${unknown.join(', ')}` };

  const bid = botId || DEFAULT_BOT_ID;
  const now = new Date().toISOString();
  const statements = [];
  const saved = [];

  for (const [key, raw] of Object.entries(patch)) {
    const result = validateField(key, CONFIG_FIELDS[key], raw);
    if (result.error) return { ok: false, error: result.error };
    if (result.keep) continue;
    const storageKey = botConfigKey(bid, key);
    let value = result.value;
    if (CONFIG_FIELDS[key].secret) {
      try {
        value = await encryptText(env, value, storageKey);
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }
    statements.push(upsertConfig(env, storageKey, value, now));
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
  const { results } = await env.DB.prepare('SELECT key, value FROM config').all();
  const keys = [];
  for (const row of results || []) {
    if (row.key === KEY_CHECK_KEY || isEncrypted(row.value)) keys.push(row.key);
  }
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

export async function addChatLog(env, entry) {  const isSystem = entry.kind === 'system';
  const [scopeKey, userKey] = await Promise.all([
    isSystem ? 'system' : maskId(entry.scopeId),
    isSystem ? '' : maskId(entry.userId),
  ]);

  await env.DB.prepare(
    'INSERT INTO chat_log (created_at, kind, scope_id, user_id, user_content, ai_reply, model, bot_id) ' +
      'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)'
  )
    .bind(
      entry.time || new Date().toISOString(),
      entry.kind,
      scopeKey,
      userKey,
      String(entry.userContent ?? '').slice(0, 4000),
      String(entry.aiReply ?? '').slice(0, 4000),
      entry.model || null,
      entry.botId || DEFAULT_BOT_ID
    )
    .run();

  if ((Math.random() * 32) < 1) {
    await env.DB.prepare(
      'DELETE FROM chat_log WHERE id <= (SELECT MAX(id) FROM chat_log) - ?1'
    )
      .bind(CHAT_LOG_MAX_ROWS)
      .run();
  }
}

export async function listChatLogs(env, { page = 1, pageSize = 50, kind = '', botId } = {}) {
  const size = Math.min(Math.max(Number(pageSize) || 50, 1), 200);
  const k = kind === 'group' || kind === 'c2c' || kind === 'system' ? kind : '';
  const bid = botId || DEFAULT_BOT_ID;

  const totalRow = k
    ? await env.DB.prepare('SELECT COUNT(*) AS total FROM chat_log WHERE bot_id = ?1 AND kind = ?2').bind(bid, k).first()
    : await env.DB.prepare('SELECT COUNT(*) AS total FROM chat_log WHERE bot_id = ?1').bind(bid).first();
  const total = Number(totalRow?.total) || 0;

  const cntRes = await env.DB.prepare('SELECT kind, COUNT(*) AS c FROM chat_log WHERE bot_id = ?1 GROUP BY kind').bind(bid).all();
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
        'SELECT * FROM chat_log WHERE bot_id = ?1 AND kind = ?2 ORDER BY id DESC LIMIT ?3 OFFSET ?4'
      ).bind(bid, k, size, offset).all()
    : await env.DB.prepare(
        'SELECT * FROM chat_log WHERE bot_id = ?1 ORDER BY id DESC LIMIT ?2 OFFSET ?3'
      ).bind(bid, size, offset).all();

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


export async function listConversations(env, { limit = 100, botId } = {}) {
  try {
    const bid = botId || DEFAULT_BOT_ID;
    const { results } = await env.DB.prepare(
      "SELECT scope_id, MAX(id) AS last_id, COUNT(*) AS n FROM chat_log " +
        "WHERE bot_id = ?1 AND kind IN ('group','c2c') GROUP BY scope_id ORDER BY last_id DESC LIMIT ?2"
    )
      .bind(bid, Math.min(Math.max(Number(limit) || 100, 1), 200))
      .all();
    const rows = results || [];
    if (!rows.length) return [];
    const ids = rows.map((r) => r.last_id);
    const { results: lastRows } = await env.DB.prepare(
      `SELECT id, kind, scope_id, user_content, ai_reply, model, created_at FROM chat_log WHERE bot_id = ?1 AND id IN (${ids
        .map(() => '?')
        .join(',')})`
    )
      .bind(bid, ...ids)
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

export async function getConversationMessages(env, scopeId, { before = 0, limit = 50, botId } = {}) {
  const size = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const bid = botId || DEFAULT_BOT_ID;
  const { results } = await env.DB.prepare(
    "SELECT id, kind, scope_id, user_content, ai_reply, model, created_at FROM chat_log " +
      "WHERE bot_id = ?1 AND scope_id = ?2 AND kind IN ('group','c2c') AND id < ?3 ORDER BY id DESC LIMIT ?4"
  )
    .bind(bid, String(scopeId || ''), Number(before) || 999999999, size)
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

export async function systemSummary(env, botId) {
  try {
    const bid = botId || DEFAULT_BOT_ID;
    const { results } = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM chat_log WHERE bot_id = ?1 AND kind = 'system'"
    ).bind(bid).all();
    const { results: last } = await env.DB.prepare(
      "SELECT created_at, user_content FROM chat_log WHERE bot_id = ?1 AND kind = 'system' ORDER BY id DESC LIMIT 1"
    ).bind(bid).all();
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

export async function getSystemMessages(env, { before = 0, limit = 50, botId } = {}) {
  const size = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const bid = botId || DEFAULT_BOT_ID;
  const { results } = await env.DB.prepare(
    "SELECT id, user_content, created_at FROM chat_log WHERE bot_id = ?1 AND kind = 'system' AND id < ?2 ORDER BY id DESC LIMIT ?3"
  )
    .bind(bid, Number(before) || 999999999, size)
    .all();
  const list = results || [];
  return {
    items: list.reverse().map((r) => ({ id: r.id, content: r.user_content, time: r.created_at })),
    hasMore: list.length === size,
  };
}

export async function deleteConversation(env, scopeId, botId) {
  const scope = String(scopeId || '').trim();
  if (!scope) return 0;
  const bid = botId || DEFAULT_BOT_ID;
  const res = await env.DB.prepare(
    'DELETE FROM chat_log WHERE bot_id = ?1 AND scope_id = ?2'
  ).bind(bid, scope).run();
  return res.meta?.changes ?? 0;
}


export async function upsertGroup(env, openid, source, botId) {
  const id = String(openid || '').trim();
  if (!id || id.length > 128) return;
  const now = new Date().toISOString();
  await env.DB.prepare(
    'INSERT INTO groups (openid, source, added_at, last_seen, bot_id) VALUES (?1, ?2, ?3, ?3, ?4) ' +
      'ON CONFLICT(openid) DO UPDATE SET last_seen = excluded.last_seen, bot_id = excluded.bot_id'
  )
    .bind(id, source === 'manual' ? 'manual' : 'auto', now, botId || DEFAULT_BOT_ID)
    .run();
}

export async function listGroups(env, botId) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT openid, source, added_at, last_seen FROM groups WHERE bot_id = ?1 ORDER BY COALESCE(last_seen, added_at) DESC'
    ).bind(botId || DEFAULT_BOT_ID).all();
    return results || [];
  } catch {
    return [];
  }
}

export async function removeGroup(env, openid) {
  await env.DB.prepare('DELETE FROM groups WHERE openid = ?1').bind(String(openid || '').trim()).run();
}


export async function addReminder(env, { scopeKey, isC2C, scopeId, dueAt, text, repeatRule, botId }) {
  const now = new Date().toISOString();
  const bid = botId || DEFAULT_BOT_ID;
  const res = await env.DB.prepare(
    'INSERT INTO reminders (bot_id, scope_key, is_c2c, scope_id, due_at, text, repeat_rule, status, created_at) ' +
      'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)'
  )
    .bind(
      bid,
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

export async function listReminders(env, { limit = 100, botId } = {}) {
  try {
    const bid = botId || DEFAULT_BOT_ID;
    const { results } = await env.DB.prepare(
      "SELECT id, bot_id, scope_key, is_c2c, scope_id, due_at, text, repeat_rule, status, created_at, fired_at, last_error " +
        "FROM reminders WHERE bot_id = ?1 ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, due_at ASC LIMIT ?2"
    )
      .bind(bid, limit)
      .all();
    return results || [];
  } catch {
    return [];
  }
}

export async function dueReminders(env, nowIso, limit = 5, botId) {
  try {
    const bid = botId || DEFAULT_BOT_ID;
    const { results } = await env.DB.prepare(
      "SELECT id, bot_id, scope_key, is_c2c, scope_id, due_at, text, repeat_rule FROM reminders " +
        "WHERE bot_id = ?1 AND status = 'pending' AND due_at <= ?2 ORDER BY due_at ASC LIMIT ?3"
    )
      .bind(bid, nowIso, limit)
      .all();
    return results || [];
  } catch {
    return [];
  }
}

export async function nextReminderDue(env, botId) {
  try {
    const bid = botId || DEFAULT_BOT_ID;
    const row = await env.DB.prepare(
      "SELECT due_at FROM reminders WHERE bot_id = ?1 AND status = 'pending' ORDER BY due_at ASC LIMIT 1"
    )
      .bind(bid)
      .first();
    return row && row.due_at ? String(row.due_at) : null;
  } catch {
    return null;
  }
}

export async function claimReminder(env, id, botId) {
  const bid = botId || DEFAULT_BOT_ID;
  const res = await env.DB.prepare(
    "UPDATE reminders SET status = 'sending' WHERE id = ?1 AND bot_id = ?2 AND status = 'pending'"
  )
    .bind(id, bid)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

export async function finishReminder(env, id, ok, error, botId) {
  const now = new Date().toISOString();
  const bid = botId || DEFAULT_BOT_ID;
  await env.DB.prepare(
    "UPDATE reminders SET status = ?1, fired_at = ?2, last_error = ?3 WHERE id = ?4 AND bot_id = ?5"
  )
    .bind(ok ? 'done' : 'failed', now, error || null, id, bid)
    .run();
}

export async function rescheduleReminder(env, id, nextDue, botId) {
  const bid = botId || DEFAULT_BOT_ID;
  await env.DB.prepare(
    "UPDATE reminders SET due_at = ?1, status = 'pending', fired_at = ?2 WHERE id = ?3 AND bot_id = ?4"
  )
    .bind(nextDue, new Date().toISOString(), id, bid)
    .run();
}

export async function cancelReminder(env, id, botId) {
  const bid = botId || DEFAULT_BOT_ID;
  const res = await env.DB.prepare(
    "UPDATE reminders SET status = 'cancelled' WHERE id = ?1 AND bot_id = ?2 AND status IN ('pending', 'sending')"
  )
    .bind(id, bid)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

export async function deleteReminders(env, ids, botId) {
  const nums = (Array.isArray(ids) ? ids : [])
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (!nums.length) return 0;
  const bid = botId || DEFAULT_BOT_ID;
  const res = await env.DB.prepare(
    `DELETE FROM reminders WHERE bot_id = ? AND id IN (${nums
      .map(() => '?')
      .join(',')})`
  )
    .bind(bid, ...nums)
    .run();
  return res.meta?.changes ?? 0;
}


export async function listMemes(env) {
  try {
    const { results } = await env.DB.prepare('SELECT name, description, data FROM memes ORDER BY name').all();
    return results || [];
  } catch {
    return [];
  }
}

export async function upsertWorkspace(env, { scope, kind, runs, tasks, notes, lastTask, updatedAt, botId }) {
  const now = new Date(updatedAt || Date.now()).toISOString();
  await env.DB.prepare(
    `INSERT INTO workspaces (scope, kind, runs, tasks, notes, last_task, updated_at, bot_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
     ON CONFLICT(scope) DO UPDATE SET
       kind = excluded.kind, runs = excluded.runs, tasks = excluded.tasks,
       notes = excluded.notes, last_task = excluded.last_task, updated_at = excluded.updated_at,
       bot_id = excluded.bot_id`
  )
    .bind(String(scope).slice(0, 120), String(kind || 'group'), Number(runs) || 0, Number(tasks) || 0, Number(notes) || 0, String(lastTask || '').slice(0, 120), now, botId || botIdFromScope(scope))
    .run();
}

export async function listWorkspaces(env, botId) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT scope, kind, runs, tasks, notes, last_task, updated_at FROM workspaces WHERE bot_id = ?1 ORDER BY updated_at DESC LIMIT 200'
    ).bind(botId || DEFAULT_BOT_ID).all();
    return results || [];
  } catch {
    return [];
  }
}

export async function deleteWorkspace(env, scope) {
  try {
    await env.DB.prepare('DELETE FROM workspaces WHERE scope = ?1').bind(scope).run();
    return true;
  } catch {
    return false;
  }
}


// Owner keys for non-default bots look like "bot:<botId>:<scope>", so the bot
// id can be recovered without threading it through every internal call.
export function botIdFromScope(scope) {
  const m = /^bot:([^:]+):/.exec(String(scope || ''));
  return m ? m[1] : DEFAULT_BOT_ID;
}

export async function getSandbox(env, scope, botId) {
  try {
    return (
      (await env.DB.prepare(
        'SELECT scope, kind, runs, files, last_task, updated_at FROM sandboxes WHERE scope = ?1 AND bot_id = ?2'
      )
        .bind(String(scope), botId || botIdFromScope(scope))
        .first()) || null
    );
  } catch {
    return null;
  }
}

export async function upsertSandbox(env, { scope, kind, runs, files, lastTask, updatedAt, botId }) {
  const now = new Date(updatedAt || Date.now()).toISOString();
  const bid = botId || botIdFromScope(scope);
  await env.DB.prepare(
    `INSERT INTO sandboxes (scope, kind, runs, files, last_task, updated_at, bot_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
     ON CONFLICT(scope) DO UPDATE SET
       kind = excluded.kind, runs = excluded.runs, files = excluded.files,
       last_task = excluded.last_task, updated_at = excluded.updated_at,
       bot_id = excluded.bot_id`
  )
    .bind(String(scope).slice(0, 120), String(kind || 'group'), Number(runs) || 0, Number(files) || 0, String(lastTask || '').slice(0, 120), now, bid)
    .run();
}

export async function listSandboxes(env, botId) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT scope, kind, runs, files, last_task, updated_at FROM sandboxes WHERE bot_id = ?1 ORDER BY updated_at DESC LIMIT 200'
    ).bind(botId || DEFAULT_BOT_ID).all();
    return results || [];
  } catch {
    return [];
  }
}

export async function deleteSandbox(env, scope) {
  try {
    await env.DB.prepare('DELETE FROM sandboxes WHERE scope = ?1').bind(scope).run();
    return true;
  } catch {
    return false;
  }
}

// ── Multi-bot management ──────────────────────────────────────────────
// QQ allows at most 5 bots per individual developer account, so the same cap
// is enforced here. Every bot keeps its own config namespace + DO instance.

function normalizeBotRow(row) {
  if (!row) return null;
  return {
    id: String(row.id || ''),
    name: String(row.name || ''),
    appId: String(row.app_id || ''),
    enabled: row.enabled === 0 ? 0 : 1,
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

export async function listBots(env) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT id, name, app_id, enabled, created_at, updated_at FROM bots ORDER BY created_at ASC'
    ).all();
    return (results || []).map(normalizeBotRow);
  } catch {
    return [];
  }
}

export async function getBot(env, id) {
  const bid = String(id || '').trim();
  if (!bid) return null;
  try {
    const row = await env.DB.prepare(
      'SELECT id, name, app_id, enabled, created_at, updated_at FROM bots WHERE id = ?1'
    ).bind(bid).first();
    return normalizeBotRow(row);
  } catch {
    return null;
  }
}

export async function countBots(env) {
  try {
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM bots').first();
    return Number(row && row.n) || 0;
  } catch {
    return 0;
  }
}

export function newBotId() {
  return 'bot-' + randomHex(6);
}

export async function createBot(env, { name, appId, secret }) {
  const total = await countBots(env);
  if (total >= MAX_BOTS) {
    return { ok: false, error: `最多只能添加 ${MAX_BOTS} 个机器人（QQ 个人开发者上限）` };
  }
  const cleanName = String(name || '').trim().slice(0, 40);
  const cleanAppId = String(appId || '').trim().slice(0, 64);
  if (!cleanName) return { ok: false, error: '请填写机器人名称' };
  if (!cleanAppId) return { ok: false, error: '请填写 QQ AppID' };
  if (!/^\d{6,32}$/.test(cleanAppId)) {
    return { ok: false, error: 'AppID 应该是 6~32 位数字' };
  }
  const dup = await env.DB.prepare('SELECT id FROM bots WHERE app_id = ?1').bind(cleanAppId).first().catch(() => null);
  if (dup) return { ok: false, error: '这个 AppID 已经添加过了' };

  const id = newBotId();
  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      'INSERT INTO bots (id, name, app_id, enabled, created_at, updated_at) VALUES (?1, ?2, ?3, 1, ?4, ?4)'
    ).bind(id, cleanName, cleanAppId, now).run();
  } catch (e) {
    return { ok: false, error: `创建失败：${e.message}` };
  }
  // Seed this bot's own credential fields (never shares the default bot's).
  const patch = { appId: cleanAppId };
  if (secret) patch.secret = String(secret);
  const saved = await saveConfig(env, patch, id);
  if (!saved.ok) {
    await env.DB.prepare('DELETE FROM bots WHERE id = ?1').bind(id).run().catch(() => {});
    return { ok: false, error: saved.error };
  }
  return { ok: true, bot: await getBot(env, id) };
}

export async function updateBot(env, id, { name, enabled }) {
  const bot = await getBot(env, id);
  if (!bot) return { ok: false, error: '机器人不存在' };
  const now = new Date().toISOString();
  const nextName = name != null ? String(name).trim().slice(0, 40) : bot.name;
  if (!nextName) return { ok: false, error: '名称不能为空' };
  const nextEnabled = enabled == null ? bot.enabled : enabled ? 1 : 0;
  try {
    await env.DB.prepare('UPDATE bots SET name = ?1, enabled = ?2, updated_at = ?3 WHERE id = ?4')
      .bind(nextName, nextEnabled, now, bot.id).run();
    return { ok: true, bot: await getBot(env, id) };
  } catch (e) {
    return { ok: false, error: `更新失败：${e.message}` };
  }
}

export async function deleteBot(env, id) {
  const bid = String(id || '').trim();
  if (!bid) return { ok: false, error: '缺少机器人 id' };
  if (bid === DEFAULT_BOT_ID) return { ok: false, error: '默认机器人不能删除' };
  const bot = await getBot(env, bid);
  if (!bot) return { ok: false, error: '机器人不存在' };
  try {
    await env.DB.prepare('DELETE FROM bots WHERE id = ?1').bind(bot.id).run();
    // Remove every config key belonging to this bot so nothing leaks.
    const prefix = botConfigKey(bot.id, '');
    const stmts = [
      env.DB.prepare('DELETE FROM config WHERE key LIKE ?1').bind(`${prefix}%`),
      // Drop this bot's data rows too. Pending reminders in particular would
      // otherwise linger forever, since the bot's DO never runs again.
      env.DB.prepare('DELETE FROM reminders WHERE bot_id = ?1').bind(bot.id),
      env.DB.prepare('DELETE FROM chat_log WHERE bot_id = ?1').bind(bot.id),
      env.DB.prepare('DELETE FROM groups WHERE bot_id = ?1').bind(bot.id),
      env.DB.prepare('DELETE FROM workspaces WHERE bot_id = ?1').bind(bot.id),
      env.DB.prepare('DELETE FROM sandboxes WHERE bot_id = ?1').bind(bot.id),
    ];
    for (const st of stmts) {
      // A fresh install may not have every table yet; skip those quietly.
      try {
        await st.run();
      } catch {
        /* table not created yet */
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `删除失败：${e.message}` };
  }
}

// Resolve which bot a webhook/event belongs to, by AppID.
export async function findBotByAppId(env, appId) {
  const clean = String(appId || '').trim();
  if (!clean) return null;
  try {
    const row = await env.DB.prepare(
      'SELECT id, name, app_id, enabled, created_at, updated_at FROM bots WHERE app_id = ?1'
    ).bind(clean).first();
    return normalizeBotRow(row);
  } catch {
    return null;
  }
}
