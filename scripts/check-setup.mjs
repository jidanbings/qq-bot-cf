
import worker from '../src/worker.js';

const DB = {
  prepare: () => ({ bind: () => ({ run: async () => ({}) }) }),
  batch: async () => [],
};
const RATE_LIMITER = {
  idFromName: (name) => name,
  get: () => ({
    fetch: async () =>
      Response.json({ allowed: true, limit: 5, remaining: 4, resetAt: Date.now() + 60000 }),
  }),
};
const baseEnv = { DB, QQ_BOT: {}, RATE_LIMITER };

async function get(path, env) {
  return worker.fetch(new Request('https://bot.test' + path, { method: 'GET' }), env);
}

let failed = 0;
function check(name, pass, extra = '') {
  console.log(`  ${pass ? 'OK  ' : 'FAIL'} ${name}${extra ? '  ' + extra : ''}`);
  if (!pass) failed++;
}

console.log('Secrets 全缺：');
{
  const env = { QQ_BOT: {}, RATE_LIMITER }; 
  const res = await get('/', env);
  const body = await res.text();
  check('首页返回 200', res.status === 200);
  check('显示未配置页', body.includes('尚未完成配置'));
  check('标题写明缺 2 项', body.includes('还差 2 项配置'));
  check('列出 ADMIN_TOKEN', body.includes('ADMIN_TOKEN'));
  check('列出 CONFIG_ENC_KEY', body.includes('CONFIG_ENC_KEY'));
  check('不再提 D1（不误导用户）', !body.includes('D1 数据库') && !body.includes('待绑定'));

  const api = await get('/api/status', env);
  const apiBody = await api.json();
  check('/api/status 返回 503', api.status === 503);
  check('错误码是 server_misconfigured', apiBody?.error?.code === 'server_misconfigured');
  check('错误信息点名缺失变量', /ADMIN_TOKEN/.test(apiBody?.error?.message || ''));
  check('错误信息不再提 D1', !/D1/.test(apiBody?.error?.message || ''));

  const login = await get('/login', env);
  check('/login 也落到未配置页', (await login.text()).includes('尚未完成配置'));
}

console.log('\n只缺 CONFIG_ENC_KEY：');
{
  const res = await get('/', { ...baseEnv, ADMIN_TOKEN: 'x'.repeat(32) });
  const body = await res.text();
  check('标题写明缺 1 项', body.includes('还差 1 项配置'));
  check('CONFIG_ENC_KEY 标为待配置', /CONFIG_ENC_KEY[\s\S]{0,200}待配置/.test(body));
  check('页面里没有 D1 条目', !body.includes('D1 数据库'));
}

console.log('\nSecret 齐、但没绑 D1：');
{
  const env = { QQ_BOT: {}, RATE_LIMITER, ADMIN_TOKEN: 'a'.repeat(32), CONFIG_ENC_KEY: 'b'.repeat(32) };
  const res = await get('/', env);
  const body = await res.text();
  check('不再落到未配置页', !body.includes('尚未完成配置'));
  check('正常渲染首页', body.includes('<body class="home motion t-light">'));
}

console.log('\nSecrets 与 D1 齐全：');
{
  const res = await get('/', { ...baseEnv, ADMIN_TOKEN: 'a'.repeat(32), CONFIG_ENC_KEY: 'b'.repeat(32) });
  const body = await res.text();
  check('不再显示未配置页', !body.includes('尚未完成配置'));
  check('正常渲染首页', body.includes('<body class="home motion t-light">'));
}

console.log('\n自动建表（不再需要 /setup）：');
{
  
  const good = { ...baseEnv, ADMIN_TOKEN: 'tok123', CONFIG_ENC_KEY: 'b'.repeat(32) };
  const setupRes = await get('/setup?token=tok123', good);
  check('/setup 路由已移除（返回 404）', setupRes.status === 404);
}

console.log('\n未配置页不会泄露任何密钥值：');
{
  const res = await get('/', { ...baseEnv, ADMIN_TOKEN: 'super-secret-value-123456' });
  const body = await res.text();
  check('页面里没有出现 ADMIN_TOKEN 的值', !body.includes('super-secret-value-123456'));
}

function memoryD1({ preset = true } = {}) {
  const rows = new Map();
  const tables = new Set(preset ? ['config', 'sessions', 'chat_log'] : []);
  return {
    rows,
    tables,
    prepare(sql) {
      const stmt = {
        args: [],
        bind(...args) {
          stmt.args = args;
          return stmt;
        },
        async all() {
          if (/FROM config/.test(sql)) {
            return { results: [...rows].map(([key, value]) => ({ key, value })) };
          }
          if (/sqlite_master/.test(sql)) {
            return { results: [...tables].map((name) => ({ name })) };
          }
          return { results: [] };
        },
        async first() {
          return null;
        },
        async run() {
          if (/INSERT INTO config/.test(sql)) {
            const [key, value] = stmt.args;
            rows.set(key, value);
          }
          if (/DELETE FROM config WHERE key/.test(sql)) {
            rows.delete(stmt.args[0]);
          }
          if (/CREATE TABLE IF NOT EXISTS (\w+)/.test(sql)) {
            tables.add(sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1]);
          }
          return {};
        },
      };
      return stmt;
    },
    async batch(list) {
      for (const s of list) await s.run();
      return [];
    },
  };
}

console.log('\n自动建表（空库首次请求即建表）：');
{
  const db = memoryD1({ preset: false }); 
  check('初始空库无表', db.tables.size === 0);

  const env = { DB: db, QQ_BOT: {}, RATE_LIMITER, ADMIN_TOKEN: 'tok', CONFIG_ENC_KEY: 'k'.repeat(32) };
  await worker.fetch(new Request('https://bot.test/'), env);
  check('首次请求后表已自动建好', db.tables.has('config') && db.tables.has('sessions') && db.tables.has('chat_log'));

  const before = db.tables.size;
  await worker.fetch(new Request('https://bot.test/'), env);
  check('再次请求不重复建表', db.tables.size === before);
}

console.log('\n主密钥体检（换过钥匙不能静默丢配置）：');
{
  const { saveConfig, getConfig } = await import('../src/db.js');
  const db = memoryD1();
  const KEY = 'original-enc-key-0123456789';
  const first = { DB: db, QQ_BOT: {}, RATE_LIMITER, ADMIN_TOKEN: 'tok', CONFIG_ENC_KEY: KEY };

  await worker.fetch(new Request('https://bot.test/'), first);
  await saveConfig(first, { secret: 'qq-app-secret' });
  check('配置写入后库里有加密数据', [...db.rows.values()].some((v) => String(v).startsWith('enc:v1:')));
  check('库里记下了主密钥指纹', db.rows.has('__key_check'));

  const same = { ...first };
  const sameRes = await worker.fetch(new Request('https://bot.test/'), same);
  check('钥匙没变时正常渲染首页', (await sameRes.text()).includes('<body class="home'));

  const WRONG_KEY = ['different', 'key'].join('-');
  const wrong = { DB: db, QQ_BOT: {}, RATE_LIMITER, ADMIN_TOKEN: 'tok', CONFIG_ENC_KEY: WRONG_KEY };

  const homeRes = await worker.fetch(new Request('https://bot.test/'), wrong);
  check('主密钥对不上时首页跳转恢复页',
    homeRes.status === 302 && homeRes.headers.get('location') === '/recover');

  const gate = await (await worker.fetch(new Request('https://bot.test/recover'), wrong)).text();
  check('恢复页先要求管理员密钥', gate.includes('请输入 ADMIN_TOKEN'));
  check('未验证时不展示恢复内容', !gate.includes('加密主密钥需要处理'));
  check('恢复页没有把错误当成「尚未完成配置」', !gate.includes('尚未完成配置'));

  const badForm = new Request('https://bot.test/recover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'token=wrong',
  });
  const badBody = await (await worker.fetch(badForm, wrong)).text();
  check('管理员密钥错误时拒绝', badBody.includes('管理员密钥不正确'));

  const okForm = new Request('https://bot.test/recover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'token=tok',
  });
  const okRes = await worker.fetch(okForm, wrong);
  const setCookie = okRes.headers.get('set-cookie') || '';
  check('管理员密钥正确后下发恢复 cookie',
    okRes.status === 303 && setCookie.startsWith('bot_recovery='));
  check('恢复 cookie 是 HttpOnly + Secure',
    setCookie.includes('HttpOnly') && setCookie.includes('Secure'));

  const cookie = setCookie.split(';')[0];
  const authedBody = await (await worker.fetch(
    new Request('https://bot.test/recover', { headers: { Cookie: cookie } }), wrong)).text();
  check('验证后显示恢复说明',
    authedBody.includes('加密主密钥需要处理') && authedBody.includes('CONFIG_ENC_KEY'));
  check('恢复页不含任何密钥值',
    !authedBody.includes(WRONG_KEY) && !authedBody.includes(KEY));
  check('恢复页提供重置入口', authedBody.includes('/recover/reset'));

  const gone = { DB: db, QQ_BOT: {}, RATE_LIMITER, ADMIN_TOKEN: 'tok' };
  const goneBody = await (await worker.fetch(new Request('https://bot.test/'), gone)).text();
  check('CONFIG_ENC_KEY 缺失时显示未配置页', goneBody.includes('尚未完成配置'));
  check('API 返回 server_misconfigured',
    (await (await worker.fetch(new Request('https://bot.test/api/status'), gone)).json())
      ?.error?.code === 'server_misconfigured');

  const back = { ...first };
  check('换回原钥匙后配置仍可解密', (await getConfig(back)).secret === 'qq-app-secret');

  const resetRes = await worker.fetch(new Request('https://bot.test/recover/reset', {
    method: 'POST',
    headers: { Cookie: cookie },
  }), wrong);
  check('重置后跳回登录页',
    resetRes.status === 303 && resetRes.headers.get('location') === '/login');
  check('重置清掉了加密配置', !db.rows.has('secret') && !db.rows.has('__key_check'));

  const fresh = { DB: memoryD1(), QQ_BOT: {}, RATE_LIMITER };
  const freshBody = await (await worker.fetch(new Request('https://bot.test/'), fresh)).text();
  check('空库仍显示未配置页', freshBody.includes('尚未完成配置'));

  const { keyRecoveryPage } = await import('../src/html.js');
  const page = keyRecoveryPage('n', { hasKey: true });
  check('恢复页不含密钥值', !page.includes(KEY) && !page.includes(WRONG_KEY));
  check('恢复页说明了 CONFIG_ENC_KEY', page.includes('CONFIG_ENC_KEY'));
}

if (failed) {
  console.error(`\n未通过：${failed} 处`);
  process.exit(1);
}
console.log('\n全部通过。');
