import { addChatLog, getConfig } from './db.js';
import {
  APP_VERSION,
  QQ_BASE,
  QQ_SANDBOX_BASE,
  INTENT_GROUP_AND_C2C,
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
        this.desiredRunning = (await state.storage.get('desired_running')) === true;
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
      case '/ensure': {
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
        this.logger.info(`Identifying: intents=${INTENT_GROUP_AND_C2C} shard=[0,1]`);
        ws.send(JSON.stringify({
          op: QQ_OPCODE.IDENTIFY,
          d: {
            token: `QQBot ${token}`,
            intents: INTENT_GROUP_AND_C2C,
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
    const imageUrl = data.attachments?.[0]?.url || null;
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
        history: [{
          role: 'system',
          content: this.config.systemPrompt || '你是一个友好、靠谱、乐于助人的QQ机器人助手。回答保持简洁、自然、口语化，用中文交流。',
        }],
        lastUsed: Date.now(),
      };
      this.sessions.set(key, session);
    }
    session.lastUsed = Date.now();

    const history = session.history;
    history.push({ role: 'user', content });
    while (history.length > historyLimit + 1) history.splice(1, 1);

    const msgs = history.slice();
    if (imageUrl) {
      msgs[msgs.length - 1] = {
        role: 'user',
        content: [
          { type: 'text', text: content },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      };
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
            signal: AbortSignal.timeout(30000),
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
          shouldRetry: (e) => e.status === undefined || e.status === 429 || e.status >= 500,
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
      await this.sendReply({
        isC2C,
        scopeId,
        content: '抱歉，我这边出了点小状况，暂时没法回答，稍后再问我一次吧～',
        msgId,
      });
      return;
    }

    const sent = await this.sendReply({
      isC2C,
      scopeId,
      content: reply,
      msgId,
    });
    if (!sent) return;

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

  async sendReply({ isC2C, scopeId, content, msgId }) {
    const token = await this.getToken();
    const sendUrl = isC2C
      ? `${this.apiBase()}/v2/users/${scopeId}/messages`
      : `${this.apiBase()}/v2/groups/${scopeId}/messages`;
    
    let finalContent = stripMentions(content);
    if (/^@\S+\s+/.test(finalContent)) finalContent = finalContent.replace(/^@\S+\s+/, '');
    finalContent = finalContent.slice(0, 1500);
    if (!finalContent) finalContent = '……';

    const retryable = (e) => e.status === undefined || e.status === 429 || e.status >= 500;
    const sendOnce = async (tok) => {
      const res = await fetch(sendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `QQBot ${tok}` },
        body: JSON.stringify({ msg_type: 0, content: finalContent, msg_id: msgId }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error(`Send failed: HTTP ${res.status}${text ? ' ' + text.slice(0, 120) : ''}`);
        err.status = res.status;
        throw err;
      }
      await res.body?.cancel();
    };

    try {
      await withRetry(() => sendOnce(token), {
        maxAttempts: 2,
        delay: 800,
        shouldRetry: retryable,
        onRetry: (err, attempt) => this.logger.warn(`Send retry ${attempt}: ${err.message}`),
      });
      return true;
    } catch (e) {
      if (e.status === 401) {
        
        this.token = null;
        this.tokenExpiry = 0;
        try {
          await sendOnce(await this.getToken());
          return true;
        } catch (e2) {
          this.logger.warn(`Send failed after re-auth: ${e2.message}`);
          return false;
        }
      }
      this.logger.warn(e.message);
      return false;
    }
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
