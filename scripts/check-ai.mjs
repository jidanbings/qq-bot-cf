import { readFileSync } from 'node:fs';
import {
  getAiProvider,
  getConfig,
  listAiProviders,
  saveAiProviders,
} from '../src/db.js';
import { encryptText } from '../src/utils/crypto.js';
import { QQBotDO } from '../src/qq-bot-do.js';
import { APP_VERSION } from '../src/constants.js';

let failed = 0;

function check(name, ok) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}`);
  if (!ok) failed++;
}

function memoryD1() {
  const config = new Map();
  const tables = new Set(['config', 'sessions', 'chat_log']);
  return {
    config,
    prepare(sql) {
      const stmt = {
        args: [],
        bind(...args) {
          stmt.args = args;
          return stmt;
        },
        async first() {
          if (/SELECT value FROM config WHERE key/.test(sql)) {
            const key = stmt.args[0];
            return config.has(key) ? { value: config.get(key) } : null;
          }
          return null;
        },
        async all() {
          if (/sqlite_master/.test(sql)) {
            return { results: [...tables].map((name) => ({ name })) };
          }
          if (/FROM config/.test(sql)) {
            return { results: [...config].map(([key, value]) => ({ key, value })) };
          }
          return { results: [] };
        },
        async run() {
          if (/INSERT INTO config/.test(sql)) {
            config.set(stmt.args[0], stmt.args[1]);
          } else if (/DELETE FROM config WHERE key/.test(sql)) {
            config.delete(stmt.args[0]);
          } else if (/CREATE TABLE IF NOT EXISTS (\w+)/.test(sql)) {
            tables.add(sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1]);
          }
          return { meta: { changes: 1 } };
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

function fakeBot(providers) {
  const inst = Object.create(QQBotDO.prototype);
  inst.config = { aiProviders: providers, historyLimit: 20 };
  inst.sessions = new Map();
  inst.env = { DB: memoryD1(), CONFIG_ENC_KEY: 'k'.repeat(32) };
  inst.logger = { info() {}, warn() {}, error() {} };
  inst.pruneSessions = function () {};
  inst.sent = null;
  inst.sendReply = async (payload) => {
    inst.sent = payload;
    return true;
  };
  return inst;
}

const KEY = 'k'.repeat(32);

console.log('\n多 AI 保存与读取：');
{
  const env = { DB: memoryD1(), CONFIG_ENC_KEY: KEY };
  const saved = await saveAiProviders(env, [
    { name: '主账号', baseUrl: 'https://a.example.com/v1', apiKey: 'sk-aaa', model: 'gpt-4o', temperature: '0.7', enabled: 1 },
    { name: '备用', baseUrl: 'https://b.example.com/v1', apiKey: 'sk-bbb', model: 'claude', temperature: '1', enabled: 1 },
  ]);
  check('保存两个 AI', saved.ok === true && saved.saved.length === 2);

  const pub = await listAiProviders(env);
  check('列表条数正确', pub.length === 2);
  check('列表不回传明文 Key', JSON.stringify(pub).indexOf('sk-') < 0);
  check('列表标记已设置 Key', pub[0].hasKey === true && pub[1].hasKey === true);
  check('顺序就是保存顺序', pub[0].name === '主账号' && pub[1].name === '备用');

  const stored = [...env.DB.config.values()].join('|');
  check('落库内容整体加密', stored.indexOf('sk-aaa') < 0 && stored.indexOf('enc:v1:') === 0);

  const first = pub[0];
  await saveAiProviders(env, [
    { id: first.id, name: first.name, baseUrl: first.baseUrl, apiKey: '', model: first.model, temperature: first.temperature, enabled: 1 },
  ]);
  const kept = await getAiProvider(env, first.id);
  check('留空 Key 时沿用旧 Key', kept && kept.apiKey === 'sk-aaa');
}

console.log('\n保存校验：');
{
  const env = { DB: memoryD1(), CONFIG_ENC_KEY: KEY };
  check('空列表被拒', (await saveAiProviders(env, [])).ok === false);
  check('非数组被拒', (await saveAiProviders(env, {})).ok === false);
  check('非法 URL 被拒',
    (await saveAiProviders(env, [{ baseUrl: 'ftp://x.test/v1', apiKey: 'k', model: 'm' }])).ok === false);
  check('缺模型被拒',
    (await saveAiProviders(env, [{ baseUrl: 'https://a.test/v1', apiKey: 'k', model: '' }])).ok === false);
  check('缺 Key 被拒',
    (await saveAiProviders(env, [{ baseUrl: 'https://a.test/v1', apiKey: '', model: 'm' }])).ok === false);
  check('Temperature 越界被拒',
    (await saveAiProviders(env, [{ baseUrl: 'https://a.test/v1', apiKey: 'k', model: 'm', temperature: '3' }])).ok === false);
  const many = [];
  for (let i = 0; i < 11; i++) {
    many.push({ baseUrl: `https://a${i}.test/v1`, apiKey: 'k', model: 'm' });
  }
  check('超过 10 个被拒', (await saveAiProviders(env, many)).ok === false);
}

console.log('\n旧版单 AI 配置迁移：');
{
  const db = memoryD1();
  db.config.set('aiBaseUrl', 'https://old.example.com/v1');
  db.config.set('aiApiKey', await encryptText({ CONFIG_ENC_KEY: KEY }, 'sk-old', 'aiApiKey'));
  db.config.set('aiModel', 'old-model');
  db.config.set('aiTemperature', '0.9');
  const env = { DB: db, CONFIG_ENC_KEY: KEY };

  const cfg = await getConfig(env);
  check('迁移成一个 AI', Array.isArray(cfg.aiProviders) && cfg.aiProviders.length === 1);
  check('地址保留', cfg.aiProviders[0].baseUrl === 'https://old.example.com/v1');
  check('Key 解密正确', cfg.aiProviders[0].apiKey === 'sk-old');
  check('模型保留', cfg.aiProviders[0].model === 'old-model');
  check('Temperature 保留', cfg.aiProviders[0].temperature === '0.9');
  check('旧字段已清除', !db.config.has('aiBaseUrl') && !db.config.has('aiApiKey'));
  check('新列表已加密落库', String(db.config.get('aiProviders')).indexOf('enc:v1:') === 0);
}

console.log('\n故障转移：');
{
  const providers = [
    { id: 'a', name: '主', baseUrl: 'https://a.test/v1', apiKey: 'k1', model: 'm1', temperature: '0.8', enabled: 1 },
    { id: 'b', name: '备', baseUrl: 'https://b.test/v1', apiKey: 'k2', model: 'm2', temperature: '0.8', enabled: 1 },
  ];
  const seen = [];
  globalThis.fetch = async (url) => {
    seen.push(String(url));
    if (String(url).indexOf('a.test') >= 0) {
      return new Response('{"error":"boom"}', { status: 500 });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: '来自备用 AI 的回答' } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const bot = fakeBot(providers);
  await bot.processMessage('group:g1', {
    isC2C: false, userId: 'u1', scopeId: 'g1', content: '你好', imageUrl: null, msgId: 'm1',
  });
  check('第一个失败后切到第二个', bot.sent && bot.sent.content === '来自备用 AI 的回答');
  check('第一个重试过再切换', seen.filter((u) => u.indexOf('a.test') >= 0).length === 2);
  check('第二个只被调用一次', seen.filter((u) => u.indexOf('b.test') >= 0).length === 1);

  globalThis.fetch = async () => new Response('{}', { status: 500 });
  bot.sent = null;
  await bot.processMessage('group:g2', {
    isC2C: false, userId: 'u2', scopeId: 'g2', content: '在吗', imageUrl: null, msgId: 'm2',
  });
  check('全部失败时回兜底话术', bot.sent && bot.sent.content.indexOf('出了点小状况') >= 0);

  const offBot = fakeBot([
    { id: 'c', name: '停用', baseUrl: 'https://c.test/v1', apiKey: 'k', model: 'm', temperature: '0.8', enabled: 0 },
  ]);
  await offBot.processMessage('group:g3', {
    isC2C: false, userId: 'u3', scopeId: 'g3', content: '喂', imageUrl: null, msgId: 'm3',
  });
  check('停用的 AI 不参与', offBot.sent === null);

  const emptyBot = fakeBot([]);
  await emptyBot.processMessage('group:g4', {
    isC2C: false, userId: 'u4', scopeId: 'g4', content: '喂', imageUrl: null, msgId: 'm4',
  });
  check('一个 AI 都没有时静默跳过', emptyBot.sent === null);
}

console.log('\n旧字段清理：');
{
  const db = memoryD1();
  const env = { DB: db, CONFIG_ENC_KEY: KEY };
  await saveAiProviders(env, [{ name: 'A', baseUrl: 'https://a.test/v1', apiKey: 'k', model: 'm' }]);
  db.config.set('aiBaseUrl', 'https://old.test/v1');
  db.config.set('aiApiKey', await encryptText(env, 'sk-old', 'aiApiKey'));
  db.config.set('aiModel', 'old-model');
  db.config.set('aiTemperature', '0.5');
  db.config.set('replyAt', '1');

  const cfg = await getConfig(env);
  check('有 AI 列表时旧 AI 字段被清掉',
    !db.config.has('aiBaseUrl') && !db.config.has('aiApiKey') &&
    !db.config.has('aiModel') && !db.config.has('aiTemperature'));
  check('replyAt 残留字段被清掉', !db.config.has('replyAt'));
  check('AI 列表没被旧字段覆盖',
    cfg.aiProviders.length === 1 && cfg.aiProviders[0].baseUrl === 'https://a.test/v1');
  check('返回的配置对象里也没有旧字段',
    !('aiBaseUrl' in cfg) && !('aiApiKey' in cfg) && !('replyAt' in cfg));
}

console.log('\n版本不一致自动让位：');
{
  const inst = Object.create(QQBotDO.prototype);
  inst.generation = 1;
  inst.running = true;
  inst.connecting = false;
  inst.awaitingAck = false;
  inst.seq = 5;
  inst.heartbeatTimer = setInterval(() => {}, 60000);
  inst.reconnectTimer = null;
  inst.ws = null;
  inst.desiredRunning = true;
  inst.retiredFor = null;
  inst.retiredAt = 0;
  inst.logger = { info() {}, warn() {}, error() {} };

  const r1 = await (await inst.fetch(new Request('https://qqbot/ensure?v=9.9.9', { method: 'POST' }))).json();
  check('版本不一致时通知让位', r1.action === 'retire');
  check('让位时停掉连接与心跳', inst.running === false && inst.heartbeatTimer === null);

  const r2 = await (await inst.fetch(new Request('https://qqbot/ensure?v=9.9.9', { method: 'POST' }))).json();
  check('等待新实例期间不重复拉起', r2.action === 'retiring');

  const same = Object.create(QQBotDO.prototype);
  same.desiredRunning = false;
  same.retiredFor = null;
  same.retiredAt = 0;
  same.logger = { info() {}, warn() {}, error() {} };
  const r3 = await (await same.fetch(new Request(`https://qqbot/ensure?v=${APP_VERSION}`, { method: 'POST' }))).json();
  check('版本一致时照常执行', r3.action === 'idle');
}

console.log('\n网关长连接：');
{
  const src = readFileSync(new URL('../src/qq-bot-do.js', import.meta.url), 'utf8');
  check('升级握手用可清除的超时，不会在 10 秒后掐断连接', /clearTimeout\(handshakeTimer\)/.test(src));
  check('WebSocket 升级不再使用 AbortSignal.timeout',
    !/Upgrade:\s*'websocket'[\s\S]{0,120}AbortSignal\.timeout/.test(src));
  check('超时只在握手阶段生效',
    /const handshakeTimer = setTimeout\(\(\) => ac\.abort\(\), 10000\)/.test(src));
}

console.log('');
if (failed) {
  console.log(`有 ${failed} 项未通过。`);
  process.exit(1);
}
console.log('全部通过。');
