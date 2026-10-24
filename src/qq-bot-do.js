import {
  addChatLog,
  addReminder,
  claimReminder,
  dueReminders,
  finishReminder,
  getConfig,
  listMemes,
  rescheduleReminder,
  upsertGroup,
} from './db.js';
import { parseReminder, nextDueFrom } from './utils/reminder.js';
import { normalizeFaceTags } from './utils/qq-face.js';
import {
  APP_VERSION,
  QQ_BASE,
  QQ_SANDBOX_BASE,
  INTENT_GROUP_AND_C2C,
  INTENT_ALL_GROUP_AND_C2C,
  QQ_OPCODE,
  WS_CLOSE_REASON,
  WS_FATAL_CLOSE,
} from './constants.js';
import { Logger } from './utils/logger.js';
import { withRetry, createExponentialBackoff } from './utils/retry.js';

const reconnectDelay = createExponentialBackoff();
const MENTION_RE = /<@[!&]?[^>\s]{0,64}>/g;
const MAX_SESSIONS = 100;
const SESSION_IDLE_MS = 60 * 60 * 1000;
const MAX_PENDING_MESSAGES = 100;
// 「原生表情」在群聊/单聊官方 API 里发不了（表情表态仅频道支持），
// 这里用 Unicode emoji 代替：QQ 客户端会按表情样式渲染。
const EMOJIS = [
  '😀', '😄', '😊', '😉', '😍', '🤔', '😅', '😂', '🤣', '😭',
  '😴', '🥹', '😎', '👍', '👏', '🙏', '💪', '🤝', '🎉', '✨',
  '🔥', '💯', '🌟', '☕', '🌙', '🐟', '🍚',
];
// 发图后配的一句话（AI 没写配图文案时兜底；像正常人那样图后还说一句）
const IMAGE_CAPTIONS = ['画好啦，看看喜不喜欢～', '喏，画好了 ✨', '画出来啦，还满意吗？', '给你画好了，慢慢看～'];
const MEME_CAPTIONS = ['（递上梗图）', '看图你就懂了', '这张太应景了', '来，接梗～'];

function stripMentions(text) {
  return String(text ?? '').replace(MENTION_RE, '').trim();
}

/** 字节数组 → base64，分块处理避免大数组爆栈（块大小必须是 3 的倍数，否则拼接处会出现非法 padding） */
function toBase64(bytes) {
  const CHUNK = 3 * 0x4000;
  let out = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.subarray(i, i + CHUNK);
    let bin = '';
    for (let j = 0; j < chunk.length; j++) bin += String.fromCharCode(chunk[j]);
    out += btoa(bin);
  }
  return out;
}

/** base64 → 字节数组（TTS 返回二进制音频时用） */
function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** 按文件魔数识别图片 MIME，避免把非图片内容发给 AI */
function sniffImageMime(bytes, contentType) {
  const h = (len, offset = 0) => {
    let s = '';
    for (let i = offset; i < len + offset && i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return s;
  };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && h(8) === '\x89PNG\r\n\x1a\n') return 'image/png';
  if (bytes.length >= 6 && (h(6) === 'GIF87a' || h(6) === 'GIF89a')) return 'image/gif';
  if (bytes.length >= 12 && h(4) === 'RIFF' && h(4, 8) === 'WEBP') return 'image/webp';
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return 'image/bmp';
  const ct = (contentType || '').toLowerCase();
  if (/^image\/(jpeg|png|gif|webp|bmp)/.test(ct)) return ct.match(/^image\/(jpeg|png|gif|webp|bmp)/)[0];
  return null;
}

export class QQBotDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.ws = null;
    this.running = false;
    this.token = null;
    this.tokenExpiry = 0;
    this.sessions = new Map();
    this.memesCache = null;
    this.heartbeatTimer = null;
    this.config = {};
    this.seq = null;
    this.reconnectTimer = null;
    this.lastError = null;
    this.logger = new Logger('QQBot', 50);
    this.desiredRunning = false;
    this.lastStartAt = 0;
    this.generation = 0;
    this.reconnectAttempt = 0;
    this.tokenPromise = null;
    this.sessionId = null;
    this.resumeSeq = null;
    this.lastClose = null;
    this.identifyFailures = 0;
    this.fatalStop = null;
    this.sessionLimit = null;
    this.quotaWaitUntil = 0;
    this.messageQueues = new Map();
    this.pendingMessages = 0;
    this.msgSeqMap = new Map();
    this.recentMsgIds = new Set();
    this.msgIdFifo = [];
    this.groupBlacklist = new Set();
    this.sensitiveWords = [];
    this.connecting = false;
    this.awaitingAck = false;
    this.retiredFor = null;
    this.retiredAt = 0;

    state.blockConcurrencyWhile(async () => {
      try {
        await this.loadConfig();
        const storedRun = await state.storage.get('desired_running');
        this.desiredRunning = storedRun !== false;
        this.logger.info(`DO init: desiredRunning=${this.desiredRunning}`);
        if (this.desiredRunning) await this.startBot();
      } catch (e) {
        this.lastError = `Init: ${e.message}`;
        this.logger.error(`DO init failed: ${e.message}`);
      }
    });
  }

  isAlive() {
    const s = this.ws && this.ws.readyState;
    return this.running && (s === 0 || s === 1);
  }

  apiBase() {
    return this.config.sandbox === '1' ? QQ_SANDBOX_BASE : QQ_BASE;
  }

  async fetch(request) {
    const url = new URL(request.url);
    switch (url.pathname) {
      case '/start':
        this.fatalStop = null;
        this.identifyFailures = 0;
        this.reconnectAttempt = 0;
        this.quotaWaitUntil = 0;
        await this.loadConfig();
        await this.startBot();
        return Response.json({ ok: true, msg: 'Bot started', started: this.running, error: this.lastError });
      case '/stop':
        await this.stopBot();
        return Response.json({ ok: true, msg: 'Bot stopped' });
      case '/group-manage': {
        // 后台「群管理」：群资料 + 机器人群内状态 + 禁言状态，各自容错（白名单权限可能只有其一）
        const openid = url.searchParams.get('openid') || '';
        if (!openid) return Response.json({ ok: false, error: '缺少群 openid' });
        const [info, state, mute] = await Promise.all([
          this.qqGroupInfo(openid).catch((e) => ({ __error: e.message })),
          this.qqBotState(openid).catch((e) => ({ __error: e.message })),
          this.qqMuteState(openid).catch((e) => ({ __error: e.message })),
        ]);
        return Response.json({
          ok: true,
          info: info.__error ? null : info,
          infoError: info.__error || null,
          state: state.__error ? null : state,
          stateError: state.__error || null,
          muteState: mute.__error ? null : mute,
          muteError: mute.__error || null,
        });
      }
      case '/group-members': {
        const openid = url.searchParams.get('openid') || '';
        const cursor = url.searchParams.get('cursor') || '';
        if (!openid) return Response.json({ ok: false, error: '缺少群 openid' });
        try {
          const r = await this.qqGroupMembers(openid, cursor);
          return Response.json({
            ok: true,
            members: Array.isArray(r.members) ? r.members : [],
            nextCursor: String(r.next_cursor || ''),
          });
        } catch (e) {
          return Response.json({ ok: false, error: e.message });
        }
      }
      case '/group-mute': {
        // body: { openid, members: [{op, member_openid, mute_expire_at}] }
        let body = null;
        try {
          body = await request.json();
        } catch {}
        const openid = body && body.openid;
        const members = body && Array.isArray(body.members) ? body.members : [];
        if (!openid || !members.length) {
          return Response.json({ ok: false, error: '缺少群 openid 或成员列表' });
        }
        try {
          await this.qqMuteMembers(openid, members);
          return Response.json({ ok: true });
        } catch (e) {
          return Response.json({ ok: false, error: e.message });
        }
      }
      case '/reload': {
        // 后台改完配置/AI 后调用：立即热更新，不用重启机器人
        const prevWelcome = this.config.welcomeEnabled;
        await this.loadConfig();
        this.logSystem('后台修改配置，已热更新生效');
        if (this.running && prevWelcome !== this.config.welcomeEnabled) {
          this.logger.info('welcome 开关变化，重启连接以应用新 intents');
          this.teardown();
          this.state.waitUntil(this.startBot());
        }
        return Response.json({ ok: true, reloaded: true, running: this.running });
      }
      case '/reload-quiet':
        // 群回复开关这类轻量配置变更：只重读配置立即生效，不写系统日志、不动 WebSocket
        await this.loadConfig();
        return Response.json({ ok: true, reloaded: true, running: this.running });
      case '/ensure': {
        // 每分钟 cron 看门狗顺带热更新配置：即使 reload 通知丢了，配置最多 1 分钟内也会生效
        try { await this.loadConfig(); } catch {}
        // 到点的定时提醒 / 清理长时间不用的会话
        try { await this.fireDueReminders(); } catch (e) { this.logger.warn(`Reminder scan: ${e.message}`); }
        if (this.state && typeof this.state.waitUntil === 'function') {
          this.state.waitUntil(this.pruneStoredSessions());
        }
        const workerVersion = url.searchParams.get('v') || '';
        if (workerVersion && workerVersion !== APP_VERSION) {
          const now = Date.now();
          if (this.retiredFor !== workerVersion) {
            this.retiredFor = workerVersion;
            this.retiredAt = now;
            this.logger.warn(
              `版本不一致：DO v${APP_VERSION} / Worker v${workerVersion}，断开连接让新实例接管`
            );
            this.teardown();
            return Response.json({ ok: true, action: 'retire', version: APP_VERSION });
          }
          if (now - this.retiredAt < 180000) {
            return Response.json({ ok: true, action: 'retiring', version: APP_VERSION });
          }
          this.logger.error('等待新实例超过 3 分钟，继续以旧版本运行');
        }

        if (!this.desiredRunning) return Response.json({ ok: true, action: 'idle' });
        if (this.fatalStop) return Response.json({ ok: true, action: 'halted', error: this.fatalStop });
        if (Date.now() < this.quotaWaitUntil) {
          return Response.json({ ok: true, action: 'quota-wait', until: new Date(this.quotaWaitUntil).toISOString() });
        }
        if (this.isAlive()) return Response.json({ ok: true, action: 'alive' });
        if (Date.now() - this.lastStartAt < 90000) {
          return Response.json({ ok: true, action: 'starting' });
        }
        this.logger.info('Watchdog: connection lost, restarting');
        this.teardown();
        await this.startBot();
        return Response.json({ ok: true, action: 'restarted', running: this.running });
      }
      case '/status': {
        const now = Date.now();
        const aiList = (this.config.aiProviders || []).filter(
          (p) => p && p.enabled !== 0 && p.baseUrl && p.apiKey && p.model
        );
        const aiReady = aiList.length > 0;
        const qqReady = !!(this.config.appId && this.config.secret);
        return Response.json({
          version: APP_VERSION,
          running: this.running,
          desiredRunning: this.desiredRunning,
          wsState: this.ws?.readyState,
          sessionCount: this.sessions.size,
          tokenValid: !!(this.token && now < this.tokenExpiry),
          tokenExpiry: this.tokenExpiry,
          sessionId: this.sessionId || null,
          identifyFailures: this.identifyFailures,
          fatalStop: this.fatalStop,
          lastClose: this.lastClose,
          sessionLimit: this.sessionLimit,
          quotaWaitUntil: this.quotaWaitUntil || null,
          sandbox: this.config.sandbox === '1',
          apiBase: this.apiBase(),
          lastError: this.lastError,
          
          qqReady,
          aiReady,
          aiCount: aiList.length,
          aiModel: aiList.length ? aiList[0].model : '',
          historyLimit: Number(this.config.historyLimit) || 20,
          markdownReply: this.config.markdownReply === '1',
          autoRecall: this.config.autoRecall === '1',
          welcomeEnabled: this.config.welcomeEnabled === '1',
          lastStartAt: this.lastStartAt || null,
          lastCloseAt: this.lastClose && this.lastClose.at ? this.lastClose.at : null,
          verifiedAt: this.logger.logs.length ? this.logger.logs[this.logger.logs.length - 1].at : now,
          logs: this.logger.getLogs(30),
        });
      }
      case '/debug':
        return Response.json({
          version: APP_VERSION,
          running: this.running,
          desiredRunning: this.desiredRunning,
          wsState: this.ws?.readyState,
          token: this.token ? 'set' : 'missing',
          tokenExpiry: this.tokenExpiry,
          sessionId: this.sessionId || 'none',
          identifyFailures: this.identifyFailures,
          fatalStop: this.fatalStop,
          lastClose: this.lastClose,
          sessionLimit: this.sessionLimit,
          quotaWaitUntil: this.quotaWaitUntil || null,
          sandbox: this.config.sandbox === '1',
          apiBase: this.apiBase(),
          configKeys: Object.keys(this.config),
          appId: this.config.appId || 'missing',
          secret: this.config.secret ? 'set' : 'missing',
          aiCount: (this.config.aiProviders || []).length,
          aiModels: (this.config.aiProviders || []).map((p) => (p.enabled !== 0 ? p.model : `${p.model}(停用)`)),
          lastError: this.lastError,
          logs: this.logger.getLogs(30),
        });
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  async loadConfig() {
    const config = await getConfig(this.env);
    if (config.appId !== this.config.appId || config.secret !== this.config.secret || config.sandbox !== this.config.sandbox) {
      this.token = null;
      this.tokenExpiry = 0;
      this.tokenPromise = null;
      this.sessionId = null;
      this.resumeSeq = null;
      
      this.sessionLimit = null;
      this.quotaWaitUntil = 0;
    }
    this.config = config;
    this.groupBlacklist = new Set((config.groupBlacklist || '').split(/[,，]/).map(s => s.trim()).filter(Boolean));
    this.sensitiveWords = (config.sensitiveWords || '').split(/[,，]/).map(s => s.trim()).filter(Boolean);
    this.logger.info(`Config loaded (v${APP_VERSION}), keys: ${Object.keys(config).join(',')}`);
  }

  async refreshToken() {
    const { appId, secret } = this.config;
    if (!appId || !secret) throw new Error('Missing appId or secret in config');

    this.logger.info(`Refreshing token for appId=${appId}`);

    return withRetry(async () => {
      const res = await fetch(`${this.apiBase()}/app/getAppAccessToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, clientSecret: secret }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const error = new Error(`Token refresh failed: HTTP ${res.status}${text ? ` ${text.slice(0, 200)}` : ''}`);
        error.retryable = res.status >= 500;
        throw error;
      }
      const data = await res.json();
      if (!data.access_token) {
        
        const detail = data.code
          ? `code=${data.code}${data.message ? ` ${data.message}` : ''}`
          : JSON.stringify(data).slice(0, 200);
        const error = new Error(`Token 获取失败: ${detail}`);
        error.retryable = data.code === 100001; 
        throw error;
      }
      return data;
    }, {
      maxAttempts: 2,
      delay: 1000,
      shouldRetry: (err) => err.retryable !== false,
      onRetry: (err, attempt) => {
        this.logger.warn(`Token refresh retry ${attempt}: ${err.message}`);
      }
    });
  }

  async getToken() {
    if (this.token && Date.now() < this.tokenExpiry) return this.token;
    if (!this.tokenPromise) {
      const pending = this.refreshToken().then((data) => {
        if (this.tokenPromise !== pending) throw new Error('QQ credentials changed');
        const ttl = Number(data.expires_in) || 7200;
        const ttlMs = Math.max(1, ttl) * 1000;
        
        const margin = Math.min(30000, Math.floor(ttlMs / 10));
        const next = Date.now() + ttlMs - margin;
        const unchanged = Boolean(this.token) && data.access_token === this.token;
        this.token = data.access_token;
        
        this.tokenExpiry = unchanged ? Math.min(next, this.tokenExpiry || next) : next;
        this.logger.info(
          `Token refreshed successfully (ttl=${ttl}s${unchanged ? '，返回值未变，保留原有效期' : ''})`
        );
        return this.token;
      }).finally(() => {
        if (this.tokenPromise === pending) this.tokenPromise = null;
      });
      this.tokenPromise = pending;
    }
    return this.tokenPromise;
  }

  async startBot() {
    if (this.running) return;
    if (this.fatalStop) {
      this.logger.error(`Start blocked: ${this.fatalStop}`);
      return;
    }
    if (this.quotaWaitUntil && Date.now() < this.quotaWaitUntil) {
      this.lastError = `会话配额未恢复，等待至 ${new Date(this.quotaWaitUntil).toISOString()}`;
      this.logger.warn(this.lastError);
      return;
    }
    const generation = ++this.generation;
    this.running = true;
    this.desiredRunning = true;
    this.lastStartAt = Date.now();
    this.lastError = null;
    this.reconnectAttempt = 0;
    try {
      await this.state.storage.put('desired_running', true);
      const token = await this.getToken();
      if (!this.running || generation !== this.generation) return;
      const gwRes = await fetch(`${this.apiBase()}/gateway/bot`, {
        headers: {
          Authorization: `QQBot ${token}`,
          'User-Agent': 'qq-bot-cf/1.0',
        },
        signal: AbortSignal.timeout(5000),
      });
      if (!gwRes.ok) {
        const text = await gwRes.text().catch(() => '');
        throw new Error(`Gateway: HTTP ${gwRes.status}${text ? ` ${text.slice(0, 200)}` : ''}`);
      }
      const gwData = await gwRes.json();
      if (!this.running || generation !== this.generation) return;
      if (!gwData.url) throw new Error(`Gateway returned empty URL: ${JSON.stringify(gwData).slice(0, 200)}`);
      const limit = gwData.session_start_limit;
      if (limit) {
        this.sessionLimit = limit;
        const remaining = Number(limit.remaining);
        const resetMs = Number(limit.reset_after) || 0;
        this.logger.info(
          `Gateway ok: shards=${gwData.shards ?? '?'} session_left=${limit.remaining}/${limit.total} reset_after=${Math.round(resetMs / 1000)}s max_concurrency=${limit.max_concurrency ?? '?'}`
        );
        if (Number.isFinite(remaining) && remaining <= 0) {
          
          const waitMs = Math.max(60000, resetMs + 10000);
          this.quotaWaitUntil = Date.now() + waitMs;
          this.lastError = `会话配额已用尽 (0/${limit.total})，约 ${Math.round(waitMs / 60000)} 分钟后自动重试`;
          this.logger.error(this.lastError);
          this.running = false;
          await this.state.storage.put('desired_running', true);
          return;
        }
      }
      this.state.waitUntil(this.connectWS(gwData.url, generation));
    } catch (e) {
      if (generation !== this.generation) return;
      this.lastError = e.message;
      this.logger.error(`Start failed: ${e.message}`);
      this.running = false;
    }
  }

  teardown() {
    this.generation++;
    this.running = false;
    this.connecting = false;
    this.awaitingAck = false;
    this.seq = null;
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) { try { this.ws.close(1000, 'Stopping'); } catch (_) {} this.ws = null; }
  }

  async stopBot() {
    this.teardown();
    this.desiredRunning = false;
    await this.state.storage.put('desired_running', false);
    this.logger.info('Bot stopped');
  }

  scheduleReconnect(wsUrl, generation, reason = '') {
    if (!this.running || generation !== this.generation || this.reconnectTimer) return;
    if (this.fatalStop) {
      this.logger.error(`Stop reconnecting: ${this.fatalStop}`);
      this.teardown();
      return;
    }
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    const ws = this.ws;
    this.ws = null;
    this.connecting = false;
    this.resumeSeq = this.seq;
    this.seq = null;
    const nextGeneration = ++this.generation;
    if (ws) { try { ws.close(1000, 'Reconnecting'); } catch {} }
    
    const base = reconnectDelay(++this.reconnectAttempt);
    
    const conc = Number(this.sessionLimit?.max_concurrency) || 1;
    const floor = Math.max(5000, conc * 5000);
    const delay = Math.max(floor, this.identifyFailures >= 5 ? 5 * 60 * 1000 : base)
      + Math.floor(Math.random() * 1000);
    this.logger.warn(`Reconnect in ${Math.round(delay / 1000)}s${reason ? ` (${reason})` : ''}`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.state.waitUntil(this.connectWS(wsUrl, nextGeneration));
    }, delay);
  }

  async connectWS(wsUrl, generation) {
    if (!this.running || generation !== this.generation || this.connecting || this.fatalStop) return;
    this.connecting = true;
    let ws = null;
    try {
      const httpUrl = wsUrl.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');
      const ac = new AbortController();
      const handshakeTimer = setTimeout(() => ac.abort(), 10000);
      let resp;
      try {
        resp = await fetch(httpUrl, {
          headers: { Upgrade: 'websocket' },
          signal: ac.signal,
        });
      } finally {
        clearTimeout(handshakeTimer);
      }
      ws = resp.webSocket;
      if (!ws) {
        await resp.body?.cancel();
        throw new Error(`WebSocket upgrade failed: HTTP ${resp.status}`);
      }
      ws.accept();
      if (!this.running || generation !== this.generation) {
        ws.close(1000, 'Stale connection');
        if (generation === this.generation) this.connecting = false;
        return;
      }
      this.ws = ws;
      this.connecting = false;
      this.seq = null;
      this.logger.info('WebSocket connected');
      const isCurrent = () => this.running && generation === this.generation && this.ws === ws;

      ws.addEventListener('message', (event) => {
        if (!isCurrent()) return;
        const msg = (() => {
          try { return JSON.parse(event.data); } catch { return null; }
        })();
        if (!msg) return;
        this.state.waitUntil(this.dispatchMessage(msg, ws, wsUrl, generation));
      });
      ws.addEventListener('close', (event) => {
        const why = WS_CLOSE_REASON[event.code] || '';
        this.lastClose = { code: event.code, reason: event.reason || '', meaning: why, at: Date.now() };
        
        if (!isCurrent()) {
          if (event.code !== 1000) this.logger.warn(`WS closed (stale): code=${event.code}${why ? ' ' + why : ''}`);
          return;
        }
        this.logger.warn(`WS closed: code=${event.code}${why ? ' ' + why : ''}`);
        if (WS_FATAL_CLOSE.has(event.code)) {
          this.fatalStop = `网关拒绝连接：code=${event.code}${why ? ' ' + why : ''}`;
          this.lastError = this.fatalStop;
        }
        this.scheduleReconnect(wsUrl, generation, `close ${event.code}`);
      });
      ws.addEventListener('error', () => {
        if (!isCurrent()) return;
        this.lastError = 'WebSocket error';
        this.scheduleReconnect(wsUrl, generation, 'ws error');
      });
    } catch (e) {
      if (generation !== this.generation) return;
      this.connecting = false;
      if (this.running) {
        this.lastError = `WS connect: ${e.message}`;
        this.logger.error(this.lastError);
        this.scheduleReconnect(wsUrl, generation, 'connect failed');
      }
    }
  }

  async dispatchMessage(msg, ws, wsUrl, generation) {
    const isCurrent = () => this.running && generation === this.generation && this.ws === ws;
    if (!isCurrent()) return;
    const { op, t, s, d } = msg;

    if (op === QQ_OPCODE.HELLO) {
      this.awaitingAck = false;
      let token;
      try {
        token = await this.getToken();
      } catch (e) {
        this.lastError = `Token: ${e.message}`;
        this.logger.error(this.lastError);
        this.scheduleReconnect(wsUrl, generation);
        return;
      }
      if (!isCurrent()) return;
      const interval = Number(d?.heartbeat_interval) || 45000;
      if (this.sessionId && this.resumeSeq != null) {
        
        this.logger.info(`Resuming session ${this.sessionId} @ seq=${this.resumeSeq}`);
        ws.send(JSON.stringify({
          op: QQ_OPCODE.RESUME,
          d: { token: `QQBot ${token}`, session_id: this.sessionId, seq: this.resumeSeq },
        }));
      } else {
        const intents = this.config.welcomeEnabled === '1' ? INTENT_ALL_GROUP_AND_C2C : INTENT_GROUP_AND_C2C;
        this.logger.info(`Identifying: intents=${intents} shard=[0,1]`);
        ws.send(JSON.stringify({
          op: QQ_OPCODE.IDENTIFY,
          d: {
            token: `QQBot ${token}`,
            intents,
            shard: [0, 1],
            properties: { $os: 'linux', $browser: 'qq-bot-cf', $device: 'qq-bot-cf' },
          },
        }));
      }
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = setInterval(() => {
        if (!isCurrent()) return;
        if (this.awaitingAck) {
          this.lastError = 'Heartbeat acknowledgement timed out';
          this.scheduleReconnect(wsUrl, generation, 'heartbeat ack timeout');
          return;
        }
        try {
          ws.send(JSON.stringify({ op: QQ_OPCODE.HEARTBEAT, d: this.seq }));
          this.awaitingAck = true;
        } catch {
          this.scheduleReconnect(wsUrl, generation, 'heartbeat send failed');
        }
      }, interval);
      return;
    }

    if (op === QQ_OPCODE.HEARTBEAT_ACK) {
      this.awaitingAck = false;
      return;
    }

    if (op === QQ_OPCODE.DISPATCH) {
      if (s != null) this.seq = s;
      if (t === 'READY') {
        this.reconnectAttempt = 0;
        this.identifyFailures = 0;
        this.lastError = null;
        this.sessionId = d?.session_id || null;
        this.logger.info(`Bot ready: ${d?.user?.username} session=${this.sessionId || 'none'}`);
      } else if (t === 'RESUMED') {
        this.reconnectAttempt = 0;
        this.identifyFailures = 0;
        this.lastError = null;
        this.logger.info('Session resumed');
      } else if (t === 'GROUP_AT_MESSAGE_CREATE' || t === 'GROUP_MESSAGE_CREATE' || t === 'C2C_MESSAGE_CREATE') {
        await this.handleMessage(t, d);
      } else if (t === 'GROUP_MEMBER_ADD') {
        this.state.waitUntil(this.handleGroupMemberAdd(d));
      } else if (t === 'GROUP_ADD_ROBOT') {
        this.state.waitUntil(this.handleGroupAddRobot(d));
      }
      return;
    }

    if (op === QQ_OPCODE.RECONNECT || op === QQ_OPCODE.INVALID_SESSION) {
      const label = op === QQ_OPCODE.INVALID_SESSION ? 'INVALID_SESSION' : 'RECONNECT';
      this.logger.warn(`Gateway ${label} (op=${op}) d=${JSON.stringify(d ?? null)}`);
      if (op === QQ_OPCODE.INVALID_SESSION) {
        
        this.sessionId = null;
        this.resumeSeq = null;
        this.identifyFailures++;
        this.lastError = `网关拒绝鉴权 (op9 INVALID_SESSION, 第 ${this.identifyFailures} 次, intents=${INTENT_GROUP_AND_C2C})`;
      }
      this.scheduleReconnect(wsUrl, generation, label);
    }
  }

  /** 新成员加入群聊：发欢迎语（支持 @新成员 占位符） */
  async handleGroupMemberAdd(data) {
    if (this.config.welcomeEnabled !== '1') return;
    const groupOpenid = data?.group_openid;
    const memberOpenid = data?.member_openid;
    if (!groupOpenid || !memberOpenid) return;
    this.touchGroup(groupOpenid);
    if (this.groupBlacklist.has(groupOpenid)) return;
    const raw = String(this.config.welcomeMsg || '').trim();
    if (!raw) return;
    let text = raw
      .replace(/\{member\}/g, `<qqbot-at-user id="${memberOpenid}" />`)
      .replace(/\{group\}/g, groupOpenid)
      .slice(0, 1500);
    await this.sendReply({ isC2C: false, scopeId: groupOpenid, content: text, msgId: '' });
    this.logSystem('新成员加入群聊，已自动发送欢迎语');
  }

  /** 机器人被拉进新群 */
  async handleGroupAddRobot(data) {
    const groupOpenid = data?.group_openid;
    if (!groupOpenid) return;
    this.touchGroup(groupOpenid);
    this.logger.info(`Bot added to group ${groupOpenid.slice(0, 8)}...`);
    const raw = String(this.config.welcomeMsg || '').trim();
    if (!raw || this.config.welcomeEnabled !== '1') return;
    await this.sendReply({ isC2C: false, scopeId: groupOpenid, content: raw.slice(0, 1500), msgId: '' });
    this.logSystem('机器人加入新群，已发送欢迎语');
  }

  /** 系统事件写入聊天记录（kind=system），失败不影响主流程 */
  logSystem(text) {
    addChatLog(this.env, {
      kind: 'system',
      scopeId: 'system',
      userId: '',
      userContent: String(text || '').slice(0, 500),
      aiReply: '',
      model: null,
    }).catch(() => {});
  }

  /** 把一次「非文本回复」（发图 / 发梗图 / 指令回复）也写进聊天记录，后台才能看到完整对话 */
  logExchange({ isC2C, scopeId, userId, userContent, aiReply, model }) {
    addChatLog(this.env, {
      kind: isC2C ? 'c2c' : 'group',
      scopeId,
      userId,
      userContent: String(userContent ?? '').slice(0, 500),
      aiReply: String(aiReply ?? '').slice(0, 500),
      model: model || null,
    }).catch((e) => this.logger.warn(`Chat log write failed: ${e.message}`));
  }

  /** 记录群 openid 到 D1 groups 表（后台「群管理」页的数据源），失败不影响主流程 */
  touchGroup(openid) {
    upsertGroup(this.env, openid, 'auto').catch(() => {});
  }

  async handleMessage(type, data) {
    if (this.pendingMessages >= MAX_PENDING_MESSAGES) {
      this.logger.warn('Message backlog full, dropping event');
      return;
    }

    const isC2C = type === 'C2C_MESSAGE_CREATE';
    const author = data.author || {};
    const userId = isC2C ? author.user_openid : author.member_openid;
    const scopeId = isC2C ? userId : data.group_openid;
    if (!userId || !scopeId) return;

    const dedupeKey = `${data.id || ''}#${data.seq || ''}`;
    if (dedupeKey !== '#' && this.recentMsgIds.has(dedupeKey)) {
      this.logger.info(`Dropped duplicate message ${dedupeKey}`);
      return;
    }
    if (dedupeKey !== '#') {
      this.recentMsgIds.add(dedupeKey);
      this.msgIdFifo.push(dedupeKey);
      if (this.msgIdFifo.length > 500) this.recentMsgIds.delete(this.msgIdFifo.shift());
    }

    let content = normalizeFaceTags(stripMentions(data.content));
    if (/^@\S+\s+/.test(content)) content = content.replace(/^@\S+\s+/, '');
    const attachments = Array.isArray(data.attachments) ? data.attachments : [];
    const imageUrl = attachments[0]?.url || null;
    if (attachments.length) {
      this.logger.info(
        `Inbound attachments: n=${attachments.length} first=${JSON.stringify(attachments[0]).slice(0, 160)}`
      );
    } else if (imageUrl) {
      this.logger.info(`Inbound image url=${imageUrl.slice(0, 80)}...`);
    }
    if (!content && !imageUrl) return;
    if (!content) content = '请描述这张图片';

    if (!isC2C && this.groupBlacklist.has(scopeId)) return;
    if (this.sensitiveWords.some((w) => content.includes(w))) return;

    const key = isC2C ? `c2c:${userId}` : `group:${scopeId}`;
    if (!isC2C) this.touchGroup(scopeId);
    const job = { isC2C, userId, scopeId, content, imageUrl, msgId: data.id };

    this.pendingMessages++;
    const prev = this.messageQueues.get(key) || Promise.resolve();
    const next = prev
      .catch(() => {})
      .then(() => this.processMessage(key, job))
      .catch((e) => this.logger.error(`Handle error: ${e.message}`))
      .finally(() => {
        this.pendingMessages--;
        if (this.messageQueues.get(key) === next) this.messageQueues.delete(key);
      });
    this.messageQueues.set(key, next);
  }

  async processMessage(key, job) {
    const { isC2C, userId, scopeId, content, imageUrl, msgId } = job;

    // 梗图缓存（首次读取 D1，之后走内存；失败不阻塞聊天）
    await this.ensureMemes().catch(() => {});

    // /菜单 指令：发送带按钮的面板（指令按钮自动往输入框填 @我 内容，跳转按钮直接开链接）
    if (/^\/?(菜单|menu|按钮)(\s|$)/i.test(content)) {
      await this.sendMenu({ isC2C, scopeId, msgId });
      return;
    }

    // /帮助 指令：列出机器人能干什么（后台开了 Markdown 回复时用排版版，否则用纯文本版）
    if (/^\/?(帮助|help|指令|命令)(\s|$)/i.test(content)) {
      const md = this.config.markdownReply === '1';
      await this.sendReply({
        isC2C,
        scopeId,
        msgId,
        content: md
          ? [
              '## 🤖 指令帮助',
              '',
              '**💬 聊天**',
              '直接 @我 说点什么就行；发图片给我可以看图说话',
              '',
              '**🎨 AI 生图**',
              '/画 一只橘猫，水彩风格',
              '也可以直接说「画一张…」「生成一张…」',
              '',
              '**⏰ 定时提醒**',
              '直接说「10 分钟后提醒我喝水」「明天 8 点提醒我开会」「每天 8:00 提醒我背单词」',
              '到点我会主动发消息；重复提醒会自动顺延',
              '',
              '**😄 表情与梗图**',
              '/梗图 —— 随机来一张内置梗图；/梗图 名字 指定一张',
              '/表情 —— 随机一个 emoji',
              '',
              '**🔊 语音**',
              '/语音 你好呀 —— 用内置 TTS 合成语音发给你（不需要额外 Key）',
              '',
              '**🧰 指令**',
              '- /菜单 —— 弹出按钮面板',
              '- /撤回 —— 撤回我上一条消息',
              '- /帮助 —— 显示本帮助',
            ].join('\n')
          : [
              '🤖 指令帮助',
              '',
              '💬 聊天：直接 @我 说点什么，发图片给我可以看图说话',
              '🎨 生图：/画 一只橘猫，水彩风格（说「画一张…」也行）',
              '⏰ 提醒：「10 分钟后提醒我喝水」「明天 8 点提醒我开会」「每天 8:00 提醒我背单词」',
              '😄 表情：/梗图 随机梗图，/梗图 名字 指定，/表情 随机 emoji',
              '🔊 语音：/语音 你好呀 —— 内置 TTS 合成语音',
              '🧰 指令：/菜单 弹出按钮面板 · /撤回 撤回我上一条 · /帮助 看这条',
            ].join('\n'),
      });
      return;
    }

    // /撤回 指令：撤回本会话最近一条机器人消息
    if (/^\/?(撤回|recall|undo)(\s|$)/.test(content)) {
      const session = await this.loadSession(key);
      const lastBotMsg = session?.lastBotMsg;
      if (!lastBotMsg) {
        await this.sendReply({ isC2C, scopeId, content: '没有可以撤回的消息～', msgId });
        return;
      }
      const ok = await this.recallMessage({ isC2C, scopeId, msgId: lastBotMsg.msgId });
      session.lastBotMsg = null;
      await this.saveSession(key, session);
      if (ok) {
        this.logger.info(`Recalled message in ${isC2C ? 'c2c' : 'group'} ${scopeId.slice(0, 8)}...`);
      } else {
        await this.sendReply({ isC2C, scopeId, content: '撤回失败（可能已超过 2 分钟）', msgId });
      }
      return;
    }

    // /画 指令：调用生图模型画图
    if (/^\/?(画图|画|image|draw|生成图片|生成图)(\s|$)/.test(content)) {
      const prompt = content.replace(/^\/?(画图|画|image|draw|生成图片|生成图)\s*/, '').trim();
      if (!prompt) {
        await this.sendReply({ isC2C, scopeId, content: '用法：/画 一只橘猫，水彩风格', msgId });
        return;
      }
      await this.handleImageGen({ isC2C, scopeId, msgId, prompt, userId, userContent: content });
      return;
    }

    // 自然语言直接点「画图」：不绕对话模型，直接生图
    const genIntent = content.match(
      /^(?:帮我|给我|请|麻烦)?\s*(?:画一张|画一幅|画一个|画一只|画只|画张|画幅|画个|画一下|画图|画图片|绘制一张|绘制一幅|绘制一个|绘制图|绘制|生成一张图|生成一幅图|生成一张|生成一幅|生成一个|生成图片|生成图|生成个|来一张)\s*(.+)$/s
    );
    if (genIntent) {
      // 「画张图」这类没带主体的，去掉量词后为空就提示用法，别拿「图」当提示词去画
      const genPrompt = genIntent[1].trim().replace(/^(?:一张|一幅|一个|一只|只|个|张|幅|下|图)\s*/, '').trim();
      // 「生成一张表格/二维码」这类不是要画画的，交给对话模型处理
      const notDrawing = /二维码|条形码|表格|代码|文档|名单|清单|报告|文件|链接|文案|密码/.test(genPrompt);
      if (!notDrawing) {
        if (!genPrompt) {
          await this.sendReply({ isC2C, scopeId, content: '画什么？用法：/画 一只橘猫，水彩风格', msgId });
          return;
        }
        if (!this.config.imageGenModel) {
          await this.sendReply({
            isC2C,
            scopeId,
            content: '我还没接上生图能力——打开后台「生图模型」页，填好模型名，点「测试」通过后保存，我就能画了。',
            msgId,
          });
          return;
        }
        await this.handleImageGen({ isC2C, scopeId, msgId, prompt: genPrompt, userId, userContent: content });
        return;
      }
    }

    // /梗图 /表情包：发内置梗图（不写名字就随机来一张）
    if (/^\/?(梗图|表情包|meme)(\s|$)/i.test(content)) {
      const name = content.replace(/^\/?(梗图|表情包|meme)\s*/i, '').trim();
      const sent = await this.sendMeme({ isC2C, scopeId, msgId, name, userId, userContent: content });
      if (!sent) {
        const names = (this.memesCache || []).map((m) => m.name);
        if (!names.length) {
          await this.sendReply({ isC2C, scopeId, msgId, content: '梗图库还空着——部署时会自动导入，稍后再试～' });
        } else if (name) {
          await this.sendReply({
            isC2C,
            scopeId,
            msgId,
            content: `没有叫「${name}」的梗图～ 现有：${names.slice(0, 5).join('、')}…（不写名字就随机来一张）`,
          });
        } else {
          await this.sendReply({ isC2C, scopeId, msgId, content: '梗图发送失败了，稍后再试一次吧～' });
        }
      }
      return;
    }

    // /表情：发一个 emoji（官方接口不支持群聊/单聊发原生表情包，用 Unicode emoji 代替）
    if (/^\/?(表情|emoji)(\s|$)/i.test(content)) {
      await this.sendReply({
        isC2C,
        scopeId,
        msgId,
        content: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      });
      return;
    }

    // /语音 文字：内置 TTS（Workers AI MeloTTS）合成语音发送
    if (/^\/?(语音|voice)(\s|$)/i.test(content)) {
      const text = content.replace(/^\/?(语音|voice)\s*/i, '').trim();
      if (!text) {
        await this.sendReply({ isC2C, scopeId, content: '用法：/语音 你好呀（用内置 TTS 合成语音）', msgId });
        return;
      }
      const sent = await this.sendVoice({ isC2C, scopeId, msgId, text, userId, userContent: content });
      if (!sent) {
        await this.sendReply({
          isC2C,
          scopeId,
          content: '语音合成失败了（可能是 Workers AI 没启用或额度用完），稍后再试～',
          msgId,
        });
      }
      return;
    }

    // 定时提醒：识别「X 点提醒我…」直接落库，不绕 AI（AI 未配置也能用）
    const reminderIntent = parseReminder(content);
    if (reminderIntent) {
      await addReminder(this.env, {
        scopeKey: key,
        isC2C,
        scopeId,
        dueAt: reminderIntent.dueAt,
        text: reminderIntent.text,
        repeatRule: reminderIntent.repeatRule,
      });
      const whenText =
        reminderIntent.whenText ||
        new Date(reminderIntent.dueAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
      const warn = isC2C ? '' : await this.proactiveWarning(scopeId);
      await this.sendReply({
        isC2C,
        scopeId,
        content: `⏰ 好的，${whenText}提醒你：${reminderIntent.text}${reminderIntent.repeatRule ? '（以后按这个时间重复提醒）' : ''}${warn}`,
        msgId,
      });
      this.logSystem(`新增定时提醒：${reminderIntent.text.slice(0, 60)} @ ${reminderIntent.dueAt}`);
      return;
    }

    // 单聊：AI 思考期间给「正在输入」反馈（官方 msg_type=6），失败静默
    if (isC2C && msgId) this.state.waitUntil(this.sendTyping({ scopeId, msgId }));

    const providers = (this.config.aiProviders || []).filter(
      (p) => p && p.enabled !== 0 && p.baseUrl && p.apiKey && p.model
    );
    if (!providers.length) {
      this.logger.warn('No AI available (去后台「AI 对话」添加并启用一个)');
      return;
    }

    const historyLimit = Number(this.config.historyLimit) || 20;
    let session = await this.loadSession(key);
    if (!session) {
      this.pruneSessions();
      session = {
        history: [{ role: 'system', content: this.buildSystemPrompt() }],
        lastUsed: Date.now(),
        lastBotMsg: null,
        sysKey: this.sysKey(),
        summary: '',
      };
      this.sessions.set(key, session);
    }
    session.lastUsed = Date.now();
    // 后台改了人设/生图模型后，已有会话的系统提示词立即跟随（聊天记录保留）
    const sysKey = this.sysKey();
    if (session.sysKey !== sysKey) {
      session.history[0] = { role: 'system', content: this.buildSystemPrompt() };
      session.sysKey = sysKey;
      this.logger.info(`System prompt refreshed for session ${key.slice(0, 24)}...`);
    }

    const history = session.history;
    history.push({ role: 'user', content });
    while (history.length > historyLimit + 1) history.splice(1, 1);

    const msgs = history.slice();
    // 早前对话的压缩摘要（历史被裁剪后，长期记忆靠它保留）
    if (session.summary) msgs.splice(1, 0, { role: 'system', content: `【早前对话摘要】${session.summary}` });
    let aiImage = null;
    if (imageUrl) {
      aiImage = await this.downloadImageAsBase64(imageUrl);
      if (aiImage) {
        msgs[msgs.length - 1] = {
          role: 'user',
          content: [
            { type: 'text', text: content },
            { type: 'image_url', image_url: { url: aiImage } },
          ],
        };
      } else {
        this.logger.warn('Image download failed, sending text-only to AI');
      }
    }

    let reply = null;
    let aiErr = null;
    let used = null;

    for (const provider of providers) {
      try {
        const aiResp = await withRetry(async () => {
          const res = await fetch(`${provider.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
            body: JSON.stringify({
              model: provider.model,
              messages: msgs,
              temperature: provider.temperature === '' || provider.temperature == null
                ? 0.8
                : Number(provider.temperature),
            }),
            // 带图请求 vision 模型处理更慢，超时 180 秒；纯文本 90 秒（长回答不再答到一半被超时切断、切下一个模型重答）
            signal: AbortSignal.timeout(imageUrl ? 180000 : 90000),
          });
          if (!res.ok) {
            const text = await res.text().catch(() => '');
            const err = new Error(`AI API error: HTTP ${res.status}${text ? ' ' + text.slice(0, 120) : ''}`);
            err.status = res.status;
            throw err;
          }
          return res;
        }, {
          maxAttempts: 2,
          delay: 800,
          // 超时不重试（重试只会再等一轮），直接换下一个 AI
          shouldRetry: (e) =>
            !(e?.name === 'TimeoutError' || e?.name === 'AbortError') &&
            (e.status === undefined || e.status === 429 || e.status >= 500),
          onRetry: (err, attempt) => this.logger.warn(`AI retry ${attempt}: ${err.message}`),
        });

        const aiData = await aiResp.json();
        const text = stripMentions(aiData.choices?.[0]?.message?.content);
        const clean = /^@\S+\s+/.test(text) ? text.replace(/^@\S+\s+/, '') : text;
        if (!clean) throw new Error('AI 返回空内容');
        reply = clean;
        used = provider;
        break;
      } catch (e) {
        aiErr = e;
        this.logger.warn(`AI ${provider.name || provider.model} 不可用: ${e.message}`);
        this.logSystem(`AI「${provider.name || provider.model}」调用失败（${e.message.slice(0, 120)}），自动尝试下一个备用`);
      }
    }

    if (!reply) {
      this.logger.error(`All AI failed: ${aiErr ? aiErr.message : 'unknown'}`);
      this.logSystem('所有 AI 均不可用，已回复兜底话术');
      // 自动撤回：把之前这条「没答上来」的消息撤掉（可选）
      const lastBotMsg = session?.lastBotMsg;
      if (this.config.autoRecall === '1' && lastBotMsg?.msgId) {
        await this.recallMessage({ isC2C, scopeId, msgId: lastBotMsg.msgId });
        session.lastBotMsg = null;
        await this.saveSession(key, session);
        this.logger.info(`Auto-recalled previous message (AI failed)`);
        return;
      }
      await this.sendReply({
        isC2C,
        scopeId,
        content: imageUrl
          ? '这张图处理超时了，换个更小的图或稍后再试一次吧～'
          : '抱歉，我这边出了点小状况，暂时没法回答，稍后再问我一次吧～',
        msgId,
      });
      return;
    }

    // AI 判断用户要画图时，输出 [GEN_IMAGE] 标记 → 调用生图模型
    if (this.config.imageGenModel) {
      const genMatch = reply.match(/\[GEN_IMAGE\]\s*([\s\S]+)/);
      if (genMatch) {
        history.push({ role: 'assistant', content: '（已按要求生成并发送图片）' });
        // 标记前面如果写了话，就当作配图文案（图发完再发这句）
        const caption = reply.slice(0, reply.indexOf('[GEN_IMAGE]')).trim();
        await this.handleImageGen({ isC2C, scopeId, msgId, prompt: genMatch[1].trim(), caption, userId, userContent: content });
        return;
      }
      // 兜底：AI 声称「生成好了」却漏了标记，用用户描述 + 回复内容补画
      if (/生成好|画好|已生成|出图|做好了|马上画|正在画/.test(reply)) {
        const lastUser = [...history].reverse().find((m) => m.role === 'user' && typeof m.content === 'string');
        const prompt = `${lastUser ? lastUser.content : ''}\n${reply.replace(/\[GEN_IMAGE\]/g, '')}`
          .trim()
          .slice(0, 400);
        if (prompt) {
          history.push({ role: 'assistant', content: '（已按要求生成并发送图片）' });
          await this.handleImageGen({ isC2C, scopeId, msgId, prompt, userId, userContent: content });
          return;
        }
      }
    }

    // 工具调用：[TOOL]{"name":...} 标记 → 执行内置工具（提醒 / 群信息 / 禁言状态 / 画图）
    if (this.config.toolCalling !== '0') {
      const toolCall = this.extractToolCall(reply);
      if (toolCall) {
        // 模型偶尔会在调用前加一句「好的，我这就去…」：只保留工具结果，避免一次回两条重复消息
        const head = toolCall.text;
        await this.runTool(toolCall, { isC2C, scopeId, key, msgId, userId, userContent: content });
        history.push({ role: 'assistant', content: head || '（已执行工具）' });
        session.lastUsed = Date.now();
        await this.saveSession(key, session);
        return;
      }
    }

    let sentId = null;
    // 图片回复：AI 回复里带 markdown 图片时，先发图再补文字
    const imgMatch = reply.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/);
    if (imgMatch) {
      const imageUrl = imgMatch[1];
      const textOnly = reply.replace(/!\[[^\]]*\]\([^)]*\)/g, '').trim();
      sentId = await this.sendImage({ isC2C, scopeId, imageUrl, msgId });
      if (sentId) {
        if (textOnly) {
          // 图是被动回复 seq=1，这条文字跟同一个 msg_id 走 seq=2，不烧主动消息额度
          const textId = await this.sendReply({ isC2C, scopeId, content: textOnly, msgId });
          if (textId) sentId = textId;
        }
      } else {
        // 图片上传失败：降级为纯文本，图片地址转成可点链接，避免露出 markdown 原文
        const fallback = (textOnly ? textOnly + '\n' : '') + imageUrl;
        sentId = await this.sendReply({ isC2C, scopeId, content: fallback, msgId });
      }
    }
    if (!sentId) {
      sentId = await this.sendReply({
        isC2C,
        scopeId,
        content: reply,
        msgId,
      });
    }
    if (!sentId) return;

    if (session && msgId) session.lastBotMsg = { msgId: sentId, at: Date.now() };
    history.push({ role: 'assistant', content: normalizeFaceTags(reply) });
    if (session) {
      session.lastUsed = Date.now();
      await this.saveSession(key, session);
      // 历史太长时后台压缩旧消息（不阻塞回复）
      if (used && this.state && typeof this.state.waitUntil === 'function') {
        this.state.waitUntil(this.maybeSummarize(key, session, used));
      }
    }
    this.logger.info(`Replied to ${isC2C ? 'c2c' : 'group'} chat: ${reply.slice(0, 50)}...`);

    try {
      await addChatLog(this.env, {
        kind: isC2C ? 'c2c' : 'group',
        scopeId,
        userId,
        // 带图的消息在记录里标一下，后台能看出这是图片消息
        userContent: imageUrl ? `[图片] ${content}` : content,
        aiReply: normalizeFaceTags(reply),
        model: used ? `${used.name} · ${used.model}`.slice(0, 128) : null,
      });
    } catch (e) {
      this.logger.warn(`Chat log write failed: ${e.message}`);
    }
  }

  /** 组装系统提示词（人设 + 生图能力 + 工具调用说明） */
  buildSystemPrompt() {
    const basePrompt = this.config.systemPrompt ||
      '你是一个友好、靠谱、乐于助人的QQ机器人助手。回答保持简洁、自然、口语化，用中文交流。';
    const genHint = this.config.imageGenModel
      ? '\n\n【生图能力】你支持生成图片。当用户要求你画图、绘制或生成图片时，你必须只输出一行：[GEN_IMAGE] <具体的图片描述>。如果想配一句话（比如「画好啦」），写在标记**前面**，图片发完后会跟着发出去；不要写「生成好了」「马上画」这类空话。系统会自动调用生图模型把图片发给用户。用户只是聊天、没有要求画图时正常回答。'
      : '\n\n【注意】你没有生图能力，也没有图片生成工具。当用户要求画图时，如实说明「需要先在后台配置生图模型才能画」，绝对不要假装已经生成图片或说「生成好了」。';
    const toolHint =
      this.config.toolCalling !== '0'
        ? '\n\n【工具调用】当用户要你「做事」而不只是聊天时，在回复的最后单独一行输出一个工具调用（格式固定，不要放进代码块）：' +
          '\n[TOOL]{"name":"工具名","args":{...}}' +
          '\n可用工具：' +
          '\n- image：{"prompt":"画面描述"} —— 画图 / 生成图片' +
          '\n- meme：{"name":"梗图名"} —— 发一张内置梗图（名字只能从下面的梗图清单里选）' +
          '\n- voice：{"text":"要说的话"} —— 用语音说出来（内置 TTS，用户明确要语音或简单问候时用）' +
          '\n- remind：{"when":"明天 8:30 / 10分钟后 / 每天 8:00 / 每周一 9:00","text":"提醒内容"} —— 定时提醒' +
          '\n- group_info：{} —— 查本群资料（仅群聊）' +
          '\n- group_state：{} —— 查机器人在本群的状态（仅群聊）' +
          '\n- mute_state：{} —— 查本群禁言状态（仅群聊）' +
          '\n规则：一次只调用一个工具；调用工具时不要写寒暄、确认或解释（系统会用工具结果自动回复用户）；**image / meme 这两个工具可以在工具行后面再写一句话**（作为配图文案，会跟在图片后面发出去），其它工具不要附加文字；能直接回答的问题不要调用工具；不要编造工具的执行结果；用户没有明确要求时不要调用工具。'
        : '';
    const memes = this.memesCache || [];
    const memeHint = memes.length
      ? '\n\n【表情与梗图】你可以自然地在回复里用 emoji 表情（例如 😄🤔👍 这种字符，直接用就行）。' +
        '需要发梗图时用工具 meme，名字只能从下面清单里选：\n' +
        memes.map((m) => `- ${m.name}：${String(m.description || '').slice(0, 40)}`).join('\n') +
        '\n规则：聊天气氛合适时偶尔发一张，不要每条都发；用户明确想要梗图/表情包时优先发一张。'
      : '';
    return basePrompt + genHint + toolHint + memeHint;
  }

  /** 系统提示词指纹：人设 / 生图模型 / 工具开关变了就要重建 session 里的 system 消息 */
  sysKey() {
    return `${this.config.systemPrompt || ''}|${this.config.imageGenModel || ''}|${this.config.toolCalling || ''}`;
  }

  /** 同一 msg_id 的被动回复需要递增 msg_seq（不传默认 1，第二条起会被去重/拒绝） */
  nextMsgSeq(msgId) {
    const n = (this.msgSeqMap.get(msgId) || 0) + 1;
    this.msgSeqMap.set(msgId, n);
    // 防胀：只留最近 100 个 msg_id 的计数（被动回复窗口只有几分钟，足够了）
    if (this.msgSeqMap.size > 200) {
      for (const k of this.msgSeqMap.keys()) {
        this.msgSeqMap.delete(k);
        if (this.msgSeqMap.size <= 100) break;
      }
    }
    return n;
  }

  async sendReply({ isC2C, scopeId, content, msgId }) {
    const token = await this.getToken();
    const sendUrl = isC2C
      ? `${this.apiBase()}/v2/users/${scopeId}/messages`
      : `${this.apiBase()}/v2/groups/${scopeId}/messages`;

    let finalContent = normalizeFaceTags(stripMentions(content));
    if (/^@\S+\s+/.test(finalContent)) finalContent = finalContent.replace(/^@\S+\s+/, '');
    finalContent = finalContent.slice(0, 1500);
    if (!finalContent) finalContent = '……';

    const useMarkdown = this.config.markdownReply === '1' && this.isMarkdownSafe(finalContent);
    // 被动回复带 msg_id + 递增 msg_seq；不带 msg_id 就是主动消息（不要发空的 msg_id 字段）
    const passive = msgId ? { msg_id: msgId, msg_seq: this.nextMsgSeq(msgId) } : {};
    const buildPayload = (md) =>
      md
        ? { msg_type: 2, markdown: { content: finalContent }, ...passive }
        : { msg_type: 0, content: finalContent, ...passive };

    const retryable = (e) => e.status === undefined || e.status === 429 || e.status >= 500;
    const sendOnce = async (tok, payload) => {
      const res = await fetch(sendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `QQBot ${tok}` },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error(`Send failed: HTTP ${res.status}${text ? ' ' + text.slice(0, 120) : ''}`);
        err.status = res.status;
        throw err;
      }
      const data = await res.json().catch(() => ({}));
      return data.id || null;
    };

    let payload = buildPayload(useMarkdown);
    try {
      return await withRetry(() => sendOnce(token, payload), {
        maxAttempts: 2,
        delay: 800,
        shouldRetry: retryable,
        onRetry: (err, attempt) => this.logger.warn(`Send retry ${attempt}: ${err.message}`),
      });
    } catch (e) {
      // Markdown 被拒（比如机器人没有 markdown 权限）→ 自动降级纯文本再发一次
      if (useMarkdown && e.status && e.status < 500 && e.status !== 429) {
        this.logger.warn(`Markdown send rejected (HTTP ${e.status}), falling back to plain text`);
        try {
          return await sendOnce(await this.getToken(), buildPayload(false));
        } catch (e2) {
          this.logger.warn(`Plain-text fallback failed: ${e2.message}`);
          return null;
        }
      }
      if (e.status === 401) {
        this.token = null;
        this.tokenExpiry = 0;
        try {
          return await sendOnce(await this.getToken(), payload);
        } catch (e2) {
          this.logger.warn(`Send failed after re-auth: ${e2.message}`);
          return null;
        }
      }
      this.logger.warn(e.message);
      return null;
    }
  }

  /** 单聊「正在输入」状态（官方 msg_type=6，最长 60 秒）：AI 思考期间给用户反馈 */
  async sendTyping({ scopeId, msgId }) {
    if (!msgId) return;
    try {
      const token = await this.getToken();
      const res = await fetch(`${this.apiBase()}/v2/users/${scopeId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `QQBot ${token}` },
        body: JSON.stringify({
          msg_type: 6,
          input_notify: { input_type: 1, input_second: 60 },
          msg_id: msgId,
          msg_seq: this.nextMsgSeq(msgId),
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) await res.body?.cancel();
    } catch {
      // 输入状态是锦上添花，失败不打扰主流程
    }
  }

  /** /菜单：markdown + 按钮面板（指令按钮=自动填 @我 内容；跳转按钮=直接开链接） */
  async sendMenu({ isC2C, scopeId, msgId }) {
    const token = await this.getToken();
    const sendUrl = isC2C
      ? `${this.apiBase()}/v2/users/${scopeId}/messages`
      : `${this.apiBase()}/v2/groups/${scopeId}/messages`;
    const button = (label, action) => ({
      id: `b_${Math.random().toString(36).slice(2, 8)}`,
      render_data: { label, visited_label: label, style: action.style || 0 },
      action: {
        type: action.url ? 0 : 2,
        permission: { type: 2, specify_role_ids: [], specify_user_ids: [] },
        data: action.url || action.data,
        ...(action.url ? {} : { enter: true, reply: true }),
      },
    });
    const payload = {
      msg_type: 2,
      markdown: {
        content:
          '**🤖 机器人菜单**\n点按钮直达：指令按钮会把内容自动填进输入框（已带 @我），再点发送即可。',
      },
      keyboard: {
        content: {
          rows: [
            {
              buttons: [
                button('🧭 使用帮助', { data: '帮助', style: 1 }),
                button('🎨 来画一张', { data: '画 ' }),
              ],
            },
            {
              buttons: [
                button('↩️ 撤回上一条', { data: '/撤回' }),
                button('📖 项目主页', { url: 'https://github.com/jidanbings/qq-bot-cf' }),
              ],
            },
          ],
        },
      },
      ...(msgId ? { msg_id: msgId, msg_seq: this.nextMsgSeq(msgId) } : {}),
    };
    try {
      const res = await fetch(sendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `QQBot ${token}` },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${text ? ' ' + text.slice(0, 120) : ''}`);
      }
    } catch (e) {
      this.logger.warn(`Send menu failed: ${e.message}，降级为文字菜单`);
      await this.sendReply({
        isC2C,
        scopeId,
        msgId,
        content: '🤖 机器人菜单\n· /画 描述 —— AI 生图\n· /撤回 —— 撤回我上一条消息\n· /帮助 —— 看完整说明',
      });
    }
  }

  /** 发送富媒体（图片）消息：先上传拿 file_info，再发 msg_type=7，返回新消息 id */
  /** 发图片（富媒体消息）——兼容原调用 */
  async sendImage({ isC2C, scopeId, imageUrl, msgId }) {
    return this.sendMedia({ isC2C, scopeId, msgId, fileType: 1, source: imageUrl });
  }

  /** 发富媒体消息（图片 / 语音 / 视频 / 文件）：先上传拿 file_info，再 msg_type=7 发送 */
  async sendMedia({ isC2C, scopeId, msgId, fileType, source, fileExt }) {
    const token = await this.getToken();
    const base = this.apiBase();
    const fileInfo = await this.uploadRichMedia({ isC2C, scopeId, source, token, fileType, fileExt });
    if (!fileInfo) return null;
    const sendUrl = isC2C
      ? `${base}/v2/users/${scopeId}/messages`
      : `${base}/v2/groups/${scopeId}/messages`;
    const res = await fetch(sendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `QQBot ${token}` },
      body: JSON.stringify({
        msg_type: 7,
        media: { file_info: fileInfo },
        ...(msgId ? { msg_id: msgId, msg_seq: this.nextMsgSeq(msgId) } : {}),
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`Send media failed: HTTP ${res.status}${text ? ' ' + text.slice(0, 120) : ''}`);
      return null;
    }
    const data = await res.json().catch(() => ({}));
    return data.id || null;
  }

  /**
   * 上传富媒体拿 file_info（官方富媒体流程）。
   * source 支持 data URI（二进制直传）或公网 URL（平台代拉取）；
   * fileType：1 图片 / 2 视频 / 3 语音 / 4 文件。
   */
  async uploadRichMedia({ isC2C, scopeId, source, token, fileType = 1, fileExt }) {
    const base = this.apiBase();
    const uploadUrl = isC2C
      ? `${base}/v2/users/${scopeId}/files`
      : `${base}/v2/groups/${scopeId}/files`;
    const prefix = fileType === 3 ? 'audio' : fileType === 2 ? 'video' : fileType === 4 ? 'file' : 'image';
    let body;
    const dataUri = source.match(/^data:([^;]+);base64,(.+)$/i);
    if (dataUri) {
      // 二进制直传（官方 file_data 字段，≤5MB）
      const mime = dataUri[1].toLowerCase();
      const ext =
        fileExt || (mime === 'image/jpeg' ? 'jpg' : mime === 'audio/mpeg' ? 'mp3' : mime.split('/')[1] || 'bin');
      if (dataUri[2].length > 7_000_000) {
        this.logger.warn(`Binary upload aborted: base64 ≈ ${Math.round(dataUri[2].length / 1024)}KB（二进制直传限 5MB）`);
        return null;
      }
      body = { file_type: fileType, file_name: `${prefix}.${ext}`, file_data: dataUri[2], srv_send_msg: false };
      this.logger.info(`Rich media upload: ${prefix}.${ext} ≈ ${Math.round(dataUri[2].length * 0.75 / 1024)}KB`);
    } else {
      // 公网 URL：平台代拉取（srv_send_msg=false 只预上传拿 file_info，不占主动消息额度）
      body = { file_type: fileType, url: source, srv_send_msg: false };
    }
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `QQBot ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`Upload ${prefix} failed: HTTP ${res.status}${text ? ' ' + text.slice(0, 120) : ''}`);
      return null;
    }
    const data = await res.json();
    if (!data.file_info) {
      this.logger.warn(`Upload ${prefix} returned no file_info: ${JSON.stringify(data).slice(0, 200)}`);
      return null;
    }
    return data.file_info;
  }

  /* ------------------------------ 内置 TTS（Cloudflare Workers AI · MeloTTS） ------------------------------ */

  /** 文本 → MP3 字节（不用额外 Key，走 Workers AI 绑定） */
  async synthVoice(text, lang = 'zh') {
    const ai = this.env && this.env.AI;
    if (!ai || typeof ai.run !== 'function') {
      throw new Error('当前环境没有 Workers AI 绑定（wrangler.toml 里需要 [ai] binding = "AI"）');
    }
    const out = await ai.run('@cf/myshell-ai/melotts', {
      prompt: String(text).slice(0, 300),
      lang: String(lang || 'zh').slice(0, 8),
    });
    let bytes = null;
    if (out instanceof ArrayBuffer) bytes = new Uint8Array(out);
    else if (out instanceof Uint8Array) bytes = out;
    else if (out && typeof out.arrayBuffer === 'function') bytes = new Uint8Array(await out.arrayBuffer());
    else if (out && typeof out.audio === 'string') bytes = fromBase64(out.audio);
    else if (out && out.body && typeof out.body.getReader === 'function') {
      bytes = new Uint8Array(await new Response(out.body).arrayBuffer());
    }
    if (!bytes || !bytes.length) throw new Error('TTS 没有返回音频数据');
    return bytes;
  }

  /** 合成语音并发送（QQ 语音消息：file_type=3，mp3 可直接用） */
  async sendVoice({ isC2C, scopeId, msgId, text, userId, userContent }) {
    const clean = String(text || '').trim().slice(0, 300);
    if (!clean) return null;
    try {
      const bytes = await this.synthVoice(clean, this.config.voiceLang || 'zh');
      const dataUri = `data:audio/mpeg;base64,${toBase64(bytes)}`;
      const sent = await this.sendMedia({ isC2C, scopeId, msgId, fileType: 3, source: dataUri, fileExt: 'mp3' });
      if (sent) {
        this.logExchange({
          isC2C,
          scopeId,
          userId,
          userContent: String(userContent || '').trim() || '（语音）',
          aiReply: `[语音] ${clean}`,
          model: '语音 · MeloTTS',
        });
      }
      return sent;
    } catch (e) {
      this.logger.warn(`Voice send failed: ${e.message}`);
      return null;
    }
  }


  /** 下载图片并转成 base64 data URI（供不支持外链抓取的 AI 服务商识别） */
  async downloadImageAsBase64(imageUrl) {
    if (!imageUrl) return null;
    try {
      const res = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          Referer: 'https://q.qq.com/',
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        this.logger.warn(`Image fetch failed: HTTP ${res.status}`);
        return null;
      }
      const contentType = res.headers.get('content-type') || '';
      const buf = new Uint8Array(await res.arrayBuffer());
      const size = buf.byteLength;
      if (size < 16 || size > 6 * 1024 * 1024) {
        this.logger.warn(`Image size invalid (${size} bytes), skipping`);
        return null;
      }
      const mime = sniffImageMime(buf, contentType);
      if (!mime) {
        this.logger.warn(
          `Downloaded bytes are not an image (${contentType || 'no content-type'}, ${size}B), head=${[...buf.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join(' ')}`
        );
        return null;
      }
      this.logger.info(`Image download ok: ${mime}, ${Math.round(size / 1024)}KB`);
      return `data:${mime};base64,${toBase64(buf)}`;
    } catch (e) {
      this.logger.warn(`Image download failed: ${e.message}`);
      return null;
    }
  }

  /** 撤回消息（官方接口） */
  async recallMessage({ isC2C, scopeId, msgId }) {
    if (!msgId) return false;
    const token = await this.getToken();
    const url = isC2C
      ? `${this.apiBase()}/v2/users/${scopeId}/messages/${msgId}`
      : `${this.apiBase()}/v2/groups/${scopeId}/messages/${msgId}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `QQBot ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`Recall failed: HTTP ${res.status}${text ? ' ' + text.slice(0, 120) : ''}`);
      return false;
    }
    await res.body?.cancel();
    return true;
  }

  /** 官方群管理 API 通用调用：自动带 Access Token，失败抛出带 QQ 错误码的异常 */
  async qqApi(path, init) {
    const token = await this.getToken();
    const res = await fetch(`${this.apiBase()}${path}`, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `QQBot ${token}` },
      signal: AbortSignal.timeout(12000),
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      let code = 0;
      let msg = '';
      try {
        const d = JSON.parse(text);
        code = Number(d.code) || 0;
        msg = String(d.message || '');
      } catch {}
      const err = new Error(`QQ API HTTP ${res.status}${code ? ` code=${code}` : ''}${msg ? ` ${msg}` : ''}`);
      err.qqCode = code;
      throw err;
    }
    return text ? JSON.parse(text) : {};
  }

  /** 获取群基本信息：群名/简介/分类/标签/人数（需开放平台白名单权限） */
  qqGroupInfo(openid) {
    return this.qqApi(`/v2/groups/${openid}/info`, { method: 'GET' });
  }

  /** 获取机器人在群内的状态：角色/入群时间/消息接收设置/是否接受主动推送 */
  qqBotState(openid) {
    return this.qqApi(`/v2/groups/${openid}/bot_state`, { method: 'GET' });
  }

  /** 群成员列表（每页最多 30 条，cursor 分页；内邀能力，可能无权限） */
  qqGroupMembers(openid, cursor) {
    const q = cursor ? `?cursor=${encodeURIComponent(String(cursor))}` : '';
    return this.qqApi(`/v2/groups/${openid}/members${q}`, { method: 'GET' });
  }

  /** 查询群禁言状态：全员禁言模式 + 当前被禁言的成员列表（机器人需群管理员身份） */
  qqMuteState(openid) {
    return this.qqApi(`/v2/groups/${openid}/restrict_chat_setting`, { method: 'GET' });
  }

  /**
   * 批量设置群成员禁言：members 每项 {op: add|update|del, member_openid, mute_expire_at}
   * 单次最多 20 个，机器人需有群管理员身份，禁言最长 30 天
   */
  qqMuteMembers(openid, members) {
    return this.qqApi(`/v2/groups/${openid}/restrict_chat_setting`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ members: members.slice(0, 20) }),
    });
  }

  /* ------------------------------ 内置梗图（D1 存储，部署时自动导入） ------------------------------ */

  /** 从 D1 读梗图（名字 + 描述 + base64），进程内缓存；部署换版本时 DO 会重启，天然刷新 */
  async ensureMemes() {
    if (this.memesCache) return this.memesCache;
    try {
      const rows = await listMemes(this.env);
      this.memesCache = (rows || []).filter((r) => r && r.name && r.data);
    } catch (e) {
      this.logger.warn(`Memes load failed: ${e.message}`);
      this.memesCache = [];
    }
    return this.memesCache;
  }

  /** 给了名字就精确/模糊匹配，没给就随机 */
  async pickMeme(name) {
    const list = await this.ensureMemes();
    if (!list.length) return null;
    const q = String(name || '').trim();
    if (!q) return list[Math.floor(Math.random() * list.length)];
    const exact = list.find((m) => m.name === q);
    if (exact) return exact;
    return list.find((m) => m.name.includes(q) || q.includes(m.name)) || null;
  }

  /** 发一张内置梗图（base64 直传，走官方富媒体图片消息）；发完再补一句配文 */
  async sendMeme({ isC2C, scopeId, msgId, name, caption, userId, userContent }) {
    const meme = await this.pickMeme(name);
    if (!meme) return null;
    this.logger.info(`Meme: ${meme.name}`);
    try {
      const sent = await this.sendImage({
        isC2C,
        scopeId,
        imageUrl: `data:image/jpeg;base64,${meme.data}`,
        msgId,
      });
      if (sent) {
        const line = String(caption || '').trim() || MEME_CAPTIONS[Math.floor(Math.random() * MEME_CAPTIONS.length)];
        await this.sendReply({ isC2C, scopeId, content: line, msgId });
        this.logExchange({
          isC2C,
          scopeId,
          userId,
          userContent: String(userContent || '').trim() || '（梗图）',
          aiReply: `[梗图] ${meme.name}\n${line}`,
          model: '梗图',
        });
      }
      return sent;
    } catch (e) {
      this.logger.warn(`Meme send failed: ${e.message}`);
      return null;
    }
  }

  /** /画 指令：调用生图模型（OpenAI 兼容 /images/generations），把图发回会话，再补一句配文 */
  async handleImageGen({ isC2C, scopeId, msgId, prompt, caption, userId, userContent }) {
    const model = String(this.config.imageGenModel || '').trim();
    const provider = (this.config.aiProviders || []).find(
      (p) => p && p.enabled !== 0 && p.baseUrl && p.apiKey
    );
    const baseUrl = String(this.config.imageGenBaseUrl || '').trim() || (provider ? provider.baseUrl : '');
    const apiKey = String(this.config.imageGenApiKey || '').trim() || (provider ? provider.apiKey : '');
    if (!model) {
      await this.sendReply({
        isC2C,
        scopeId,
        content: '还没配置生图模型——打开左侧「生图模型」页填好并测试通过后保存，我就能画了。',
        msgId,
      });
      return;
    }
    if (!baseUrl || !apiKey) {
      await this.sendReply({
        isC2C,
        scopeId,
        content: '生图接口还没配全——打开左侧「生图模型」页填 Base URL、API Key 和模型名。',
        msgId,
      });
      return;
    }
    this.logger.info(`Image gen: model=${model} prompt=${prompt.slice(0, 40)}...`);
    try {
      const res = await fetch(`${baseUrl}/images/generations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, prompt, n: 1 }),
        signal: AbortSignal.timeout(120000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${text ? ' ' + text.slice(0, 120) : ''}`);
      }
      const data = await res.json();
      const item = data.data?.[0] || {};
      // 有的生图接口只回 b64_json：转成 data URI，上传时走 file_data 二进制直传
      const url = item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : '');
      if (!url) throw new Error('生图接口没有返回图片地址');
      const sent = await this.sendImage({ isC2C, scopeId, imageUrl: url, msgId });
      if (!sent) throw new Error('图片发送失败');
      this.logger.info('Image gen: sent');
      // 图发完补一句，像正常人那样说句话（AI 写了配文就用它的）
      const line = String(caption || '').trim() || IMAGE_CAPTIONS[Math.floor(Math.random() * IMAGE_CAPTIONS.length)];
      await this.sendReply({ isC2C, scopeId, content: line, msgId });
      this.logExchange({
        isC2C,
        scopeId,
        userId,
        userContent: String(userContent || '').trim() || '（生图）',
        aiReply: `[图片] ${line}`,
        model: `生图 · ${model}`,
      });
    } catch (e) {
      this.logger.warn(`Image gen failed: ${e.message}`);
      await this.sendReply({
        isC2C,
        scopeId,
        content: `画图失败了：${e.message.slice(0, 80)}，稍后再试一次吧～`,
        msgId,
      });
    }
  }

  /** 判断文本是否适合用 Markdown 发送（含标题/列表/引用/链接等富格式才切） */
  isMarkdownSafe(text) {
    return /(^|\n)\s*#{1,6}\s|\*\*|~~|^\s*[-*]\s|\n\s*>|^>|\[[^\]]+\]\(https?:/m.test(text);
  }

  pruneSessions() {
    if (this.sessions.size < MAX_SESSIONS) return;
    const cutoff = Date.now() - SESSION_IDLE_MS;
    for (const [key, session] of this.sessions) {
      if (session.lastUsed < cutoff) this.sessions.delete(key);
    }
    if (this.sessions.size >= MAX_SESSIONS) {
      const byAge = [...this.sessions.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
      for (const [key] of byAge.slice(0, byAge.length - MAX_SESSIONS + 1)) this.sessions.delete(key);
    }
  }

  /* -------------------- 会话持久化（DO SQLite 存储：重启/驱逐后上下文不丢） -------------------- */

  sessionKey(key) {
    return `sess:${key}`;
  }

  async loadSession(key) {
    const cached = this.sessions.get(key);
    if (cached) return cached;
    try {
      const saved = await this.state.storage.get(this.sessionKey(key));
      if (saved && typeof saved === 'object' && Array.isArray(saved.history) && saved.history.length) {
        this.sessions.set(key, saved);
        return saved;
      }
    } catch (e) {
      this.logger.warn(`Session load failed: ${e.message}`);
    }
    return null;
  }

  async saveSession(key, session) {
    this.sessions.set(key, session);
    try {
      let payload = session;
      // DO 单个值有大小上限：历史太长时只保留 system + 最近 30 条再落盘
      if (JSON.stringify(session).length > 110000 && Array.isArray(session.history) && session.history.length > 31) {
        payload = { ...session, history: session.history.slice(0, 1).concat(session.history.slice(-30)) };
      }
      await this.state.storage.put(this.sessionKey(key), payload);
    } catch (e) {
      this.logger.warn(`Session save failed: ${e.message}`);
    }
  }

  /** 每分钟 cron 顺带清理长时间不用的会话（内存 + DO 存储） */
  async pruneStoredSessions() {
    const cutoff = Date.now() - SESSION_IDLE_MS;
    for (const [k, s] of [...this.sessions.entries()]) {
      if (!s || (s.lastUsed || 0) < cutoff) this.sessions.delete(k);
    }
    try {
      const map = await this.state.storage.list({ prefix: 'sess:', limit: 200 });
      const dead = [];
      for (const [k, v] of map) {
        if (!v || (v.lastUsed || 0) < cutoff) dead.push(k);
      }
      if (dead.length) await this.state.storage.delete(dead);
    } catch (e) {
      this.logger.warn(`Session prune failed: ${e.message}`);
    }
  }

  /** 一次非流式 AI 调用（摘要压缩等内部用途） */
  async chatOnce(provider, messages, { timeout = 60000 } = {}) {
    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
      body: JSON.stringify({ model: provider.model, messages, temperature: 0.3 }),
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${text ? ' ' + text.slice(0, 120) : ''}`);
    }
    const data = await res.json();
    return String(data.choices?.[0]?.message?.content || '').trim();
  }

  /** 历史太长时把最早的一批消息压成摘要（后台异步，失败只丢旧消息） */
  async maybeSummarize(key, session, provider) {
    const limit = Number(this.config.historyLimit) || 20;
    if (!Array.isArray(session.history) || session.history.length <= limit + 4) return;
    const cut = session.history.length - 1 - limit;
    if (cut <= 0) return;
    const old = session.history.slice(1, 1 + cut);
    session.history.splice(1, cut);
    try {
      const text = old
        .map((m) => `${m.role === 'user' ? '用户' : '助手'}：${typeof m.content === 'string' ? m.content : '[图片]'}`)
        .join('\n')
        .slice(0, 3500);
      const summary = await this.chatOnce(provider, [
        {
          role: 'system',
          content: '把这段聊天记录压缩成不超过 120 字的中文摘要，只保留重要事实、用户偏好和未完成的事，不要客套话。',
        },
        { role: 'user', content: text },
      ]);
      const merged = [session.summary || '', summary].filter(Boolean).join('；');
      if (merged) session.summary = merged.slice(0, 400);
      this.logger.info(`Session summarized (${cut} msgs -> ${session.summary.length} chars)`);
    } catch (e) {
      this.logger.warn(`Session summary failed: ${e.message}`);
    }
    await this.saveSession(key, session);
  }

  /* ------------------------------ 定时提醒（AI 自主任务） ------------------------------ */

  /** 主动消息（不带 msg_id）：返回详细错误，后台能看到失败原因 */
  async sendProactive({ isC2C, scopeId, content }) {
    const token = await this.getToken();
    const sendUrl = isC2C
      ? `${this.apiBase()}/v2/users/${scopeId}/messages`
      : `${this.apiBase()}/v2/groups/${scopeId}/messages`;
    const res = await fetch(sendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `QQBot ${token}` },
      body: JSON.stringify({ msg_type: 0, content: String(content).slice(0, 1500) }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = data.code != null ? `code=${data.code} ` : '';
      return { ok: false, error: `HTTP ${res.status} ${code}${String(data.message || '').slice(0, 120)}`.trim() };
    }
    return { ok: true, id: data.id || null };
  }

  /** 群聊主动消息需要「允许主动推送」：没开就在创建提醒时提前警告 */
  async proactiveWarning(scopeId) {
    try {
      const st = await this.qqBotState(scopeId);
      if (st && st.allow_proactive_msg === false) {
        return '（⚠️ 这个群还没开启「允许主动推送」，到点可能发不出来，需要在群机器人管理后台打开）';
      }
    } catch {}
    return '';
  }

  /** 到点的提醒：主动消息发送；重复任务顺延，普通任务标记完成 */
  async fireDueReminders() {
    if (!this.isAlive()) return;
    const due = await dueReminders(this.env, new Date().toISOString(), 5);
    for (const r of due) {
      const claimed = await claimReminder(this.env, r.id);
      if (!claimed) continue;
      const isC2C = !!r.is_c2c;
      // 群聊先看有没有主动推送权限，没有就直接记清楚原因，不白发一次请求
      if (!isC2C) {
        const st = await this.qqBotState(r.scope_id).catch(() => null);
        if (st && st.allow_proactive_msg === false) {
          await finishReminder(this.env, r.id, false, '群未开启「允许主动推送」，去群机器人管理后台开启');
          this.logSystem(`提醒发送失败：群未开启主动推送（${String(r.text).slice(0, 40)}）`);
          continue;
        }
      }
      const sent = await this.sendProactive({
        isC2C,
        scopeId: r.scope_id,
        content: `⏰ 提醒：${r.text}`,
      }).catch((e) => ({ ok: false, error: e.message }));
      if (!sent.ok) {
        await finishReminder(this.env, r.id, false, sent.error || '发送失败');
        this.logSystem(`提醒发送失败：${String(r.text).slice(0, 40)}（${String(sent.error || '').slice(0, 80)}）`);
        continue;
      }
      if (r.repeat_rule) {
        const next = nextDueFrom(r.repeat_rule, r.due_at);
        if (next) {
          await rescheduleReminder(this.env, r.id, next);
          this.logSystem(`重复提醒已顺延：${String(r.text).slice(0, 60)} → ${next}`);
        } else {
          await finishReminder(this.env, r.id, true, null);
        }
      } else {
        await finishReminder(this.env, r.id, true, null);
        this.logSystem(`提醒已发送：${String(r.text).slice(0, 60)}`);
      }
    }
  }

  /* ------------------------------ 工具调用 ------------------------------ */

  /** 从 AI 回复里提取 [TOOL]{json} 调用（花括号配对扫描，正文里有花括号也不会误伤） */
  extractToolCall(reply) {
    const s = String(reply || '');
    const idx = s.indexOf('[TOOL]');
    if (idx < 0) return null;
    const head = s.slice(0, idx).trim();
    const tail = s.slice(idx + 6).trim();
    const start = tail.indexOf('{');
    if (start < 0) return null;
    let depth = 0;
    let end = -1;
    let inStr = false;
    let esc = false;
    for (let i = start; i < tail.length; i++) {
      const ch = tail[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) return null;
    try {
      const parsed = JSON.parse(tail.slice(start, end + 1));
      return {
        name: String(parsed.name || parsed.tool || '').trim(),
        args: parsed.args && typeof parsed.args === 'object' ? parsed.args : {},
        text: head,
        // 工具行后面写的话：发图类工具会把它当作「配图文案」发出去
        tail: tail.slice(end + 1).trim(),
      };
    } catch {
      return null;
    }
  }

  async runTool(call, { isC2C, scopeId, key, msgId, userId, userContent }) {
    const name = call.name;
    try {
      if (name === 'image') {
        const prompt = String(call.args.prompt || '').trim();
        if (!prompt) return this.sendReply({ isC2C, scopeId, content: '画什么？给我个画面描述吧～', msgId });
        return this.handleImageGen({ isC2C, scopeId, msgId, prompt, caption: call.tail, userId, userContent });
      }
      if (name === 'meme') {
        const meme = await this.pickMeme(call.args.name);
        if (!meme) {
          return this.sendReply({ isC2C, scopeId, content: '梗图库里没找到这张～ 要不换一张？', msgId });
        }
        const sent = await this.sendMeme({ isC2C, scopeId, msgId, name: meme.name, caption: call.tail, userId, userContent });
        if (!sent) {
          return this.sendReply({ isC2C, scopeId, content: `梗图「${meme.name}」发送失败了，稍后再试～`, msgId });
        }
        return sent;
      }
      if (name === 'voice') {
        const text = String(call.args.text || '').trim();
        if (!text) return this.sendReply({ isC2C, scopeId, content: '要说什么？给我一段文字吧～', msgId });
        const sent = await this.sendVoice({ isC2C, scopeId, msgId, text, userId, userContent: content });
        if (!sent) {
          return this.sendReply({ isC2C, scopeId, content: '语音合成失败了（可能是 Workers AI 没启用或额度用完），稍后再试～', msgId });
        }
        if (call.tail) await this.sendReply({ isC2C, scopeId, content: call.tail, msgId });
        return sent;
      }
      if (name === 'remind') {
        const when = String(call.args.when || '').trim();
        const text = String(call.args.text || '').trim();
        if (!when || !text) {
          return this.sendReply({
            isC2C,
            scopeId,
            content: '提醒需要「时间 + 内容」，比如：10 分钟后提醒我喝水',
            msgId,
          });
        }
        const parsed = parseReminder(`${when} 提醒我 ${text}`);
        if (!parsed) {
          return this.sendReply({
            isC2C,
            scopeId,
            content: `没听懂时间「${when.slice(0, 40)}」，试试「明天 8:30」「10 分钟后」「每天 8:00」这种说法`,
            msgId,
          });
        }
        await addReminder(this.env, {
          scopeKey: key,
          isC2C,
          scopeId,
          dueAt: parsed.dueAt,
          text: parsed.text,
          repeatRule: parsed.repeatRule,
        });
        this.logSystem(`新增定时提醒（AI 工具）：${parsed.text.slice(0, 60)} @ ${parsed.dueAt}`);
        const warn = isC2C ? '' : await this.proactiveWarning(scopeId);
        return this.sendReply({
          isC2C,
          scopeId,
          content: `⏰ 好的，${parsed.whenText}提醒你：${parsed.text}${parsed.repeatRule ? '（重复提醒）' : ''}${warn}`,
          msgId,
        });
      }
      if (name === 'group_info') {
        if (isC2C) return this.sendReply({ isC2C, scopeId, content: '群资料只能在群里查～', msgId });
        const info = await this.qqGroupInfo(scopeId);
        return this.sendReply({ isC2C, scopeId, content: this.formatGroupInfo(info), msgId });
      }
      if (name === 'group_state') {
        if (isC2C) return this.sendReply({ isC2C, scopeId, content: '这个只能在群里查～', msgId });
        const st = await this.qqBotState(scopeId);
        return this.sendReply({ isC2C, scopeId, content: this.formatBotState(st), msgId });
      }
      if (name === 'mute_state') {
        if (isC2C) return this.sendReply({ isC2C, scopeId, content: '这个只能在群里查～', msgId });
        const ms = await this.qqMuteState(scopeId);
        return this.sendReply({ isC2C, scopeId, content: this.formatMuteState(ms), msgId });
      }
      return this.sendReply({ isC2C, scopeId, content: `我不认识工具「${name}」`, msgId });
    } catch (e) {
      this.logger.warn(`Tool ${name} failed: ${e.message}`);
      return this.sendReply({
        isC2C,
        scopeId,
        content: `工具「${name}」执行失败：${e.message.slice(0, 80)}`,
        msgId,
      });
    }
  }

  formatGroupInfo(info) {
    const lines = [`群名：${info.group_name || '(未命名)'}`];
    if (info.class_text) lines.push(`分类：${info.class_text}`);
    if (info.member_num != null) lines.push(`人数：${info.member_num}`);
    if (info.finger_memo) lines.push(`简介：${String(info.finger_memo).slice(0, 200)}`);
    const tags = Array.isArray(info.tags)
      ? info.tags.map((t) => (typeof t === 'string' ? t : t && t.name)).filter(Boolean)
      : [];
    if (tags.length) lines.push(`标签：${tags.slice(0, 8).join('、')}`);
    return lines.join('\n');
  }

  formatBotState(st) {
    const roleMap = { owner: '群主', admin: '管理员', member: '普通成员' };
    const recvMap = { all: '全部消息', only_mention: '仅 @我', mention_and_context: '仅 @我 + 上下文' };
    const lines = [`我的角色：${roleMap[st.member_role] || st.member_role || '未知'}`];
    if (st.joined_at) {
      lines.push(`入群时间：${new Date(st.joined_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
    }
    if (st.recv_msg_setting) lines.push(`消息接收：${recvMap[st.recv_msg_setting] || st.recv_msg_setting}`);
    lines.push(`允许主动推送：${st.allow_proactive_msg ? '是' : '否'}`);
    return lines.join('\n');
  }

  formatMuteState(ms) {
    const mode = ms && ms.global_rule ? ms.global_rule.mode : 'none';
    const modeTxt = mode === 'always' ? '全员禁言中' : mode === 'schedule' ? '定时/周期禁言' : '未开启全员禁言';
    const members = Array.isArray(ms && ms.members) ? ms.members : [];
    const lines = [`全员禁言：${modeTxt}`];
    if (members.length) {
      lines.push(`被禁言成员（${members.length}）：`);
      for (const m of members.slice(0, 5)) {
        const until = m.mute_expire_at
          ? new Date(m.mute_expire_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
          : '—';
        lines.push(`· ${m.username || '(无昵称)'} 到 ${until}`);
      }
    } else {
      lines.push('当前没有成员被禁言');
    }
    return lines.join('\n');
  }
}
