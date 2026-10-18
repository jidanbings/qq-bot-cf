
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CONFIG_FILE = 'wrangler.toml';
export const PLACEHOLDER_ACCOUNT = 'PLACEHOLDER_ACCOUNT_ID';
export const PLACEHOLDER_D1 = 'PLACEHOLDER_D1_ID';

const isWindows = process.platform === 'win32';
const npx = isWindows ? 'npx.cmd' : 'npx';

export function maskAccountPlaceholder() {
  const raw = readFileSync(resolve(ROOT, CONFIG_FILE), 'utf8');
  const re = /^(\s*)account_id(\s*=\s*)"[^"]*"/m;
  const m = re.exec(raw);
  if (!m) return () => {};
  const value = /"([^"]*)"/.exec(m[0])?.[1] || '';
  const isPlaceholder = !value || value.startsWith('PLACEHOLDER_');
  if (!isPlaceholder) return () => {};

  writeFileSync(resolve(ROOT, CONFIG_FILE), raw.replace(re, '$1# account_id 留空由 wrangler 推断（setup 会填回）'));
  return () => writeFileSync(resolve(ROOT, CONFIG_FILE), raw);
}

export const DEPLOY_CONFIG_FILE = '.wrangler/deploy.toml';

export const D1_CACHE_FILE = '.wrangler/d1.json';
export const DB_NAME = 'qq-bot-db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readCachedD1() {
  try {
    const data = JSON.parse(readFileSync(resolve(ROOT, D1_CACHE_FILE), 'utf8'));
    return UUID_RE.test(data.database_id || '') ? data : null;
  } catch {
    return null;
  }
}

function writeCachedD1(id, name) {
  const target = resolve(ROOT, D1_CACHE_FILE);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify({ name, database_id: id }, null, 2));
}

export function resolveD1({ log = () => {} } = {}) {
  const list = d1List();
  if (list === null) {
    throw new Error(
      '无法读取 D1 数据库列表（wrangler d1 list 失败）。\n' +
        '  请确认已登录且凭据有 D1 权限：npx wrangler whoami'
    );
  }

  const cached = readCachedD1();
  if (cached && list.some((d) => d.id === cached.database_id)) {
    log(`  复用上次部署的库 ${cached.name || DB_NAME}: ${cached.database_id}`);
    return cached.database_id;
  }

  const existing = list.find((d) => d.name === DB_NAME);
  if (existing) {
    log(`  复用账号里已有的库 ${DB_NAME}: ${existing.id}`);
    writeCachedD1(existing.id, DB_NAME);
    return existing.id;
  }

  log(`  账号里没有 ${DB_NAME}，正在创建...`);
  const created = d1Create(DB_NAME);
  if (!created.ok) {
    throw new Error(`创建 D1 失败：\n${created.text.trim()}\n\n可手动执行 npx wrangler d1 create ${DB_NAME}`);
  }
  log(`  已创建: ${created.id}`);
  writeCachedD1(created.id, DB_NAME);
  return created.id;
}

export function buildDeployConfig({ dbId, log } = {}) {
  const id = dbId || resolveD1({ log });

  const template = readFileSync(resolve(ROOT, CONFIG_FILE), 'utf8');
  
  const cleaned = template.replace(/^\[\[d1_databases\]\][\s\S]*?(?=^\[|^\[\[|\z)/gm, '');

  const mainRe = /^(\s*)main(\s*=\s*)"([^"]*)"/m;
  const mainMatch = mainRe.exec(cleaned);
  const mainRel = mainMatch ? mainMatch[3] : 'src/worker.js';
  const fixedMain = cleaned.replace(mainRe, `$1main$2"../${mainRel}"`);

  const d1 = [
    '# ↓ 由 scripts/cf.mjs 在部署时自动生成（含本账号的 database_id，不进仓库）',
    '# 建表由 Worker 启动时自动幂等完成，这里不需要迁移目录。',
    '[[d1_databases]]',
    'binding = "DB"',
    `database_name = "${DB_NAME}"`,
    `database_id = "${id}"`,
    '',
  ].join('\n');

  const out = `${fixedMain.trimEnd()}\n\n${d1}`;
  const target = resolve(ROOT, DEPLOY_CONFIG_FILE);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, out);
  return DEPLOY_CONFIG_FILE;
}

export function wrangler(args, { capture = false, input } = {}) {
  const restore = maskAccountPlaceholder();
  try {
    const res = spawnSync(npx, ['wrangler', ...args], {
      cwd: ROOT,
      stdio: capture
        ? ['pipe', 'pipe', 'pipe']
        : [input === undefined ? 'inherit' : 'pipe', 'inherit', 'inherit'],
      input,
      encoding: 'utf8',
      shell: isWindows,
    });
    return { ok: res.status === 0, status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
  } finally {
    restore();
  }
}

export function whoami() {
  const res = wrangler(['whoami', '--json'], { capture: true });
  if (!res.ok) return null;
  try {
    const info = JSON.parse(res.stdout);
    return info && info.loggedIn ? info : null;
  } catch {
    return null;
  }
}

export function d1List() {
  const res = wrangler(['d1', 'list', '--json'], { capture: true });
  if (!res.ok) return null;
  try {
    const list = JSON.parse(res.stdout);
    if (!Array.isArray(list)) return null;
    return list.map((d) => ({
      id: d.uuid || d.database_id || d.id || '',
      name: d.name || '',
    }));
  } catch {
    return null;
  }
}

export function d1Create(name) {
  const res = wrangler(['d1', 'create', name], { capture: true });
  const text = `${res.stdout}\n${res.stderr}`;
  const m = /"?uuid"?\s*[:=]\s*"([0-9a-f-]{36})"/i.exec(text) || /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(text);
  if (!res.ok || !m) return { ok: false, id: null, text };
  return { ok: true, id: m[1], text };
}

export function readConfig() {
  return readFileSync(resolve(ROOT, CONFIG_FILE), 'utf8');
}

export function writeConfig(text) {
  writeFileSync(resolve(ROOT, CONFIG_FILE), text);
}

export function setConfigValue(text, key, value) {
  const re = new RegExp(`^(\\s*${key}\\s*=\\s*)"[^"]*"`, 'm');
  if (!re.test(text)) return null;
  return text.replace(re, `$1"${value}"`);
}

export function getConfigValue(text, key) {
  const re = new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, 'm');
  const m = re.exec(text);
  return m ? m[1] : null;
}

export function configExists() {
  return existsSync(resolve(ROOT, CONFIG_FILE));
}
