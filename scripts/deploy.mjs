
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import {
  PLACEHOLDER_ACCOUNT,
  DB_NAME,
  buildDeployConfig,
  configExists,
  getConfigValue,
  readConfig,
  resolveD1,
  whoami,
  wrangler,
  CONFIG_FILE,
} from './cf.mjs';
import { syncMemes } from './memes.mjs';

function fail(msg) {
  console.error(`\n${msg}\n`);
  process.exit(1);
}

if (!configExists()) fail(`找不到 ${CONFIG_FILE}。`);
let config = readConfig();

const workerName = getConfigValue(config, 'name') || 'qq-bot-cf';
const accountId = getConfigValue(config, 'account_id');
if (!accountId || accountId === PLACEHOLDER_ACCOUNT) {
  const info = whoami();
  if (!info) fail('未登录 Cloudflare，请先执行：npx wrangler login');
  const n = (info.accounts || []).length;
  if (n > 1) {
    fail(`检测到 ${n} 个账号，请先运行 npm run setup 选账号，或在 ${CONFIG_FILE} 里填 account_id。`);
  }
}

const interactive = Boolean(process.stdin.isTTY) && !process.env.CI && !process.env.WORKERS_CI;
const SKIP_CONFIRM = process.argv.includes('--yes') || process.argv.includes('-y');
console.log(`部署目标：${workerName} → D1 ${DB_NAME}`);
if (!SKIP_CONFIRM && interactive) {
  const rl = createInterface({ input: stdin, output: stdout });
  const ans = (await rl.question('确认部署？(y/N) ')).trim().toLowerCase();
  rl.close();
  if (ans !== 'y' && ans !== 'yes') {
    console.log('已取消，未做任何改动。');
    process.exit(0);
  }
}

let dbId;
try {
  dbId = resolveD1({ log: () => {} });
} catch (e) {
  fail(e.message);
}

let deployConfig;
try {
  deployConfig = buildDeployConfig({ dbId });
} catch (e) {
  fail(e.message);
}

const deployed = wrangler(['deploy', '--config', deployConfig]);
if (!deployed.ok) fail('部署失败。');

// 部署完成后把内置梗图导入 D1（表不存在就建；每次整表替换，幂等）
const memes = syncMemes({ local: false });
if (memes.ok) {
  console.log(`梗图已导入 D1：${memes.count} 张`);
} else {
  console.warn('梗图导入失败（不影响机器人运行；本地可跑 node scripts/memes.mjs 重试）');
}

console.log(`
部署完成 ✅
一次性配置（还没做的话）：
  1. 控制台 → Workers & Pages → ${workerName} → Settings → Variables and Secrets
     加两个 Secret（类型必须选 Secret）：ADMIN_TOKEN（后台密码）、CONFIG_ENC_KEY（加密主密钥）
  2. 打开 https://你的域名/login 登录，填 QQ AppID/Secret 和 AI 配置
业务配置存 D1，重新部署不会覆盖。
`);
