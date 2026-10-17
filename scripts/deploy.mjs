
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

function fail(msg) {
  console.error(`\n${msg}\n`);
  process.exit(1);
}

console.log('=== [1/4] 检查项目配置 ===');

if (!configExists()) fail(`找不到 ${CONFIG_FILE}。`);
let config = readConfig();

const workerName = getConfigValue(config, 'name') || 'qq-bot-cf';

const accountId = getConfigValue(config, 'account_id');
if (!accountId || accountId === PLACEHOLDER_ACCOUNT) {
  const info = whoami();
  if (!info) {
    fail('尚未登录 Cloudflare，且配置里没有固定 account_id。\n\n请先执行：\n  npx wrangler login');
  }
  const n = (info.accounts || []).length;
  if (n > 1) {
    fail(`检测到 ${n} 个账号，无法自动决定用哪个。\n\n请运行 npm run setup 选账号，或手动在 ${CONFIG_FILE} 里填 account_id。`);
  }
  console.log(`  account_id 留空，使用当前登录账号: ${info.accounts?.[0]?.name || info.email}`);
} else {
  console.log(`  account_id: ${accountId}`);
}

console.log('\n=== [2/4] 部署目标 ===');
console.log(`  Worker : ${workerName}`);
console.log('  账号   : ' + (getConfigValue(config, 'account_id') || '(当前登录账号)'));
console.log(`  D1     : ${DB_NAME}（自动查找，没有就创建）`);

const interactive = Boolean(process.stdin.isTTY) && !process.env.CI && !process.env.WORKERS_CI;
const SKIP_CONFIRM = process.argv.includes('--yes') || process.argv.includes('-y');

if (!SKIP_CONFIRM && interactive) {
  const rl = createInterface({ input: stdin, output: stdout });
  const ans = (await rl.question('\n  确认部署？(y/N) ')).trim().toLowerCase();
  rl.close();
  if (ans !== 'y' && ans !== 'yes') {
    console.log('\n已取消，未做任何改动。');
    process.exit(0);
  }
  console.log('');
}

console.log('\n=== [3/4] 准备 D1 数据库 ===');

let dbId;
try {
  dbId = resolveD1({ log: (m) => console.log(m) });
} catch (e) {
  fail(e.message);
}

console.log('\n=== [4/4] 生成配置并部署 ===');

let deployConfig;
try {
  deployConfig = buildDeployConfig({ dbId });
} catch (e) {
  fail(e.message);
}
console.log(`  已生成 ${deployConfig}（含 D1 绑定 DB，库 ID 不写进仓库）`);

console.log(`  $ wrangler deploy --config ${deployConfig}`);
const deployed = wrangler(['deploy', '--config', deployConfig]);
if (!deployed.ok) fail('部署失败。');

console.log(`
部署完成。Worker 已上线，数据库表结构也已就绪。

接下来（这三步都在部署之后，不影响本次部署成功与否）：

  1. 添加两个密钥（只需一次）
     Cloudflare 控制台 → Workers & Pages → ${workerName}
     → Settings → Variables and Secrets → Add
     ⚠ 类型必须选「Secret」（加密变量），千万不要选「Text / Plain text」（普通变量）。
       普通变量会在下次 deploy 时被 wrangler 按配置整体覆盖而清空，
       只有 Secret 才会被保留。
       ADMIN_TOKEN      后台登录密码，16 位以上随机串
       CONFIG_ENC_KEY   加密主密钥，16 位以上随机串，加完不要改

  2. 打开后台登录
     访问部署域名下的 /login，密码就是 ADMIN_TOKEN。
     如果看到「尚未完成配置」页面，说明上一步密钥还没加，回去补上。

  3. 填业务配置并启动
     后台「机器人配置」→ 填 QQ AppID / Secret（未上线的机器人开沙箱）
     → 填 AI Base URL / API Key → 拉取模型 → 保存并重启。

业务配置存在 D1 里，以后重新部署不会覆盖。

关于密钥会不会被部署冲掉：wrangler deploy 从来不删 Secret，所以正常的
代码更新不会影响 ADMIN_TOKEN 和 CONFIG_ENC_KEY。只有把整个 Worker 删掉
再重建时 Secret 才会消失，那时 D1 里的数据还在，但需要重新填一次密钥
（CONFIG_ENC_KEY 必须用原来那个值，否则库里已加密的配置解不开）。
`);
