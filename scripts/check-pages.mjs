
import { gzipSync } from 'node:zlib';
import { adminPage, homePage, loginPage, setupPage } from '../src/html.js';

const NONCE = 'a1b2c3d4e5f60718';
const REQ_URL = 'https://example.test/';
const pages = [
  ['首页', homePage(NONCE, REQ_URL)],
  ['登录页', loginPage(NONCE)],
  ['后台页', adminPage(NONCE)],
  ['未配置页（全缺）', setupPage(NONCE, ['ADMIN_TOKEN', 'CONFIG_ENC_KEY'])],
  ['未配置页（缺一项）', setupPage(NONCE, ['CONFIG_ENC_KEY'])],
  ['未配置页（全配齐前的空列表）', setupPage(NONCE, [])],
];

const BAD_PATTERNS = [
  [/\sstyle="/g, '内联 style 属性（CSP 会拦掉）'],
  [/\son[a-z]+\s*=/g, '内联事件处理器（CSP 会拦掉）'],
  [/url\((?!['"]?data:)/g, '非 data: 的外部资源引用'],
  [/\$\{/g, '未解析的模板占位符'],
  
  [/\b(?!example\.test)[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:xyz|top|cloud|dev|app|site|online|tech|cc)\b/g, '写死的部署域名'],
];

function badUndefined(html) {
  const markup = html.replace(/<script[\s\S]*?<\/script>/g, '');
  const hits = markup.match(/\bundefined\b/g);
  return hits ? hits.length : 0;
}

let failed = 0;

for (const [name, html] of pages) {
  const problems = [];
  for (const [re, label] of BAD_PATTERNS) {
    const hits = html.match(re);
    if (hits) problems.push(`${label} × ${hits.length}`);
  }
  const undef = badUndefined(html);
  if (undef) problems.push(`页面上渲染出了 undefined × ${undef}`);
  const bytes = Buffer.byteLength(html, 'utf8');
  const gz = gzipSync(html).length;
  const nonceCount = html.split(`nonce="${NONCE}"`).length - 1;

  const status = problems.length ? 'FAIL' : ' OK ';
  console.log(
    `[${status}] ${name}  ${(bytes / 1024).toFixed(1)} KiB（gzip 后 ${(gz / 1024).toFixed(1)} KiB）` +
      `  nonce 出现 ${nonceCount} 次`
  );
  for (const p of problems) {
    console.log(`        - ${p}`);
    failed++;
  }
}

const home = pages[0][1];
const title = home.match(/<title>([^<]*)<\/title>/);
const sections = [...home.matchAll(/<section class="([^"]+)"/g)].map((m) => m[1]);
const headings = [...home.matchAll(/<h([12])[^>]*>([\s\S]*?)<\/h\1>/g)].map(
  (m) => `h${m[1]} ${m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()}`
);
const tiles = (home.match(/class="tile/g) || []).length;
const localAssets = [...home.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1]);

console.log('\n首页结构：');
console.log(`  title    : ${title ? title[1] : '(缺失)'}`);
console.log(`  分节     : ${sections.join(' | ')}`);
console.log(`  卡片数   : ${tiles}`);
console.log('  标题层级 :');
for (const h of headings) console.log(`    ${h}`);
console.log(`  站内链接 : ${[...new Set(localAssets)].join(', ')}`);

const assertions = [
  ['首页默认是白天（t-light）', /<body class="home motion t-light">/.test(home)],
  ['三选一主题开关存在', ['data-theme="system"', 'data-theme="light"', 'data-theme="dark"'].every((s) => home.includes(s))],
  ['默认选中「白天」', /data-theme="light"[^>]*aria-checked="true"/.test(home)],
  ['存在黑夜令牌 .home.dark', /\.home\.dark\{/.test(home)],
  ['存在跟随系统的媒体查询', /@media \(prefers-color-scheme:dark\)/.test(home)],
  ['域名取自请求（example.test/admin）', home.includes('example.test/admin')],
  ['动效开关已移除', !/id="fx"|fx-toggle/.test(home)],
  ['首页始终带 motion 类（默认开启动效）', /<body class="home motion t-light">/.test(home)],
  ['页脚是居中的版权行', /<p class="copyright">[\s\S]*?©[\s\S]*?2026[\s\S]*?QQ Bot<\/p>/.test(home)],
  ['页脚没有残留的导航链接组', !/foot-links|foot-in/.test(home)],
];

const setupAll = pages[3][1]; 
const setupOne = pages[4][1]; 
assertions.push(
  ['未配置页列出两个变量名', setupAll.includes('ADMIN_TOKEN') && setupAll.includes('CONFIG_ENC_KEY')],
  ['标题按 Secret 数量算', setupAll.includes('还差 2 项配置') && setupOne.includes('还差 1 项配置')],
  ['未配置页不再提 D1（不误导用户）', !setupAll.includes('D1 数据库') && !setupOne.includes('D1 数据库')],
  ['未配置页不再出现「待绑定」', !setupAll.includes('待绑定') && !setupOne.includes('待绑定')],
  ['未配置页说明数据库已就绪', setupOne.includes('数据库也已就绪')],
  ['未配置页给出补救步骤', setupAll.includes('Variables and Secrets') && setupAll.includes('Deploy')],
  ['未配置页不再要求手动绑 D1', !setupAll.includes('Bindings') && !setupAll.includes('Variable name 填')],
  ['未配置页说明建表自动完成，不再提 /setup', !setupAll.includes('/setup?token=') && setupAll.includes('自动建好')],
  ['未配置页只认控制台，不提命令行', !setupAll.includes('secret put')],
  ['未配置页不引导本地密钥文件', !setupAll.includes('.env.deploy')],
  ['未配置页不索引', setupAll.includes('name="robots" content="noindex"')],
);

const admin = pages[2][1];
assertions.push(
  ['后台页不索引', admin.includes('name="robots" content="noindex"')],
  ['后台页有顶栏与主区', admin.includes('class="topbar"') && admin.includes('id="main"')],
  ['后台页四个导航入口齐备', ['data-tab="status"', 'data-tab="config"', 'data-tab="ai"', 'data-tab="logs"'].every((s) => admin.includes(s))],
  ['AI 对话是独立页面', admin.includes('id="prov-list"') && admin.includes("GET','/api/ai'")],
  ['AI 列表支持增删与排序', admin.includes('data-act="up"') && admin.includes('data-act="down"') && admin.includes('data-act="del"')],
  ['AI 页面支持逐个拉取模型', admin.includes('providerId:p.hasKey?p.id')],
  ['后台页有深色主题令牌', admin.includes('[data-theme="dark"]')],
  ['后台页有外观切换按钮', admin.includes('id="theme-toggle"')],
  ['后台页不用内联 style 属性承载主题色', !/style="[^"]*background/.test(admin)],
  ['后台页脚本里没有旧版整页重绘的 statusBanner', !admin.includes('statusBanner')],
  ['后台页用的是结构化日志字段', admin.includes('it.level') && admin.includes('it.time')],
  ['后台页自动刷新只增量更新', admin.includes('paintStatus')],
  ['后台页保存栏改为表单内按钮行，不再用 sticky savebar', !admin.includes('savebar') && admin.includes('form-actions')],
  
  ['侧边栏用动态视口高度', /\.side\{[^}]*height:100dvh/.test(admin)],
  ['侧边栏避开安全区', admin.includes('env(safe-area-inset-bottom)')],
  ['导航区可滚动且不被压扁', /\.side-nav\{[^}]*min-height:0/.test(admin) && /\.side-nav\{[^}]*overflow-y:auto/.test(admin)],
  ['底部操作区不被压缩', /\.side-foot\{[^}]*flex:0 0 auto/.test(admin)],
  ['矮窗口下侧边栏会收紧', admin.includes('@media (max-height:520px)')],
);

console.log('\n断言：');
for (const [name, pass] of assertions) {
  console.log(`  ${pass ? 'OK  ' : 'FAIL'} ${name}`);
  if (!pass) failed++;
}

if (failed) {
  console.error(`\n自检未通过：${failed} 处问题`);
  process.exit(1);
}
console.log('\n自检通过。');
