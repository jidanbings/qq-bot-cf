
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT } from './cf.mjs';

const SKIP_DIRS = new Set(['node_modules', '.git', '.wrangler', 'dist', '.output']);
const TEXT_EXT = /\.(js|mjs|cjs|json|toml|md|sql|yml|yaml|html|css|txt|example)$/i;

const SHAPE_RULES = [
  { re: /\b[0-9a-f]{32}\b/gi, what: '疑似 32 位十六进制 ID（account_id）' },
  {
    re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    what: '疑似 UUID（database_id）',
  },
];

const SHAPE_ALLOW = [
  /placeholder|example|xxxx|aaaa|bbbb|dummy|fake|0000000/i,
  /a1b2c3d4e5f60718/, 
  /a1b2c3d4-0000-4000-8000-1234567890ab/, 
  /\b0{8}-0{4}-0{4}-0{4}-0{12}\b/,
];

const PUBLIC_HOSTS = [
  'github.com',
  'developers.cloudflare.com',
  'dash.cloudflare.com',
  'cloudflare.com',
  'workers.dev',
  'opencollective.com',
  'openai.com',
  'api.bot.qq.com',
  'api.sgroup.qq.com',
  'sandbox.api.sgroup.qq.com',
  'qq.com',
  'npmjs.org',
  'nodejs.org',
  'example.com',
  'example.test',
  'example.org',
  'w3.org',
];

const SLD_FALSE_POSITIVE = /^(av|msg|win|el|img|src|nav|box|row|col)\.(me|in|to|it|is|at|be|co)$/i;

const EXTRA = (process.env.CHECK_REPO_EXTRA || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((value) => ({ re: new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), what: '私有值（来自 CHECK_REPO_EXTRA）' }));

const SECRET_VALUE = /(ADMIN_TOKEN|CONFIG_ENC_KEY)\s*["']?\s*[:=]\s*["']?([A-Za-z0-9+/=_-]{16,})/g;

function looksLikeFixture(value) {
  if (/^(x|a|b|y|z|0|1)+$/i.test(value)) return true;
  if (/^(super-secret|test|dummy|fake|example|placeholder|changeme|your-)/i.test(value)) return true;
  if (/^-+$/.test(value)) return true;
  return false;
}

function isPublicHost(host) {
  return PUBLIC_HOSTS.some((h) => host === h || host.endsWith('.' + h));
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

let problems = 0;
const files = walk(ROOT).filter((f) => TEXT_EXT.test(f));
console.log(`扫描 ${files.length} 个文本文件...\n`);

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  if (rel === 'scripts/check-repo.mjs') continue;

  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  const lineOf = (idx) => text.slice(0, idx).split('\n').length;

  for (const { re, what } of SHAPE_RULES) {
    const g = new RegExp(re.source, re.flags);
    let m;
    while ((m = g.exec(text)) !== null) {
      if (SHAPE_ALLOW.some((a) => a.test(m[0]))) continue;
      console.log(`  ✗ ${rel}:${lineOf(m.index)}  含${what}: ${m[0]}`);
      problems++;
    }
  }

  const HOST_RE = /\b((?:[a-z0-9-]+\.)+(?:xyz|top|com|net|org|cn|dev|app|io|me|cc|site|online|tech|cloud))\b/gi;
  let h;
  while ((h = HOST_RE.exec(text)) !== null) {
    const host = h[1].toLowerCase();
    if (isPublicHost(host)) continue;
    if (SLD_FALSE_POSITIVE.test(host)) continue;
    
    if (/\.(js|mjs|json|toml|md|sql|html|css|ts|txt|yml|yaml|example)$/i.test(host)) continue;
    
    if (/xxx|example|placeholder/i.test(host)) continue;
    console.log(`  ✗ ${rel}:${lineOf(h.index)}  含非公共域名: ${host}`);
    problems++;
    if (problems > 50) break;
  }

  SECRET_VALUE.lastIndex = 0;
  let s;
  while ((s = SECRET_VALUE.exec(text)) !== null) {
    if (looksLikeFixture(s[2])) continue;
    console.log(`  ✗ ${rel}:${lineOf(s.index)}  ${s[1]} 疑似被写死（值长 ${s[2].length}）`);
    problems++;
  }

  for (const { re, what } of EXTRA) {
    const g = new RegExp(re.source, 'g');
    let m;
    while ((m = g.exec(text)) !== null) {
      console.log(`  ✗ ${rel}:${lineOf(m.index)}  含${what}`);
      problems++;
    }
  }
}

console.log('');
if (problems) {
  console.error(`发现 ${problems} 处需要清理，先别上传。`);
  process.exit(1);
}
console.log('未发现账号信息或密钥，可以安全上传。');
