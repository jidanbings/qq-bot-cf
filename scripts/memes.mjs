// 内置梗图：图片放仓库 assets/memes/*.jpg + assets/memes.json（名称→描述），
// 部署时自动生成 SQL 导入 D1（不进 Worker 包体）。本地可用 --local 手动导入。
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, DB_NAME, DEPLOY_CONFIG_FILE, wrangler } from './cf.mjs';

const MEME_DIR = resolve(ROOT, 'assets/memes');
const MANIFEST = resolve(ROOT, 'assets/memes.json');
const SQL_FILE = resolve(ROOT, '.wrangler/seed-memes.sql');

const esc = (s) => String(s ?? '').replace(/'/g, "''");

export function memeManifest() {
  return JSON.parse(readFileSync(MANIFEST, 'utf8'));
}

/** 读仓库里的图片，生成「整表替换」的 SQL */
export function buildMemesSql() {
  const manifest = memeManifest();
  const now = new Date().toISOString();
  const lines = [
    'CREATE TABLE IF NOT EXISTS memes (',
    '  name TEXT PRIMARY KEY,',
    '  description TEXT NOT NULL DEFAULT "",',
    '  data TEXT NOT NULL,',
    '  updated_at TEXT NOT NULL',
    ');',
    'DELETE FROM memes;',
  ];
  let count = 0;
  let bytes = 0;
  for (const [name, desc] of Object.entries(manifest)) {
    const jpg = resolve(MEME_DIR, `${name}.jpg`);
    const b64 = readFileSync(jpg).toString('base64');
    bytes += b64.length;
    count++;
    lines.push(
      `INSERT OR REPLACE INTO memes (name, description, data, updated_at) VALUES ('${esc(name)}', '${esc(desc)}', '${b64}', '${now}');`
    );
  }
  return { sql: lines.join('\n'), count, bytes };
}

/** 把梗图导入 D1（默认 --remote；本地开发用 --local） */
export function syncMemes({ local = false } = {}) {
  const { sql, count } = buildMemesSql();
  mkdirSync(resolve(ROOT, '.wrangler'), { recursive: true });
  writeFileSync(SQL_FILE, sql, 'utf8');
  const args = ['d1', 'execute', DB_NAME, '--config', DEPLOY_CONFIG_FILE, '--file', '.wrangler/seed-memes.sql'];
  args.push(local ? '--local' : '--remote');
  const res = wrangler(args, { capture: true });
  rmSync(SQL_FILE, { force: true });
  return { ok: res.ok, count, output: `${res.stdout || ''}${res.stderr || ''}` };
}

// 直接运行：node scripts/memes.mjs [--local]
if (process.argv[1] && process.argv[1].endsWith('memes.mjs')) {
  const local = process.argv.includes('--local');
  console.log(`同步内置梗图到 D1（${local ? '本地' : '线上'}）…`);
  const r = syncMemes({ local });
  console.log(r.ok ? `已完成：${r.count} 张` : `失败：\n${r.output}`);
  process.exit(r.ok ? 0 : 1);
}
