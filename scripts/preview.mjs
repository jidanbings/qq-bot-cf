
import { createServer } from 'node:http';
import { adminPage, homePage, loginPage, setupPage } from '../src/html.js';
import { randomHex } from '../src/db.js';

const PORT = Number(process.argv[2]) || 8788;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), microphone=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Cache-Control': 'no-store',
};

function htmlResponse(html, nonce) {
  return {
    ...SECURITY_HEADERS,
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy':
      `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; ` +
      `connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
  };
}

const ROUTES = {
  '/': homePage,
  '/login': loginPage,
  '/admin': adminPage,
  
  '/setup': (nonce, url) => setupPage(nonce, ['ADMIN_TOKEN', 'CONFIG_ENC_KEY']),
};

const DEMO_CONFIG = {
  appId: '102xxxxxx',
  secret: '',
  sandbox: '1',
  systemPrompt: '你是一个友好、靠谱、乐于助人的 QQ 机器人助手。回答保持简洁、自然、口语化，用中文交流。',
  historyLimit: '20',
  groupBlacklist: '',
  sensitiveWords: '广告, 刷屏',
};

const DEMO_PROVIDERS = [
  {
    id: 'ai-demo-1',
    name: '主账号',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    temperature: '0.8',
    enabled: 1,
    hasKey: true,
  },
  {
    id: 'ai-demo-2',
    name: '备用',
    baseUrl: 'https://api.example.com/v1',
    model: 'deepseek-chat',
    temperature: '0.7',
    enabled: 1,
    hasKey: true,
  },
];

const DEMO_STATUS = {
  running: true,
  desiredRunning: true,
  wsState: 1,
  sessionCount: 6,
  tokenValid: true,
  tokenExpiry: Date.now() + 41 * 60 * 1000,
  sessionId: 'a1b2c3d4-0000-4000-8000-1234567890ab',
  identifyFailures: 0,
  fatalStop: null,
  lastClose: { code: 4009, reason: '', meaning: '连接过期，需 resume 重连', at: Date.now() - 26 * 60 * 1000 },
  sessionLimit: { total: 1500, remaining: 1423, reset_after: 3_100_000, max_concurrency: 3 },
  quotaWaitUntil: null,
  sandbox: true,
  apiBase: 'https://sandbox.api.sgroup.qq.com',
  lastError: null,
  qqReady: true,
  aiReady: true,
  aiCount: 2,
  aiModel: 'gpt-4o-mini',
  historyLimit: 20,
  lastStartAt: Date.now() - 26 * 60 * 1000,
  logs: [
    ['info', 'DO init: desiredRunning=true'],
    ['info', 'Config loaded, keys: appId,secret,sandbox,systemPrompt,historyLimit'],
    ['info', 'Token refreshed successfully (ttl=7200s)'],
    ['info', 'Gateway ok: shards=1 session_left=1423/1500 reset_after=3100s max_concurrency=3'],
    ['info', 'Identifying: intents=33554432 shard=[0,1]'],
    ['info', 'WebSocket connected'],
    ['info', 'Bot ready: 小助手 session=a1b2c3d4'],
    ['warn', 'Reconnect in 5s (close 4009)'],
    ['info', 'Resuming session a1b2c3d4 @ seq=812'],
    ['info', 'Session resumed'],
    ['info', 'Replied to group chat: 好的，我帮你把这段话改得更礼貌一些……'],
    ['warn', 'AI 主账号 不可用: AI API error: HTTP 429 Too Many Requests'],
    ['info', 'Replied to c2c chat: 当然可以，试试这样说……'],
  ].map((it, i) => {
    const at = Date.now() - (13 - i) * 90 * 1000;
    const d = new Date(at + 8 * 3600 * 1000);
    const p = (n) => String(n).padStart(2, '0');
    return {
      at,
      time: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`,
      level: it[0],
      text: `[QQBot] ${it[1]}`,
    };
  }),
};

const DEMO_LOGS = Array.from({ length: 23 }, (_, i) => {
  const c2c = i % 4 === 3;
  return {
    id: 2000 - i,
    time: new Date(Date.now() - i * 7 * 60 * 1000).toISOString(),
    kind: c2c ? 'c2c' : 'group',
    scopeId: c2c ? 'OPENID_USER_' + (i % 5) : 'OPENGROUPID_' + String.fromCharCode(65 + (i % 4)),
    userId: 'OPENID_USER_' + (i % 7),
    userContent: c2c
      ? ['今天适合出门吗？', '帮我写一句请假理由', '解释一下什么是递归'][i % 3]
      : ['@小助手 帮我把这段话改得更礼貌一点：这方案不行，重做。', '@小助手 用一句话总结一下这段话的要点', '@小助手 明天北京天气怎么样'][i % 3],
    aiReply: c2c
      ? ['看你在哪个城市，今天大部分地区多云，出门带把伞更稳妥。', '「因个人身体不适，需请假一天，工作已交接给同事，请批准。」', '递归就是函数在内部调用自己，用更小的同类问题逼近出口。'][i % 3]
      : ['当然可以，试试这样说：「这个方案目前和预期还有差距，方便的话我们一起看看怎么调整？」', '要点：方案需要重做，原因是要和预期对齐，下一步是一起讨论调整方向。', '我没有实时天气数据，建议看一下手机自带的天气应用。'][i % 3],
    model: 'gpt-4o-mini',
  };
});

function demoApi(pathname, search) {
  if (pathname === '/api/status') return DEMO_STATUS;
  if (pathname === '/api/config') {
    const config = { ...DEMO_CONFIG };
    config.secret = '';
    return { config, configured: { secret: true } };
  }
  if (pathname === '/api/ai') {
    return { providers: DEMO_PROVIDERS };
  }
  if (pathname === '/api/logs') {
    const page = Math.max(1, Number(search.get('page')) || 1);
    const size = Math.max(1, Number(search.get('pageSize')) || 20);
    const kind = search.get('kind') || 'all';
    const filtered = kind === 'all' ? DEMO_LOGS : DEMO_LOGS.filter((x) => x.kind === kind);
    const totalPages = Math.max(1, Math.ceil(filtered.length / size));
    const p = Math.min(page, totalPages);
    return {
      items: filtered.slice((p - 1) * size, p * size),
      page: p,
      pageSize: size,
      total: filtered.length,
      totalPages,
      kind,
    };
  }
  if (pathname === '/api/models') {
    return { models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'deepseek-chat', 'deepseek-reasoner', 'qwen-plus'] };
  }
  return { ok: true };
}

function withFakeBotVolume() {
  return {
    ...DEMO_STATUS,
    running: false,
    desiredRunning: false,
    wsState: 3,
    quotaWaitUntil: Date.now() + 42 * 60 * 1000,
    sessionLimit: { total: 1500, remaining: 0, reset_after: 2_500_000, max_concurrency: 3 },
  };
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/status') {
      const status = url.searchParams.get('empty') ? withFakeBotVolume() : DEMO_STATUS;
      res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, data: status }));
      return;
    }
    if (url.pathname === '/api/logs' && url.searchParams.get('empty')) {
      res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, data: { items: [], page: 1, pageSize: 20, total: 0, totalPages: 1, kind: 'all' } }));
      return;
    }
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, data: demoApi(url.pathname, url.searchParams) }));
    return;
  }

  const render = ROUTES[url.pathname];
  if (!render) {
    res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: { code: 'not_found', message: '预览服务只有 / /login /admin' } }));
    return;
  }
  const nonce = randomHex(16);
  
  const html = render(nonce, url.href);
  res.writeHead(200, htmlResponse(html, nonce));
  res.end(html);
}).listen(PORT, '0.0.0.0', () => {
  console.log(`预览服务已启动（局域网可访问）：`);
  console.log(`  首页       http://127.0.0.1:${PORT}/`);
  console.log(`  登录页     http://127.0.0.1:${PORT}/login`);
  console.log(`  后台页     http://127.0.0.1:${PORT}/admin   （本地预览，未校验登录）`);
  console.log(`  后台空态   http://127.0.0.1:${PORT}/admin?empty=1`);
  console.log(`  未配置页   http://127.0.0.1:${PORT}/setup   （模拟缺 Secrets）`);
});
