import { addChatLog, getConfig } from './db.js';
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
      case '/reload': {
        // 后台改完配置/AI 后调用：立即热更新，不用重启机器人
        const prevWelcome = this.config.welcomeEnabled;
        await this.loadConfig();
        if (this.running && prevWelcome !== this.config.welcomeEnabled) {
          this.logger.info('welcome 开关变化，重启连接以应用新 intents');
          this.teardown();
          this.state.waitUntil(this.startBot());
        }
        return Response.json({ ok: true, reloaded: true, running: this.running });
      }
      case '/ensure': {
        // 每分钟 cron 看门狗顺带热更新配置：即使 reload 通知丢了，配置最多 1 分钟内也会生效
        try { await this.loadConfig(); } catch {}
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
    if (this.groupBlacklist.has(groupOpenid)) return;
    const raw = String(this.config.welcomeMsg || '').trim();
    if (!raw) return;
    let text = raw
      .replace(/\{member\}/g, `<qqbot-at-user id="${memberOpenid}" />`)
      .replace(/\{group\}/g, groupOpenid)
      .slice(0, 1500);
    await this.sendReply({ isC2C: false, scopeId: groupOpenid, content: text, msgId: '' });
  }

  /** 机器人被拉进新群 */
  async handleGroupAddRobot(data) {
    const groupOpenid = data?.group_openid;
    if (!groupOpenid) return;
    this.logger.info(`Bot added to group ${groupOpenid.slice(0, 8)}...`);
    const raw = String(this.config.welcomeMsg || '').trim();
    if (!raw || this.config.welcomeEnabled !== '1') return;
    await this.sendReply({ isC2C: false, scopeId: groupOpenid, content: raw.slice(0, 1500), msgId: '' });
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

    let content = stripMentions(data.content);
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
              '🧰 指令：/菜单 弹出按钮面板 · /撤回 撤回我上一条 · /帮助 看这条',
            ].join('\n'),
      });
      return;
    }

    // /撤回 指令：撤回本会话最近一条机器人消息
    if (/^\/?(撤回|recall|undo)(\s|$)/.test(content)) {
      const session = this.sessions.get(key);
      const lastBotMsg = session?.lastBotMsg;
      if (!lastBotMsg) {
        await this.sendReply({ isC2C, scopeId, content: '没有可以撤回的消息～', msgId });
        return;
      }
      const ok = await this.recallMessage({ isC2C, scopeId, msgId: lastBotMsg.msgId });
      session.lastBotMsg = null;
      if (ok) {
        this.logger.info(`Recalled message in ${isC2C ? 'c2c' : 'group'} ${scopeId.slice(0, 8)}...`);
      } else {
        await this.sendReply({ isC2C, scopeId, content: '撤回失败（可能已超过 2 分钟）', msgId });
      }
      return;
    }

    // /画 指令：调用生图模型画图
    if (/^\/?(画图|画|image|draw)(\s|$)/.test(content)) {
      const prompt = content.replace(/^\/?(画图|画|image|draw)\s*/, '').trim();
      if (!prompt) {
        await this.sendReply({ isC2C, scopeId, content: '用法：/画 一只橘猫，水彩风格', msgId });
        return;
      }
      await this.handleImageGen({ isC2C, scopeId, msgId, prompt });
      return;
    }

    // 自然语言直接点「画图」：不绕对话模型，直接生图
    const genIntent = content.match(
      /^(?:帮我|给我|请)?(?:画一张|画一幅|画一个|画一只|画个|画一下|画图|绘制|生成一张|生成一幅|生成图片|生成个)\s*(.+)$/s
    );
    if (genIntent) {
      if (!this.config.imageGenModel) {
        await this.sendReply({
          isC2C,
          scopeId,
          content: '我还没接上生图能力——后台「对话行为」里把「生图模型」填上（比如 qwen-image-3.0-pro），我就能画了。',
          msgId,
        });
        return;
      }
      await this.handleImageGen({ isC2C, scopeId, msgId, prompt: genIntent[1].trim() });
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
    let session = this.sessions.get(key);
    if (!session) {
      this.pruneSessions();
      session = {
        history: [{ role: 'system', content: this.buildSystemPrompt() }],
        lastUsed: Date.now(),
        lastBotMsg: null,
        sysKey: this.sysKey(),
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
            // 带图请求 vision 模型处理更慢，超时放宽到 120 秒；纯文本仍 30 秒
            signal: AbortSignal.timeout(imageUrl ? 120000 : 30000),
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
      }
    }

    if (!reply) {
      this.logger.error(`All AI failed: ${aiErr ? aiErr.message : 'unknown'}`);
      // 自动撤回：把之前这条「没答上来」的消息撤掉（可选）
      const lastBotMsg = session?.lastBotMsg;
      if (this.config.autoRecall === '1' && lastBotMsg?.msgId) {
        await this.recallMessage({ isC2C, scopeId, msgId: lastBotMsg.msgId });
        session.lastBotMsg = null;
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
        await this.handleImageGen({ isC2C, scopeId, msgId, prompt: genMatch[1].trim() });
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
          await this.handleImageGen({ isC2C, scopeId, msgId, prompt });
          return;
        }
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
    history.push({ role: 'assistant', content: reply });
    this.logger.info(`Replied to ${isC2C ? 'c2c' : 'group'} chat: ${reply.slice(0, 50)}...`);

    try {
      await addChatLog(this.env, {
        kind: isC2C ? 'c2c' : 'group',
        scopeId,
        userId,
        userContent: content,
        aiReply: reply,
        model: used ? `${used.name} · ${used.model}`.slice(0, 128) : null,
      });
    } catch (e) {
      this.logger.warn(`Chat log write failed: ${e.message}`);
    }
  }

  /** 组装系统提示词（人设 + 生图能力说明） */
  buildSystemPrompt() {
    const basePrompt = this.config.systemPrompt ||
      '你是一个友好、靠谱、乐于助人的QQ机器人助手。回答保持简洁、自然、口语化，用中文交流。';
    const genHint = this.config.imageGenModel
      ? '\n\n【生图能力】你支持生成图片。当用户要求你画图、绘制或生成图片时，你必须只输出一行：[GEN_IMAGE] <具体的图片描述>，不要输出任何其他文字（不要说「生成好了」「马上画」之类）。系统会自动调用生图模型把图片发给用户。用户只是聊天、没有要求画图时正常回答。'
      : '\n\n【注意】你没有生图能力，也没有图片生成工具。当用户要求画图时，如实说明「需要先在后台配置生图模型才能画」，绝对不要假装已经生成图片或说「生成好了」。';
    return basePrompt + genHint;
  }

  /** 系统提示词指纹：人设或生图模型变了就要重建 session 里的 system 消息 */
  sysKey() {
    return `${this.config.systemPrompt || ''}|${this.config.imageGenModel || ''}`;
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

    let finalContent = stripMentions(content);
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
  async sendImage({ isC2C, scopeId, imageUrl, msgId }) {
    const token = await this.getToken();
    const base = this.apiBase();
    const fileInfo = await this.uploadRichMedia({ isC2C, scopeId, imageUrl, token });
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
      this.logger.warn(`Send image failed: HTTP ${res.status}${text ? ' ' + text.slice(0, 120) : ''}`);
      return null;
    }
    const data = await res.json().catch(() => ({}));
    return data.id || null;
  }

  /** 上传图片获取 file_info（官方富媒体流程）；生图 b64 走 file_data 二进制直传 */
  async uploadRichMedia({ isC2C, scopeId, imageUrl, token }) {
    const base = this.apiBase();
    const uploadUrl = isC2C
      ? `${base}/v2/users/${scopeId}/files`
      : `${base}/v2/groups/${scopeId}/files`;
    let body;
    const dataUri = imageUrl.match(/^data:image\/([a-z0-9.+-]+);base64,(.+)$/i);
    if (dataUri) {
      // 二进制直传（官方 file_data 字段，≤5MB）：生图接口只回 b64_json 时走这条路
      const ext = dataUri[1].toLowerCase() === 'jpeg' ? 'jpg' : dataUri[1].toLowerCase();
      if (dataUri[2].length > 7_000_000) {
        this.logger.warn(`Binary upload aborted: base64 ≈ ${Math.round(dataUri[2].length / 1024)}KB（二进制直传限 5MB）`);
        return null;
      }
      body = { file_type: 1, file_name: `image.${ext}`, file_data: dataUri[2], srv_send_msg: false };
      this.logger.info(`Rich media upload: file_data binary ≈ ${Math.round(dataUri[2].length * 0.75 / 1024)}KB`);
    } else {
      // 公网 URL：平台代拉取（srv_send_msg=false 只预上传拿 file_info，不占主动消息额度）
      body = { file_type: 1, url: imageUrl, srv_send_msg: false };
    }
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `QQBot ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`Upload image failed: HTTP ${res.status}${text ? ' ' + text.slice(0, 120) : ''}`);
      return null;
    }
    const data = await res.json();
    if (!data.file_info) {
      this.logger.warn(`Upload image returned no file_info: ${JSON.stringify(data).slice(0, 200)}`);
      return null;
    }
    return data.file_info;
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

  /** /画 指令：调用生图模型（OpenAI 兼容 /images/generations），把图发回会话 */
  async handleImageGen({ isC2C, scopeId, msgId, prompt }) {
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
}
