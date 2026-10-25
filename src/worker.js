import { adminPage, homePage, loginPage, setupPage, keyRecoveryPage, recoverGatePage } from './html.js';
import { ChatDO } from './chat-do.js';
import { WorkDO } from './work-do.js';
import { AiDO } from './ai-sandbox-do.js';
import { FAVICON_SVG, FAVICON_PNG_32, FAVICON_ICO, APPLE_TOUCH_PNG } from './assets/icons.js';
import {
  clearChatLogs,
  cancelReminder,
  createSession,
  deleteSession,
  deleteConversation,
  ensureKey,
  getAiProvider,
  getConfig,
  getConversationMessages,
  getSession,
  getSystemMessages,
  initSchema,
  listAiProviders,
  listChatLogs,
  listConversations,
  listGroups,
  listReminders,
  listWorkspaces,
  deleteWorkspace,
  listSandboxes,
  deleteSandbox,
  normalizeUrl,
  purgeExpiredSessions,
  randomHex,
  removeGroup,
  resetEncryptedConfig,
  saveAiProviders,
  saveConfig,
  systemSummary,
  toPublicConfig,
  upsertGroup,
} from './db.js';
import { APP_VERSION, COOKIE_NAME, LOGIN_LIMIT, API_LIMIT } from './constants.js';
import { hitRateLimit, resetRateLimit } from './utils/rate-limit.js';
import { maskId } from './utils/crypto.js';
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
  RECOVERY_COOKIE,
  RECOVERY_TTL_MS,
  recoveryCookie,
  clearRecoveryCookie,
  makeRecoveryToken,
  checkRecoveryToken,
} from './utils/security.js';
import { redact } from './utils/redact.js';

export { QQBotDO } from './qq-bot-do.js';
export { RateLimiter } from './rate-limit-do.js';

async function requireSession(request, env) {
  const id = getCookie(request, COOKIE_NAME);
  if (!id) return null;
  return getSession(env, id);
}

function botStub(env, version) {
  return env.QQ_BOT.get(env.QQ_BOT.idFromName('bot:' + (version || APP_VERSION)));
}

async function callBot(env, action, body) {
  let res;
  try {
    const init = {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
    };
    if (body !== undefined) init.body = JSON.stringify(body);
    res = await botStub(env).fetch(`https://qqbot/${action}`, init);
  } catch {
    throw new HttpError(504, 'bot_timeout', '机器人实例响应超时，稍后再试');
  }
  if (!res.ok) throw new HttpError(502, 'bot_error', `机器人接口返回 HTTP ${res.status}`);
  return res.json();
}

/** 让旧版本 DO 实例退休：先通知它断开连接，再启动当前版本的实例 */
async function switchDoVersion(env, force) {
  let prev = '';
  try {
    const cfg = await getConfig(env, { decrypt: false });
    prev = cfg.doVersion || '';
  } catch {}
  if (prev === APP_VERSION) {
    const res = await botStub(env).fetch(
      `https://qqbot/ensure?v=${encodeURIComponent(APP_VERSION)}`,
      { method: 'POST', signal: AbortSignal.timeout(15000) }
    );
    return { ok: true, switched: false, version: APP_VERSION, action: (await res.json()).action };
  }
  const retired = [];
  // v2.4.0 之前 DO id 固定为 'main'，之后是 'bot:<version>'；
  // v2.4.0 初版曾在升级时误建过 'bot' 实例，升级到 2.4.1 时一并退休掉。
  const oldIds = prev ? ['bot:' + prev] : ['main'];
  if (prev === '2.4.0') oldIds.push('bot');
  for (const idName of oldIds) {
    try {
      const stub = env.QQ_BOT.get(env.QQ_BOT.idFromName(idName));
      await stub.fetch(`https://qqbot/ensure?v=${encodeURIComponent(APP_VERSION)}`, {
        method: 'POST',
        signal: AbortSignal.timeout(8000),
      });
      retired.push(idName);
    } catch {}
  }
  try {
    await saveConfig(env, { doVersion: APP_VERSION });
  } catch {}
  const res = await botStub(env).fetch(
    `https://qqbot/ensure?v=${encodeURIComponent(APP_VERSION)}`,
    { method: 'POST', signal: AbortSignal.timeout(15000) }
  );
  const data = await res.json();
  return { ok: true, switched: true, from: prev || '(旧版)', to: APP_VERSION, retired, action: data.action };
}

async function ensureBot(env) {
  try {
    const data = await switchDoVersion(env, false);
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

/** 测试生图模型：调 OpenAI 兼容 /images/generations，返回是否可用与测试图地址 */
async function testImageGen(baseUrl, apiKey, model) {
  try {
    const res = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, prompt: '一只橘猫，水彩风格', n: 1 }),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}${text ? ' ' + text.slice(0, 160) : ''}` };
    }
    const data = await res.json();
    const item = data.data?.[0] || {};
    // b64_json 也算成功：转 data URI，预览 <img> 直接能显示
    const url = item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : '');
    if (!url) return { ok: false, error: '生图接口没有返回图片地址（data[0].url 为空）' };
    return { ok: true, url };
  } catch (e) {
    return { ok: false, error: e.name === 'TimeoutError' ? '测试超时（120 秒）' : e.message };
  }
}

/** 测试 AI 对话配置：调 OpenAI 兼容 /chat/completions 发一句话，返回是否可用与回复 */
async function testAiChat(baseUrl, apiKey, model, temperature) {
  const payload = {
    model,
    messages: [{ role: 'user', content: '你好，这是一条连通性测试，请随便回复一句话。' }],
    max_tokens: 30,
    stream: false,
  };
  const t = Number(temperature);
  if (Number.isFinite(t)) payload.temperature = t;
  try {
    const started = Date.now();
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}${text ? ' ' + text.slice(0, 160) : ''}` };
    }
    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string' || !reply.trim()) return { ok: false, error: '接口没有返回回复内容' };
    return { ok: true, reply: reply.trim().slice(0, 60), ms: Date.now() - started };
  } catch (e) {
    return { ok: false, error: e && e.name === 'TimeoutError' ? '测试超时（30 秒）' : (e && e.message) || '测试失败' };
  }
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
        const dos = await doStatuses(env, data);
        return jsonResult({ ...(data || {}), workerVersion: APP_VERSION, dos });
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

    case '/api/bot/switch':
      if (method === 'POST') {
        return jsonResult(await switchDoVersion(env, true));
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
      let botReloaded = false;
      try {
        await callBot(env, 'reload');
        botReloaded = true;
      } catch {}
      return jsonResult({ saved: result.saved, botReloaded });
    }

    case '/api/ai': {
      if (method === 'GET') {
        return jsonResult({ providers: await listAiProviders(env) });
      }
      const body = await readJson(request);
      const result = await saveAiProviders(env, body.providers);
      if (!result.ok) throw new HttpError(400, 'invalid_config', result.error);
      let botReloaded = false;
      try {
        await callBot(env, 'reload');
        botReloaded = true;
      } catch {}
      return jsonResult({ saved: result.saved, botReloaded });
    }

    case '/api/models':
      if (method === 'POST') {
        const body = await readJson(request);
        const { baseUrl, apiKey } = await resolveModelEndpoint(env, body);
        const models = await fetchModelList(baseUrl, apiKey);
        return jsonResult({ models });
      }
      break;

    case '/api/ai/test':
      if (method === 'POST') {
        const body = await readJson(request);
        const model = typeof body.model === 'string' ? body.model.trim() : '';
        if (!model) throw new HttpError(400, 'invalid_config', '请先选择或填写模型');
        const providerId = typeof body.providerId === 'string' ? body.providerId.trim() : '';
        const stored = providerId ? await getAiProvider(env, providerId) : null;
        const baseUrl = normalizeUrl(typeof body.baseUrl === 'string' ? body.baseUrl : '') || (stored ? stored.baseUrl : '');
        const typedKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
        const apiKey = typedKey || (stored ? stored.apiKey : '');
        if (!baseUrl) throw new HttpError(400, 'invalid_config', '请先填写 AI Base URL');
        if (!apiKey) throw new HttpError(400, 'invalid_config', '请先填写 API Key');
        return jsonResult(await testAiChat(baseUrl, apiKey, model, body.temperature));
      }
      break;

    case '/api/imagegen/test':
      if (method === 'POST') {
        const body = await readJson(request);
        const model = typeof body.model === 'string' ? body.model.trim() : '';
        if (!model) throw new HttpError(400, 'invalid_config', '请先填写生图模型');
        const cfg = await getConfig(env);
        const baseUrl =
          normalizeUrl(typeof body.baseUrl === 'string' ? body.baseUrl : '') || cfg.imageGenBaseUrl || '';
        const typedKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
        const apiKey = typedKey || cfg.imageGenApiKey || '';
        if (!baseUrl) throw new HttpError(400, 'invalid_config', '请先填写生图 Base URL');
        if (!apiKey) throw new HttpError(400, 'invalid_config', '请先填写生图 API Key');
        return jsonResult(await testImageGen(baseUrl, apiKey, model));
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

    case '/api/conversations':
      if (method === 'GET') {
        return jsonResult({
          items: await listConversations(env, { limit: 100 }),
          system: await systemSummary(env),
        });
      }
      break;

    case '/api/system-messages':
      if (method === 'GET') {
        const before = Number(url.searchParams.get('before') || 0);
        const limit = Number(url.searchParams.get('limit') || 50);
        return jsonResult(await getSystemMessages(env, { before, limit }));
      }
      break;

    case '/api/conversations/messages': {
      if (method !== 'GET') throw new HttpError(405, 'method_not_allowed', '请使用 GET');
      const scope = String(url.searchParams.get('scope') || '').trim();
      if (!/^[0-9a-zA-Z_-]{1,64}$/.test(scope)) {
        throw new HttpError(400, 'invalid_scope', '会话标识格式不对');
      }
      const before = Number(url.searchParams.get('before') || 0);
      const limit = Number(url.searchParams.get('limit') || 50);
      return jsonResult(await getConversationMessages(env, scope, { before, limit }));
    }

    case '/api/conversations/delete': {
      if (method !== 'POST') throw new HttpError(405, 'method_not_allowed', '请使用 POST');
      const body = await readJson(request);
      const scope = String(body?.scope || '').trim();
      if (!/^[0-9a-zA-Z_-]{1,64}$/.test(scope)) throw new HttpError(400, 'invalid_scope', '会话标识格式不对');
      return jsonResult({ scope, deleted: await deleteConversation(env, scope) });
    }

    case '/api/logs/clear':
      if (method === 'POST') return jsonResult({ deleted: await clearChatLogs(env) });
      break;

    case '/api/ratelimit/reset':
      if (method === 'POST') {
        await resetRateLimit(env, [`api:${ip}`, `login:${ip}`]);
        return jsonResult({ reset: true });
      }
      break;

    /* -------- 群管理 -------- */

    case '/api/groups':
      if (method === 'GET') {
        const rows = await listGroups(env);
        const cfg = await getConfig(env, { decrypt: false });
        const blocked = new Set(
          String(cfg.groupBlacklist || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean)
        );
        const items = [];
        for (const row of rows) {
          items.push({
            openid: row.openid,
            masked: await maskId(row.openid),
            source: row.source === 'manual' ? 'manual' : 'auto',
            addedAt: row.added_at,
            lastSeen: row.last_seen,
            replyEnabled: !blocked.has(row.openid),
          });
        }
        return jsonResult({ items, blockedCount: blocked.size });
      }
      break;

    case '/api/groups/add': {
      if (method !== 'POST') throw new HttpError(405, 'method_not_allowed', '请使用 POST');
      const body = await readJson(request);
      const openid = String(body?.openid || '').trim();
      if (!/^[A-Za-z0-9_-]{10,128}$/.test(openid)) {
        throw new HttpError(400, 'invalid_openid', '群 openid 格式不对（应为字母数字组成的字符串）');
      }
      await upsertGroup(env, openid, 'manual');
      return jsonResult({ openid });
    }

    case '/api/groups/remove': {
      if (method !== 'POST') throw new HttpError(405, 'method_not_allowed', '请使用 POST');
      const body = await readJson(request);
      const openid = String(body?.openid || '').trim();
      if (!openid) throw new HttpError(400, 'invalid_openid', '缺少群 openid');
      await removeGroup(env, openid);
      return jsonResult({ openid });
    }

    case '/api/groups/reply': {
      // 开/关本机器人在某个群的回复（写入 groupBlacklist 配置）
      if (method !== 'POST') throw new HttpError(405, 'method_not_allowed', '请使用 POST');
      const body = await readJson(request);
      const openid = String(body?.openid || '').trim();
      const enabled = body?.enabled !== 0 && body?.enabled !== '0' && body?.enabled !== false;
      if (!openid) throw new HttpError(400, 'invalid_openid', '缺少群 openid');
      const cfg = await getConfig(env, { decrypt: false });
      const list = String(cfg.groupBlacklist || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      const next = enabled ? list.filter((s) => s !== openid) : [...new Set([...list, openid])];
      await saveConfig(env, { groupBlacklist: next.join(',') });
      // 立刻让 DO 重读配置，不等每分钟的巡检（失败也不影响：巡检 1 分钟内会兜底）
      try {
        await callBot(env, 'reload-quiet');
      } catch {}
      return jsonResult({ openid, replyEnabled: enabled });
    }

    case '/api/groups/manage': {
      if (method !== 'GET') throw new HttpError(405, 'method_not_allowed', '请使用 GET');
      const openid = url.searchParams.get('openid') || '';
      if (!openid) throw new HttpError(400, 'invalid_openid', '缺少群 openid');
      const data = await callBot(env, `group-manage?openid=${encodeURIComponent(openid)}`);
      if (!data || data.ok !== true) {
        throw new HttpError(502, 'qq_api', (data && data.error) || 'QQ 接口调用失败');
      }
      return jsonResult(data);
    }

    case '/api/groups/members': {
      if (method !== 'GET') throw new HttpError(405, 'method_not_allowed', '请使用 GET');
      const openid = url.searchParams.get('openid') || '';
      const cursor = url.searchParams.get('cursor') || '';
      if (!openid) throw new HttpError(400, 'invalid_openid', '缺少群 openid');
      const data = await callBot(
        env,
        `group-members?openid=${encodeURIComponent(openid)}&cursor=${encodeURIComponent(cursor)}`
      );
      if (!data || data.ok !== true) {
        throw new HttpError(502, 'qq_api', (data && data.error) || 'QQ 接口调用失败');
      }
      return jsonResult(data);
    }

    case '/api/groups/mute': {
      if (method !== 'POST') throw new HttpError(405, 'method_not_allowed', '请使用 POST');
      const body = await readJson(request);
      const openid = String(body?.openid || '').trim();
      const memberOpenid = String(body?.memberOpenid || '').trim();
      const op = body?.op === 'del' ? 'del' : body?.op === 'update' ? 'update' : 'add';
      const minutes = Number(body?.minutes) || 0;
      if (!openid || !memberOpenid) {
        throw new HttpError(400, 'invalid_openid', '缺少群 openid 或成员 openid');
      }
      if (op !== 'del' && (minutes < 1 || minutes > 30 * 24 * 60)) {
        throw new HttpError(400, 'invalid_minutes', '禁言时长要在 1 分钟 ~ 30 天之间');
      }
      const members = [{ member_openid: memberOpenid, op }];
      if (op !== 'del') {
        // QQ 要求 RFC3339；把时间戳加 8 小时后按 UTC 格式化，墙钟即东八区
        const expire = new Date(Date.now() + minutes * 60000 + 8 * 3600 * 1000);
        members[0].mute_expire_at = expire.toISOString().replace(/\.\d{3}Z$/, '+08:00');
      }
      const data = await callBot(env, 'group-mute', { openid, members });
      if (!data || data.ok !== true) {
        throw new HttpError(502, 'qq_api', (data && data.error) || '禁言设置失败');
      }
      return jsonResult({ openid, memberOpenid, op });
    }

    /* -------- AiDO 沙箱 -------- */

    case '/api/sandboxes': {
      if (method !== 'GET') throw new HttpError(405, 'method_not_allowed', '请使用 GET');
      const rows = await listSandboxes(env);
      const items = [];
      for (const r of rows) {
        items.push({
          scope: r.scope,
          scopeMasked: await maskId(r.scope),
          kind: r.kind,
          runs: r.runs,
          files: r.files,
          lastTask: r.last_task || '',
          updatedAt: r.updated_at,
        });
      }
      return jsonResult({ items });
    }

    case '/api/sandboxes/detail': {
      if (method !== 'POST') throw new HttpError(405, 'method_not_allowed', '请使用 POST');
      const body = await readJson(request);
      const scope = String(body?.scope || '');
      if (!scope) throw new HttpError(400, 'invalid_scope', '缺少 scope');
      if (!env.AIDO) throw new HttpError(503, 'no_aido', 'AiDO 未绑定');
      const stub = env.AIDO.get(env.AIDO.idFromName(scope));
      const res = await stub.fetch('https://aido/state', { method: 'POST', body: '{}' });
      const state = await res.json();
      return jsonResult({ scopeMasked: await maskId(scope), ...state });
    }

    case '/api/sandboxes/clear': {
      if (method !== 'POST') throw new HttpError(405, 'method_not_allowed', '请使用 POST');
      const body = await readJson(request);
      const scope = String(body?.scope || '');
      if (!scope) throw new HttpError(400, 'invalid_scope', '缺少 scope');
      if (env.AIDO) {
        const stub = env.AIDO.get(env.AIDO.idFromName(scope));
        await stub.fetch('https://aido/reset', { method: 'POST', body: '{}' });
      }
      await deleteSandbox(env, scope);
      return jsonResult({ cleared: true });
    }

    /* -------- AI 工作区 -------- */

    case '/api/workspaces': {
      if (method !== 'GET') throw new HttpError(405, 'method_not_allowed', '请使用 GET');
      const rows = await listWorkspaces(env);
      const items = [];
      for (const r of rows) {
        items.push({
          scope: r.scope,
          scopeMasked: await maskId(r.scope),
          kind: r.kind,
          runs: r.runs,
          tasks: r.tasks,
          notes: r.notes,
          lastTask: r.last_task || '',
          updatedAt: r.updated_at,
        });
      }
      return jsonResult({ items });
    }

    case '/api/workspaces/detail': {
      if (method !== 'POST') throw new HttpError(405, 'method_not_allowed', '请使用 POST');
      const body = await readJson(request);
      const scope = String(body?.scope || '');
      if (!scope) throw new HttpError(400, 'invalid_scope', '缺少 scope');
      if (!(env.WORK || env.WORKSPACE)) throw new HttpError(503, 'no_workspace', '工作区未绑定（需要 WORKSPACE 绑定）');
      const stub = (env.WORK || env.WORKSPACE).get((env.WORK || env.WORKSPACE).idFromName(scope));
      const res = await stub.fetch('https://ws/state', { method: 'POST', body: '{}' });
      const state = await res.json();
      return jsonResult({ scopeMasked: await maskId(scope), ...state });
    }

    case '/api/workspaces/clear': {
      if (method !== 'POST') throw new HttpError(405, 'method_not_allowed', '请使用 POST');
      const body = await readJson(request);
      const scope = String(body?.scope || '');
      if (!scope) throw new HttpError(400, 'invalid_scope', '缺少 scope');
      if ((env.WORK || env.WORKSPACE)) {
        const stub = (env.WORK || env.WORKSPACE).get((env.WORK || env.WORKSPACE).idFromName(scope));
        await stub.fetch('https://ws/reset', { method: 'POST', body: '{}' });
      }
      await deleteWorkspace(env, scope);
      return jsonResult({ cleared: true });
    }

    /* -------- 定时提醒 -------- */

    case '/api/reminders':
      if (method === 'GET') {
        const rows = await listReminders(env, { limit: 200 });
        const items = [];
        for (const r of rows) {
          items.push({
            id: r.id,
            dueAt: r.due_at,
            text: r.text,
            isC2C: !!r.is_c2c,
            scopeMasked: await maskId(r.scope_id),
            repeatRule: r.repeat_rule || null,
            status: r.status,
            createdAt: r.created_at,
            firedAt: r.fired_at,
            lastError: r.last_error || null,
          });
        }
        return jsonResult({ items });
      }
      break;

    case '/api/reminders/cancel': {
      if (method !== 'POST') throw new HttpError(405, 'method_not_allowed', '请使用 POST');
      const body = await readJson(request);
      const id = Number(body?.id) || 0;
      if (!id) throw new HttpError(400, 'invalid_id', '缺少提醒 id');
      const cancelled = await cancelReminder(env, id);
      return jsonResult({ id, cancelled });
    }

    default:
      break;
  }

  return jsonFail(404, 'not_found', `没有这个接口: ${method} ${path}`);
}

async function handleRecover(request, env, keyState) {
  const url = new URL(request.url);
  const nonce = randomHex(16);
  const authed = await checkRecoveryToken(env, getCookie(request, RECOVERY_COOKIE));

  if (request.method === 'POST' && url.pathname === '/recover/reset') {
    if (!authed) return redirect('/recover');
    const removed = await resetEncryptedConfig(env);
    console.log('Recovery reset: removed', removed, 'encrypted keys');
    return redirect('/login', 303, { 'Set-Cookie': clearRecoveryCookie() });
  }

  if (request.method === 'POST') {
    const ip = request.headers.get('cf-connecting-ip') || '0.0.0.0';
    const limit = await hitRateLimit(env, `recover:${ip}`, LOGIN_LIMIT);
    if (!limit.allowed) {
      const mins = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 60000));
      return htmlResponse(recoverGatePage(nonce, { error: `尝试次数过多，请 ${mins} 分钟后再试` }), nonce);
    }
    let token = '';
    try {
      const form = await request.formData();
      token = String(form.get('token') || '');
    } catch {

    }
    if (token && (await safeEqual(token, env.ADMIN_TOKEN))) {
      await resetRateLimit(env, [`recover:${ip}`]);
      const value = await makeRecoveryToken(env);
      return redirect('/recover', 303, {
        'Set-Cookie': recoveryCookie(value, Math.floor(RECOVERY_TTL_MS / 1000)),
      });
    }
    return htmlResponse(
      recoverGatePage(nonce, { error: token ? '管理员密钥不正确' : '请输入管理员密钥' }),
      nonce
    );
  }

  if (!authed) return htmlResponse(recoverGatePage(nonce, {}), nonce);
  return htmlResponse(keyRecoveryPage(nonce, { hasKey: keyState.action === 'mismatch' }), nonce);
}

function base64Bytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 站点图标路由：/favicon.svg、/favicon.ico、/favicon-32.png、/apple-touch-icon.png */
const ICON_ROUTES = {
  '/favicon.svg': { type: 'image/svg+xml; charset=utf-8', body: () => FAVICON_SVG },
  '/favicon.ico': { type: 'image/x-icon', body: () => base64Bytes(FAVICON_ICO) },
  '/favicon-32.png': { type: 'image/png', body: () => base64Bytes(FAVICON_PNG_32) },
  '/apple-touch-icon.png': { type: 'image/png', body: () => base64Bytes(APPLE_TOUCH_PNG) },
};

/** 汇总各 Durable Object 的绑定与实例情况（给后台「连接详情」用） */
async function doStatuses(env, data) {
  const count = async (sql) => {
    try {
      const row = await env.DB.prepare(sql).first();
      return row ? Number(row.n) : null;
    } catch {
      return null;
    }
  };
  const workN = await count('SELECT COUNT(*) AS n FROM workspaces');
  const sandboxN = await count('SELECT COUNT(*) AS n FROM sandboxes');
  // chat_log 里出现过的会话数 ≈ ChatDO 实例数（按需创建，闲置会休眠）
  const chatN = await count('SELECT COUNT(DISTINCT scope_id) AS n FROM chat_log');
  const bound = (ns) => !!(ns && typeof ns.idFromName === 'function');
  const running = !!(data && data.running);
  return [
    { name: 'QQ_BOT', cls: 'QQBotDO', unit: '每版本 1 个', instances: 1, state: running ? '运行中' : '已停止', ok: running, note: '网关连接 / 消息分发' },
    { name: 'RATE_LIMITER', cls: 'RateLimiter', unit: '按 IP 创建', instances: null, state: bound(env.RATE_LIMITER) ? '已绑定' : '未绑定', ok: bound(env.RATE_LIMITER), note: '登录 / 接口限流' },
    { name: 'CHAT', cls: 'ChatDO', unit: '每会话 1 个', instances: chatN, state: bound(env.CHAT) ? '已绑定' : '未绑定', ok: bound(env.CHAT), note: '对话历史 + 模型调用' },
    { name: 'WORK', cls: 'WorkDO', unit: '每会话 1 个', instances: workN, state: bound(env.WORK) ? '已绑定' : '未绑定', ok: bound(env.WORK), note: '工具执行 + /工作 任务清单' },
    { name: 'AIDO', cls: 'AiDO', unit: '每会话 1 个', instances: sandboxN, state: bound(env.AIDO) ? '已绑定' : '未绑定', ok: bound(env.AIDO), note: '/沙箱 隔离沙箱' },
  ];
}

async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  const icon = ICON_ROUTES[path];
  if (icon) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    return new Response(request.method === 'HEAD' ? null : icon.body(), {
      headers: {
        'Content-Type': icon.type,
        'Cache-Control': 'public, max-age=604800',
      },
    });
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

  let keyState = { action: 'ok', key: '' };
  if (env.DB) {
    try {
      const schema = await initSchema(env);
      if (!schema.ok) {
        console.error('自动建表失败:', redact(schema.error));
      }
      keyState = await ensureKey(env);
    } catch (err) {
      console.error('schema/ensureKey failed:', redact(err && err.stack ? err.stack : err));
    }
  }

  const keyBroken = keyState.action === 'mismatch' || keyState.action === 'missing';

  if (keyBroken) {
    if (path.startsWith('/api/')) {
      return jsonFail(
        503,
        'enc_key_mismatch',
        'CONFIG_ENC_KEY 与数据库里已加密的数据对不上，请打开 /recover 验证后处理。'
      );
    }
    if (path === '/recover' || path === '/recover/reset') {
      return handleRecover(request, env, keyState);
    }
    return redirect('/recover');
  }

  if (path === '/recover' || path === '/recover/reset') return redirect('/');

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

export { ChatDO, WorkDO, AiDO };
