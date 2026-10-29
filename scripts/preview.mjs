
import { createServer } from 'node:http';
import { adminPage, homePage, loginPage, setupPage, recoverGatePage, keyRecoveryPage } from '../src/html.js';
import { randomHex } from '../src/db.js';
import { COOKIE_NAME, SESSION_TTL_MS } from '../src/constants.js';
import { safeEqual } from '../src/utils/security.js';

const PORT = Number(process.argv[2]) || 8788;
const HOST = '127.0.0.1';

// 后台登录密码（可用环境变量覆盖）
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'preview-admin-2026';

// 本地预览走 http://，cookie 不能带 Secure，否则浏览器在 http 下不保存/不清除。
// 其余属性（HttpOnly / SameSite=Strict / Max-Age）跟线上一致。
function sessionCookie(id, maxAge) {
  return `${COOKIE_NAME}=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
}
function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

// 内存会话表（代替线上 D1 的 sessions 表）
const sessions = new Map();

function getCookie(req, name) {
  const h = req.headers.cookie || '';
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

function hasSession(req) {
  const id = getCookie(req, COOKIE_NAME);
  if (!id || !/^[0-9a-f]{64}$/.test(id)) return false;
  const exp = sessions.get(id);
  if (!exp) return false;
  if (exp <= Date.now()) {
    sessions.delete(id);
    return false;
  }
  return true;
}

function sendJson(res, status, obj) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => resolve(raw));
  });
}

// 后台页面路径
const ADMIN_PATHS = new Set(['status', 'config', 'ai', 'imagegen', 'groups', 'workspace', 'logs']);

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
  '/setup': (nonce, url) => setupPage(nonce, ['ADMIN_TOKEN', 'CONFIG_ENC_KEY']),
  '/recover': (nonce) => recoverGatePage(nonce, {}),
  '/recover/authed': (nonce) => keyRecoveryPage(nonce, { hasKey: true }),
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
  if (pathname === '/api/sandboxes') {
    return { items: demoSandboxes() };
  }
  if (pathname === '/api/workspaces') {
    return { items: demoWorkspaces() };
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

/* ------------------------------ 沙箱演示数据 ------------------------------ */
// 造几个用户、每人 1~4 个文件，带上真实的「修改时间」，
// 用来验证后台沙箱页与 AI 的 file.list 是否都能给出时间（而不是「暂不可知」）。
const MIN = 60 * 1000;
const SANDBOX_FILES = {
  'c2c:OPENID_USER_A': [
    ['affection.json', '{\n  "score": 88,\n  "level": "亲密",\n  "updated": "2026-10-27"\n}', 3 * MIN],
    ['旅行计划.md', '# 杭州三日游\n\n第一天：西湖 + 河坊街\n第二天：灵隐寺 + 龙井村\n第三天：西溪湿地\n', 42 * MIN],
  ],
  'group:OPENGROUPID_B:u:OPENID_USER_B': [
    ['周报-第43周.md', '# 本周进展\n\n1. 完成 Webhook 迁移\n2. 修掉 DO 空转计费\n3. 分层记忆上线\n', 26 * 60 * MIN],
    ['待办.txt', '整理 README\n补 12 个测试脚本\n写发版说明\n', 5 * 60 * MIN],
    ['notes/api.md', '## 接口清单\n\n- POST /qq/webhook\n- GET /api/status\n', 9 * 60 * MIN],
  ],
  'c2c:OPENID_USER_C': [
    ['affection.json', '{\n  "score": 12,\n  "level": "陌生"\n}', 2 * 24 * 60 * MIN],
  ],
};

function demoSandboxes() {
  return Object.entries(SANDBOX_FILES).map(([scope, files]) => {
    const newest = Math.max(...files.map((f) => f[2]));
    return {
      scope,
      scopeMasked: scope.replace(/^c2c:/, '').replace(/^group:[^:]+:u:/, ''),
      kind: scope.startsWith('c2c:') ? 'c2c' : 'group',
      runs: files.length + 3,
      files: files.length,
      lastTask: files[0][0].startsWith('affection')
        ? '查看沙箱目录'
        : '把周报整理成 md 保存好',
      updatedAt: Date.now() - newest,
    };
  });
}

function demoSandboxDetail(scope) {
  const files = SANDBOX_FILES[scope] || [];
  return {
    scopeMasked: scope.replace(/^c2c:/, '').replace(/^group:[^:]+:u:/, ''),
    files: files.map(([name, content, ago]) => ({
      path: 'users/' + (scope.includes('u:') ? scope.split('u:').pop() : scope.split(':').pop()) + '/' + name,
      bytes: Buffer.byteLength(content, 'utf8'),
      updatedAt: Date.now() - ago,
      content,
    })),
    runs: files.length + 3,
    updatedAt: Date.now() - Math.min(...files.map((f) => f[2])),
  };
}

/* ------------------------------ 工作区演示数据 ------------------------------ */
const WORKSPACE_DATA = {
  'c2c:OPENID_USER_A': {
    tasks: [
      { id: 1, text: '整理 README 的部署说明', done: true },
      { id: 2, text: '给机器人写一段介绍文案', done: false },
      { id: 3, text: '准备下周的群活动话题', done: false },
    ],
    notes: [{ text: '用户偏好简洁口语，不要长篇大论' }, { text: '喜欢在周末聊技术' }],
    runs: 7,
  },
  'group:OPENGROUPID_B:u:OPENID_USER_B': {
    tasks: [
      { id: 1, text: '整理本周群内待办', done: true },
      { id: 2, text: '汇总大家的提问', done: false },
    ],
    notes: [{ text: '群里常问部署问题' }],
    runs: 4,
  },
};

function demoWorkspaces() {
  return Object.entries(WORKSPACE_DATA).map(([scope, w]) => ({
    scope,
    scopeMasked: scope.replace(/^c2c:/, '').replace(/^group:[^:]+:u:/, ''),
    kind: scope.startsWith('c2c:') ? 'c2c' : 'group',
    runs: w.runs,
    tasks: w.tasks.length,
    notes: w.notes.length,
    lastTask: w.tasks[0] ? w.tasks[0].text : '整理待办',
    updatedAt: Date.now() - 30 * 60 * 1000,
  }));
}

function demoWorkspaceDetail(scope) {
  const w = WORKSPACE_DATA[scope] || { tasks: [], notes: [], runs: 0 };
  return {
    scopeMasked: scope.replace(/^c2c:/, '').replace(/^group:[^:]+:u:/, ''),
    tasks: w.tasks,
    notes: w.notes,
    log: [],
    runs: w.runs,
    updatedAt: Date.now() - 30 * 60 * 1000,
  };
}

/* ------------------------------ 记忆分层演示数据 ------------------------------ */
const MEMORY_DATA = {
  'c2c:OPENID_USER_A': {
    messages: 14,
    summaryLen: 96,
    summary: '用户叫小王，在杭州做前端开发，主要用 TypeScript；正在做 QQ 机器人项目，跑在 Cloudflare Workers 上；讨厌 Java，养了只橘猫叫年糕。',
    facts: [
      { text: '用户叫小王，在杭州做前端开发', at: Date.now() - 2 * 24 * 60 * 60 * 1000 },
      { text: '技术栈：TypeScript + React', at: Date.now() - 2 * 24 * 60 * 60 * 1000 },
      { text: '正在做 QQ 机器人项目（Cloudflare Workers）', at: Date.now() - 24 * 60 * 60 * 1000 },
      { text: '讨厌 Java，觉得太重', at: Date.now() - 24 * 60 * 60 * 1000 },
      { text: '养了一只橘猫叫年糕', at: Date.now() - 12 * 60 * 60 * 1000 },
    ],
    recent: [
      { role: 'user', content: '帮我看看今天适合写代码吗' },
      { role: 'assistant', content: '适合呀，状态好就趁热打铁～' },
      { role: 'user', content: '推荐一个前端框架' },
      { role: 'assistant', content: '你已经在用 React 了，继续保持就挺好。' },
    ],
    sinceCompress: 8,
  },
  'group:OPENGROUPID_B:u:OPENID_USER_B': {
    messages: 6,
    summaryLen: 0,
    summary: '',
    facts: [{ text: '群里常问部署问题', at: Date.now() - 6 * 60 * 60 * 1000 }],
    recent: [
      { role: 'user', content: '这个机器人怎么部署？' },
      { role: 'assistant', content: '用 npm run deploy 一条命令就行。' },
    ],
    sinceCompress: 2,
  },
};

function demoMemory(scope) {
  const m = MEMORY_DATA[scope] || { messages: 0, summaryLen: 0, summary: '', facts: [], recent: [], sinceCompress: 0 };
  return { scope, scopeMasked: scope.replace(/^c2c:/, '').replace(/^group:[^:]+:u:/, ''), ...m };
}

/* ------------------------------ 聊天记录演示数据 ------------------------------ */
const DEMO_CONVERSATIONS = [
  {
    scopeId: 'a3f2c1d0',
    kind: 'group',
    count: 9,
    lastAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    lastUser: '@小助手 明天北京天气怎么样',
    lastReply: '我没有实时天气数据，建议看一下手机自带的天气应用。',
    lastModel: 'gpt-4o-mini',
    messages: [
      { id: 11, kind: 'group', userContent: '@小助手 你好呀', aiReply: '你好呀～有什么可以帮你的？', model: 'qwen3.8-omni-flash', time: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
      { id: 12, kind: 'group', userContent: '@小助手 帮我把这段话改得更礼貌一点：这方案不行，重做。', aiReply: '当然可以，试试这样说：「这个方案目前和预期还有差距，方便的话我们一起看看怎么调整？」', model: 'deepseek-chat', time: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
      { id: 13, kind: 'group', userContent: '@小助手 明天北京天气怎么样', aiReply: '我没有实时天气数据，建议看一下手机自带的天气应用。', model: 'gpt-4o-mini', time: new Date(Date.now() - 2 * 60 * 1000).toISOString() },
    ],
  },
  {
    scopeId: 'b7e9d2a1',
    kind: 'group',
    count: 6,
    lastAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    lastUser: '@小助手 帮我写一句请假理由',
    lastReply: '「因个人身体不适，需请假一天，工作已交接给同事，请批准。」',
    lastModel: 'deepseek-chat',
    messages: [
      { id: 21, kind: 'group', userContent: '@小助手 介绍一下你自己', aiReply: '我是一个跑在 Cloudflare Workers 上的 QQ 机器人～', model: 'qwen3.8-omni-flash', time: new Date(Date.now() - 40 * 60 * 1000).toISOString() },
      { id: 22, kind: 'group', userContent: '@小助手 帮我写一句请假理由', aiReply: '「因个人身体不适，需请假一天，工作已交接给同事，请批准。」', model: 'deepseek-chat', time: new Date(Date.now() - 18 * 60 * 1000).toISOString() },
    ],
  },
  {
    scopeId: 'c5a8e3f0',
    kind: 'c2c',
    count: 5,
    lastAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    lastUser: '解释一下什么是递归',
    lastReply: '递归就是函数在内部调用自己，用更小的同类问题逼近出口。',
    lastModel: 'qwen-plus',
    messages: [
      { id: 31, kind: 'c2c', userContent: '今天适合出门吗？', aiReply: '看你在哪个城市，今天大部分地区多云，出门带把伞更稳妥。', model: 'qwen-plus', time: new Date(Date.now() - 20 * 60 * 1000).toISOString() },
      { id: 32, kind: 'c2c', userContent: '解释一下什么是递归', aiReply: '递归就是函数在内部调用自己，用更小的同类问题逼近出口。', model: 'qwen-plus', time: new Date(Date.now() - 6 * 60 * 1000).toISOString() },
    ],
  },
];

function demoConversations() {
  return {
    items: DEMO_CONVERSATIONS.map((c) => ({
      scopeId: c.scopeId,
      kind: c.kind,
      count: c.count,
      lastAt: c.lastAt,
      lastUser: c.lastUser,
      lastReply: c.lastReply,
      lastModel: c.lastModel,
    })),
    system: {
      count: 4,
      lastAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      lastText: '后台修改配置，已热更新生效',
    },
  };
}

function demoConversationMessages(scope) {
  const conv = DEMO_CONVERSATIONS.find((c) => c.scopeId === scope);
  if (!conv) return { items: [], hasMore: false };
  return {
    items: conv.messages.map((m) => ({
      id: m.id,
      kind: m.kind,
      scopeId: conv.scopeId,
      userContent: m.userContent,
      aiReply: m.aiReply,
      model: m.model,
      time: m.time,
    })),
    hasMore: false,
  };
}

function demoSystemMessages() {
  const now = Date.now();
  return {
    items: [
      { id: 4, content: '后台修改配置，已热更新生效', time: new Date(now - 10 * 60 * 1000).toISOString() },
      { id: 3, content: '新增定时提醒：明天 8 点开会', time: new Date(now - 45 * 60 * 1000).toISOString() },
      { id: 2, content: '新成员加入群聊，已自动发送欢迎语', time: new Date(now - 2 * 60 * 60 * 1000).toISOString() },
      { id: 1, content: '机器人加入新群，已自动打招呼', time: new Date(now - 5 * 60 * 60 * 1000).toISOString() },
    ],
    hasMore: false,
  };
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  /* ---------------- 登录 / 登出 ---------------- */
  if (url.pathname === '/api/auth/login' && req.method === 'POST') {
    readBody(req).then(async (raw) => {
      let password = '';
      try { password = JSON.parse(raw || '{}').password || ''; } catch { /* ignore */ }
      if (password && (await safeEqual(password, ADMIN_TOKEN))) {
        const id = randomHex(32);
        sessions.set(id, Date.now() + SESSION_TTL_MS);
        res.setHeader('Set-Cookie', sessionCookie(id, Math.floor(SESSION_TTL_MS / 1000)));
        sendJson(res, 200, { ok: true, data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString() } });
      } else {
        sendJson(res, 401, { ok: false, error: { code: 'invalid_credentials', message: '密码错误' } });
      }
    });
    return;
  }

  if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
    const id = getCookie(req, COOKIE_NAME);
    if (id) sessions.delete(id);
    res.setHeader('Set-Cookie', clearSessionCookie());
    sendJson(res, 200, { ok: true, data: { loggedOut: true } });
    return;
  }

  /* ---------------- API（除登录外都要会话） ---------------- */
  if (url.pathname.startsWith('/api/')) {
    if (!hasSession(req)) {
      sendJson(res, 401, { ok: false, error: { code: 'unauthorized', message: '未登录或会话已过期' } });
      return;
    }
    if (url.pathname === '/api/memory' && req.method === 'POST') {
      readBody(req).then((raw) => {
        let scope = '';
        try { scope = JSON.parse(raw || '{}').scope || ''; } catch { /* ignore */ }
        sendJson(res, 200, { ok: true, data: demoMemory(scope) });
      });
      return;
    }
    if (url.pathname === '/api/sandboxes/detail' && req.method === 'POST') {
      readBody(req).then((raw) => {
        let scope = '';
        try { scope = JSON.parse(raw || '{}').scope || ''; } catch { /* ignore */ }
        sendJson(res, 200, { ok: true, data: demoSandboxDetail(scope) });
      });
      return;
    }
    if (url.pathname === '/api/sandboxes/clear' && req.method === 'POST') {
      req.resume();
      req.on('end', () => sendJson(res, 200, { ok: true, data: { cleared: true } }));
      return;
    }
    if (url.pathname === '/api/workspaces/detail' && req.method === 'POST') {
      readBody(req).then((raw) => {
        let scope = '';
        try { scope = JSON.parse(raw || '{}').scope || ''; } catch { /* ignore */ }
        sendJson(res, 200, { ok: true, data: demoWorkspaceDetail(scope) });
      });
      return;
    }
    if (url.pathname === '/api/workspaces/clear' && req.method === 'POST') {
      req.resume();
      req.on('end', () => sendJson(res, 200, { ok: true, data: { cleared: true } }));
      return;
    }
    if (url.pathname === '/api/status') {
      sendJson(res, 200, { ok: true, data: url.searchParams.get('empty') ? withFakeBotVolume() : DEMO_STATUS });
      return;
    }
    if (url.pathname === '/api/conversations') {
      sendJson(res, 200, { ok: true, data: demoConversations() });
      return;
    }
    if (url.pathname === '/api/conversations/messages') {
      sendJson(res, 200, { ok: true, data: demoConversationMessages(url.searchParams.get('scope') || '') });
      return;
    }
    if (url.pathname === '/api/system-messages') {
      sendJson(res, 200, { ok: true, data: demoSystemMessages() });
      return;
    }
    if (url.pathname === '/api/logs' && url.searchParams.get('empty')) {
      sendJson(res, 200, { ok: true, data: { items: [], page: 1, pageSize: 20, total: 0, totalPages: 1, kind: 'all' } });
      return;
    }
    sendJson(res, 200, { ok: true, data: demoApi(url.pathname, url.searchParams) });
    return;
  }

  /* ---------------- 页面 ---------------- */
  // 已登录访问 /login → 直接进后台
  if (url.pathname === '/login' && req.method === 'GET' && hasSession(req)) {
    res.writeHead(302, { Location: '/status' });
    res.end();
    return;
  }

  // 后台页面：未登录跳登录页
  const seg = url.pathname.slice(1);
  if (req.method === 'GET' && ADMIN_PATHS.has(seg) && !url.pathname.includes('/', 1)) {
    if (!hasSession(req)) {
      res.writeHead(302, { Location: '/login' });
      res.end();
      return;
    }
    const nonce = randomHex(16);
    const html = adminPage(nonce);
    res.writeHead(200, htmlResponse(html, nonce));
    res.end(html);
    return;
  }

  const render = ROUTES[url.pathname];
  if (!render) {
    res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: { code: 'not_found', message: 'Not Found' } }));
    return;
  }
  const nonce = randomHex(16);
  const html = render(nonce, url.href);
  res.writeHead(200, htmlResponse(html, nonce));
  res.end(html);
}).listen(PORT, HOST, () => {
  console.log(`预览服务已启动（仅本机）：`);
  console.log(`  首页       http://127.0.0.1:${PORT}/`);
  console.log(`  登录页     http://127.0.0.1:${PORT}/login`);
  console.log(`  后台首页   http://127.0.0.1:${PORT}/status   （需登录，密码：${ADMIN_TOKEN}）`);
  console.log(`  未配置页   http://127.0.0.1:${PORT}/setup`);
});
