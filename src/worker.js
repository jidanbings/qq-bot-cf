import { adminPage, homePage, loginPage, setupPage, keyRecoveryPage } from './html.js';
import {
  clearChatLogs,
  createSession,
  deleteSession,
  ensureKey,
  getAiProvider,
  getConfig,
  getSession,
  initSchema,
  listAiProviders,
  listChatLogs,
  normalizeUrl,
  purgeExpiredSessions,
  randomHex,
  saveAiProviders,
  saveConfig,
  toPublicConfig,
} from './db.js';
import { APP_VERSION, COOKIE_NAME, LOGIN_LIMIT, API_LIMIT } from './constants.js';
import { hitRateLimit, resetRateLimit } from './utils/rate-limit.js';
import { fetchModelList } from './utils/models.js';
import {
  HttpError,
  jsonResult,
  jsonFail,
  htmlResponse,
  redirect,
  rateLimitHeaders,
} from './utils/response.js';
import {
  getCookie,
  sessionCookie,
  clearSessionCookie,
  safeEqual,
  assertSameOrigin,
  readJson,
} from './utils/security.js';

export { QQBotDO } from './qq-bot-do.js';
export { RateLimiter } from './rate-limit-do.js';

async function requireSession(request, env) {
  const id = getCookie(request, COOKIE_NAME);
  if (!id) return null;
  return getSession(env, id);
}

function botStub(env) {
  return env.QQ_BOT.get(env.QQ_BOT.idFromName('main'));
}

async function callBot(env, action) {
  let res;
  try {
    res = await botStub(env).fetch(`https://qqbot/${action}`, {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new HttpError(504, 'bot_timeout', '机器人实例响应超时，稍后再试');
  }
  if (!res.ok) throw new HttpError(502, 'bot_error', `机器人接口返回 HTTP ${res.status}`);
  return res.json();
}

async function ensureBot(env) {
  try {
    const res = await botStub(env).fetch(
      `https://qqbot/ensure?v=${encodeURIComponent(APP_VERSION)}`,
      { method: 'POST', signal: AbortSignal.timeout(15000) }
    );
    const data = await res.json();
    if (data && data.action && data.action !== 'alive' && data.action !== 'idle') {
      console.log('Watchdog:', JSON.stringify(data));
    }
    return data;
  } catch (err) {
    console.error('Watchdog failed:', err && err.stack ? err.stack : err);
    return null;
  }
}

async function resolveModelEndpoint(env, body) {
  const typedUrl = normalizeUrl(typeof body.baseUrl === 'string' ? body.baseUrl : '');
  const providerId = typeof body.providerId === 'string' ? body.providerId.trim() : '';
  const stored = providerId ? await getAiProvider(env, providerId) : null;
  const baseUrl = typedUrl || (stored ? stored.baseUrl : '');
  const typedKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  const apiKey = typedKey || (stored ? stored.apiKey : '');
  if (!baseUrl) throw new HttpError(400, 'invalid_config', '请先填写 AI Base URL');
  if (!apiKey) throw new HttpError(400, 'invalid_config', '请先填写 API Key');
  return { baseUrl, apiKey };
}

async function handleLogin(request, env, ip) {
  if (!env.ADMIN_TOKEN) {
    throw new HttpError(500, 'server_misconfigured', '未配置 ADMIN_TOKEN，拒绝所有登录');
  }

  const limit = await hitRateLimit(env, `login:${ip}`, LOGIN_LIMIT);
  if (!limit.allowed) {
    return jsonFail(429, 'too_many_requests', '登录尝试过多，请稍后再试', rateLimitHeaders(limit));
  }

  const body = await readJson(request, 4096);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!password || !(await safeEqual(password, env.ADMIN_TOKEN))) {
    return jsonFail(401, 'invalid_credentials', '密码错误', rateLimitHeaders(limit));
  }

  await resetRateLimit(env, [`login:${ip}`]);
  await purgeExpiredSessions(env);
  const session = await createSession(env, {
    ip,
    userAgent: request.headers.get('User-Agent') || '',
  });
  return jsonResult(
    { expiresAt: new Date(Date.now() + session.maxAge * 1000).toISOString() },
    200,
    { 'Set-Cookie': sessionCookie(session.id, session.maxAge) }
  );
}

async function handleApi(request, env, url) {
  const path = url.pathname;
  const method = request.method;

  if (path === '/api/auth/login') {
    if (method !== 'POST') throw new HttpError(405, 'method_not_allowed', '请使用 POST');
    return handleLogin(request, env, request.headers.get('cf-connecting-ip') || '0.0.0.0');
  }

  if (method !== 'GET' && method !== 'POST') {
    throw new HttpError(405, 'method_not_allowed', `不支持的方法 ${method}`);
  }
  if (method === 'POST') assertSameOrigin(request);

  const skipLimit = path === '/api/ratelimit/reset';
  const ip = request.headers.get('cf-connecting-ip') || '0.0.0.0';
  if (!skipLimit) {
    const limit = await hitRateLimit(env, `api:${ip}`, API_LIMIT);
    if (!limit.allowed) {
      return jsonFail(429, 'too_many_requests', '请求过于频繁，请稍后再试', rateLimitHeaders(limit));
    }
  }

  const session = await requireSession(request, env);
  if (!session) return jsonFail(401, 'unauthorized', '未登录或会话已过期');

  switch (path) {
    case '/api/auth/logout':
      if (method === 'POST') {
        await deleteSession(env, session.id);
        return jsonResult({ loggedOut: true }, 200, { 'Set-Cookie': clearSessionCookie() });
      }
      break;

    case '/api/status': {
      if (method === 'GET') {
        const data = await callBot(env, 'status');
        return jsonResult({ ...(data || {}), workerVersion: APP_VERSION });
      }
      break;
    }

    case '/api/debug':
      if (method === 'GET') return jsonResult(await callBot(env, 'debug'));
      break;

    case '/api/bot/start':
      if (method === 'POST') return jsonResult(await callBot(env, 'start'));
      break;

    case '/api/bot/stop':
      if (method === 'POST') return jsonResult(await callBot(env, 'stop'));
      break;

    case '/api/bot/restart':
      if (method === 'POST') {
        await callBot(env, 'stop');
        return jsonResult(await callBot(env, 'start'));
      }
      break;

    case '/api/config': {
      if (method === 'GET') {
        const cfg = await getConfig(env, { decrypt: false });
        return jsonResult(toPublicConfig(cfg));
      }
      const body = await readJson(request);
      const result = await saveConfig(env, body);
      if (!result.ok) throw new HttpError(400, 'invalid_config', result.error);
      return jsonResult({ saved: result.saved });
    }

    case '/api/ai': {
      if (method === 'GET') {
        return jsonResult({ providers: await listAiProviders(env) });
      }
      const body = await readJson(request);
      const result = await saveAiProviders(env, body.providers);
      if (!result.ok) throw new HttpError(400, 'invalid_config', result.error);
      return jsonResult({ saved: result.saved });
    }

    case '/api/models':
      if (method === 'POST') {
        const body = await readJson(request);
        const { baseUrl, apiKey } = await resolveModelEndpoint(env, body);
        const models = await fetchModelList(baseUrl, apiKey);
        return jsonResult({ models });
      }
      break;

    case '/api/logs':
      if (method === 'GET') {
        return jsonResult(
          await listChatLogs(env, {
            page: url.searchParams.get('page'),
            pageSize: url.searchParams.get('pageSize'),
            kind: url.searchParams.get('kind'),
          })
        );
      }
      break;

    case '/api/logs/clear':
      if (method === 'POST') return jsonResult({ deleted: await clearChatLogs(env) });
      break;

    case '/api/ratelimit/reset':
      if (method === 'POST') {
        await resetRateLimit(env, [`api:${ip}`, `login:${ip}`]);
        return jsonResult({ reset: true });
      }
      break;

    default:
      break;
  }

  return jsonFail(404, 'not_found', `没有这个接口: ${method} ${path}`);
}

async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  let keyState = { action: 'ok', key: '' };
  if (env.DB) {
    try {
      const schema = await initSchema(env);
      if (!schema.ok) {
        console.error('自动建表失败:', schema.error);
      }
      keyState = await ensureKey(env);
    } catch (err) {
      console.error('schema/ensureKey failed:', err && err.stack ? err.stack : err);
    }
  }

  if (keyState.action === 'mismatch' || keyState.action === 'missing') {
    if (path.startsWith('/api/')) {
      return jsonFail(
        503,
        'enc_key_mismatch',
        'CONFIG_ENC_KEY 与数据库里已加密的数据对不上，请访问首页按提示恢复。'
      );
    }
    const nonce = randomHex(16);
    return htmlResponse(
      keyRecoveryPage(nonce, { hasKey: keyState.action === 'mismatch' }),
      nonce
    );
  }

  const missingSecrets = ['ADMIN_TOKEN', 'CONFIG_ENC_KEY'].filter((k) => !env[k]);

  if (missingSecrets.length) {
    if (path === '/api/' || path.startsWith('/api/')) {
      return jsonFail(
        503,
        'server_misconfigured',
        `服务端尚未完成配置：缺少环境变量 ${missingSecrets.join(', ')}。请访问首页查看配置指引。`
      );
    }
    const nonce = randomHex(16);
    return htmlResponse(setupPage(nonce, missingSecrets), nonce);
  }

  if (path === '/' && request.method === 'GET') {
    const nonce = randomHex(16);
    
    return htmlResponse(homePage(nonce, request.url), nonce);
  }

  if (path === '/login' && request.method === 'GET') {
    if (await requireSession(request, env)) return redirect('/admin');
    const nonce = randomHex(16);
    return htmlResponse(loginPage(nonce), nonce);
  }

  if (path === '/admin' && request.method === 'GET') {
    if (!(await requireSession(request, env))) return redirect('/login');
    const nonce = randomHex(16);
    return htmlResponse(adminPage(nonce), nonce);
  }

  if (!path.startsWith('/api/')) {
    return jsonFail(404, 'not_found', 'Not Found');
  }

  return handleApi(request, env, url);
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (err) {
      if (err instanceof HttpError) return jsonFail(err.status, err.code, err.message);
      console.error('Unhandled error:', err && err.stack ? err.stack : err);
      return jsonFail(500, 'internal_error', '服务器内部错误');
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(ensureBot(env));
  },
};
