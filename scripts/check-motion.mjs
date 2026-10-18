
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const html = read('../src/html.js');
const css = read('../src/themes/home-css.js');
const deploy = read('../scripts/deploy.mjs');
const cf = read('../scripts/cf.mjs');

let failed = 0;
function check(name, pass) {
  console.log(`  ${pass ? 'OK  ' : 'FAIL'} ${name}`);
  if (!pass) failed++;
}

console.log('动效开关：');
check('页面上没有动效开关按钮', !/fx-toggle|id="fx"/.test(html));
check('CSS 里没有 .fx-toggle 规则', !/\.fx-toggle/.test(css));
check('body 始终渲染 motion 类', /<body class="home motion t-light">/.test(html));
check('主题切换时不会摘掉 motion', /root\.className='home motion'/.test(html));

console.log('\n动效可见性：');
const drift = /@keyframes home-drift\{([\s\S]*?)\n  \}/.exec(css);
const driftX = drift && /translate3d\(\s*(\d+)px/.exec(drift[1]);
check('光晕位移 ≥ 60px', !!driftX && Number(driftX[1]) >= 60);
check('光晕周期 ≤ 20s', /home-drift 1[0-9]s/.test(css));
check('波纹是缩放型涟漪', /@keyframes home-ripple\{[\s\S]*?scale\(/.test(css));
check('波纹分层错开', /home-ripple 4\.5s ease-out infinite \.35s/.test(css));
check('光标闪烁保留', /home-blink/.test(css));

console.log('\n无障碍：');
check('所有循环动效仍在 no-preference 门后', /@media \(prefers-reduced-motion:no-preference\)\{[\s\S]*?home-drift/.test(css));
check('循环动画都挂在 .motion 上', !/(^|\n)\.home \.(glow|wave|caret|float)[^\n]*\{animation:/.test(css));
check('锚点滚动尊重减少动效设置', /prefers-reduced-motion: reduce/.test(html));

console.log('\n部署流程：');
check('部署前打印目标并要确认', /部署目标/.test(deploy) && /确认部署/.test(deploy));
check('回答非 y 时中止且不部署', /已取消，未做任何改动/.test(deploy));
check('提供 --yes 跳过确认', /--yes/.test(deploy));
check('不读取本地密钥文件', !/readFileSync/.test(deploy) && !/existsSync/.test(deploy));
const explicitPuts = deploy.match(/run\(\s*\[\s*'secret'\s*,\s*'put'/g) || [];
check('不执行任何 secret 写入', explicitPuts.length === 0);
check('不引导 wrangler secret put', !/secret put/.test(deploy));
check('密钥只在结尾提醒（不因缺密钥失败）', !/secret', 'list'/.test(deploy) && /ADMIN_TOKEN/.test(deploy));
check('结尾提醒去控制台添加', /Variables and Secrets/.test(deploy));
check('查询账号里的库再决定用哪个', /resolveD1/.test(deploy) && /resolveD1/.test(cf));
check('查重后没库才创建（通用，不需手填 ID）', /d1List\(\)/.test(cf) && /d1Create\(/.test(cf));
check('库 ID 缓存在 .wrangler（不进仓库）', /d1\.json/.test(cf));
check('不再支持 D1_DATABASE_ID 手动指定（自动查找/创建）', !/D1_DATABASE_ID/.test(cf) && !/D1_DATABASE_ID/.test(deploy));
check('部署用生成的配置（含 D1 绑定）', /buildDeployConfig\(/.test(deploy) && /--config/.test(deploy));
check('建表交给 Worker 启动自动完成，不再跑 migrations apply', !/migrations', 'apply'/.test(deploy));
check('生成配置时复用已解析的库 ID', /buildDeployConfig\(\{ dbId \}\)/.test(deploy));
check('生成配置不再需要 migrations_dir', !/migrations_dir/.test(cf));
check('wrangler.toml 里不写死 database_id', !/database_id\s*=\s*"[0-9a-f]{8}-/.test(cf))
check('account_id 可留空并由 wrangler 推断', /PLACEHOLDER_ACCOUNT/.test(deploy));
check('多账号时要求先 setup', /检测到 \$\{n\} 个账号/.test(deploy));
check('已删除自动登录', !/api\/auth\/login/.test(deploy));
check('已删除自动启动机器人', !/api\/bot\/start/.test(deploy));
check('已删除 curl 依赖', !/spawnSync\(\s*'curl'/.test(deploy));

console.log('\n占位符安全（防止把 PLACEHOLDER 发给 Cloudflare）：');
check('wrangler 封装里做了占位符遮蔽', /maskAccountPlaceholder/.test(cf));
check('遮蔽在 wrangler() 内部（对所有调用生效）', /export function wrangler[\s\S]{0,200}maskAccountPlaceholder/.test(cf));
check('d1 list 读取 uuid 字段', /d\.uuid/.test(cf));

console.log('\n页面只保留控制台添加方式：');
check('首页不提及 secret put', !/secret put/.test(html));
check('首页/未配置页均不出现 .env.deploy', !/\.env\.deploy/.test(html));
check('未配置页给出控制台路径', /Variables and Secrets/.test(html));
check('未配置页提醒不要更换 CONFIG_ENC_KEY', /不要更换/.test(html));

console.log('\n一键部署入口：');
const pkg = JSON.parse(read('../package.json'));
check('npm run setup 存在', pkg.scripts.setup === 'node scripts/setup.mjs');
check('npm run deploy 存在', pkg.scripts.deploy === 'node scripts/deploy.mjs');
check('npm run check 存在', !!pkg.scripts.check);
check('没有依赖本地 env 文件的脚本', !Object.values(pkg.scripts).some((s) => /\.env\.deploy/.test(s)));

if (failed) {
  console.error(`\n未通过：${failed} 处`);
  process.exit(1);
}
console.log('\n全部通过。');
