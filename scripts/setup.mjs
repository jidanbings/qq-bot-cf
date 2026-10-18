
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import {
  configExists,
  getConfigValue,
  readConfig,
  resolveD1,
  whoami,
  writeConfig,
  CONFIG_FILE,
} from './cf.mjs';

const interactive = Boolean(process.stdin.isTTY) && !process.env.CI && !process.env.WORKERS_CI;

function die(msg) {
  console.error(`\n${msg}\n`);
  process.exit(1);
}

function ask(question) {
  if (!interactive) {
    die(
      `setup 需要在交互式终端里运行（当前不是）。\n\n` +
        `在 CI 或部署平台里请改用手动配置：\n` +
        `  1. 编辑 ${CONFIG_FILE}，填上 account_id / database_id\n` +
        `  2. 在 Cloudflare 控制台加好 ADMIN_TOKEN 与 CONFIG_ENC_KEY\n` +
        `  3. 直接跑 npm run deploy（它在非交互环境会自动继续）`
    );
  }
  const rl = createInterface({ input: stdin, output: stdout });
  return rl.question(question).finally(() => rl.close());
}

console.log('=== [1/4] 检查 Cloudflare 登录状态 ===');

let info = whoami();
if (!info) {
  die(
    '还没有登录 Cloudflare。请先执行：\n\n' +
      '  npx wrangler login\n\n' +
      '会打开浏览器让你授权。完成后重新运行 npm run setup。'
  );
}
console.log(`  已登录: ${info.email || '(未知邮箱)'}`);

const accounts = info.accounts || [];
if (!accounts.length) die('这个凭据下没有任何账号，无法继续。');

console.log('\n=== [2/4] 选择账号 ===');

let account;
if (accounts.length === 1) {
  account = accounts[0];
  console.log(`  只有 1 个账号，自动使用: ${account.name} (${account.id})`);
} else {
  console.log('  检测到多个账号，请选择：');
  accounts.forEach((a, i) => console.log(`    ${i + 1}. ${a.name}  ${a.id}`));
  const ans = (await ask('  输入序号: ')).trim();
  const idx = Number(ans) - 1;
  if (!Number.isInteger(idx) || idx < 0 || idx >= accounts.length) die('序号无效。');
  account = accounts[idx];
  console.log(`  已选择: ${account.name}`);
}

console.log('\n=== [3/4] 准备 D1 数据库 ===');

if (!configExists()) die(`找不到 ${CONFIG_FILE}，请确认在项目根目录运行。`);

try {
  const dbId = resolveD1({ log: (m) => console.log(m) });
  console.log(`  库 ID: ${dbId}（记在 .wrangler/d1.json，不进仓库）`);
} catch (e) {
  die(e.message);
}

console.log('\n=== [4/4] 自定义域名（可选） ===');
console.log('  没有自己的域名可以直接回车跳过，Worker 会挂在 workers.dev 上，功能完全一样。');
console.log('  注意：域名必须已经在这个 Cloudflare 账号里，且不能在用中，否则会抢现有站点的流量。');

let config = readConfig();
const host = (await ask('  自定义域名（如 bot.example.com，留空跳过）: ')).trim();

if (host) {
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) die(`"${host}" 看起来不是合法域名。`);
  const routeLine = `routes = [\n  { pattern = "${host}", custom_domain = true }\n]`;
  if (/^#?\s*routes\s*=/m.test(config)) {
    config = config.replace(/^#?\s*routes\s*=\s*\[[\s\S]*?\]/m, routeLine);
  } else {
    config = config.replace(/^(compatibility_date\s*=.*)$/m, `$1\n\n${routeLine}`);
  }
  console.log(`  已写入路由: ${host}`);
} else {
  console.log('  已跳过，将使用 workers.dev 域名。');
}

const ACCOUNT_RE = /^(\s*)account_id(\s*=\s*)"[^"]*"/m;
if (ACCOUNT_RE.test(config)) {
  const current = getConfigValue(config, 'account_id');
  if (!current || current.startsWith('PLACEHOLDER_')) {
    config = config.replace(ACCOUNT_RE, `$1account_id$2"${account.id}"`);
  }
} else {
  config = config.replace(/^(name\s*=.*)$/m, `$1\naccount_id = "${account.id}"`);
}

writeConfig(config);
console.log(`\n已更新 ${CONFIG_FILE}（account_id）`);

console.log(`
初始化完成。

下一步（两件事，顺序不能反）：

  1. 到 Cloudflare 控制台添加两个 Secret
     dash.cloudflare.com → Workers & Pages → 找到 qq-bot-cf
     （首次需要先跑一次 npm run deploy 把 Worker 建出来，再回来加 Secret）
     · Settings → Variables and Secrets → Add → 类型选 Secret
     · 加 ADMIN_TOKEN：后台登录密码，16 位以上随机串
     · 加 CONFIG_ENC_KEY：加密主密钥，16 位以上随机串，以后不要更换
     · 加完点 Deploy 让 Secret 生效

  2. 运行 npm run deploy

部署完成后用浏览器打开 /login，密码就是 ADMIN_TOKEN，
进去填 QQ AppID / Secret 与 AI 接口，点「保存并重启」即可。
`);
