import {
  addChatLog,
  addReminder,
  claimReminder,
  dueReminders,
  finishReminder,
  getConfig,
  listMemes,
  nextReminderDue,
  rescheduleReminder,
  upsertGroup,
} from './db.js';
import { parseReminder, nextDueFrom } from './utils/reminder.js';
import { normalizeFaceTags } from './utils/qq-face.js';
import { applyMp3Gain } from './utils/mp3-gain.js';
import { providerSupportsVision } from './utils/vision.js';
import { buildZip } from './utils/zip.js';
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
import { maskId } from './utils/crypto.js';

const reconnectDelay = createExponentialBackoff();
const MENTION_RE = /<@[!&]?[^>\s]{0,64}>/g;
const MAX_SESSIONS = 300;
const SESSION_IDLE_MS = 60 * 60 * 1000;
const MAX_PENDING_MESSAGES = 200;
// WebSocket ↔ Webhook 切换的宽限期（毫秒）。
// 平台侧切换事件订阅后，两条通道可能短暂同时推送（平台侧生效有延迟、或两边各推一半）。
// 宽限期内：不立即断开旧通道、也不因反向的自动信号来回改模式，靠 msg_id 去重兜底，
// 这样才能做到「切换不丢消息、不来回震荡」。
const SWITCH_GRACE_MS = 60 * 1000;
// 「原生表情」在群聊/单聊官方 API 里发不了（表情表态仅频道支持），
// 这里用 Unicode emoji 代替：QQ 客户端会按表情样式渲染。
const EMOJIS = [
  '😀', '😄', '😊', '😉', '😍', '🤔', '😅', '😂', '🤣', '😭',
  '😴', '🥹', '😎', '👍', '👏', '🙏', '💪', '🤝', '🎉', '✨',
  '🔥', '💯', '🌟', '☕', '🌙', '🐟', '🍚',
];
// 发图后配的一句话（AI 没写配图文案时兜底；像正常人那样图后还说一句）
const IMAGE_CAPTIONS = ['画好啦，看看喜不喜欢～', '喏，画好了 ✨', '画出来啦，还满意吗？', '给你画好了，慢慢看～'];
// 生图通常要 1~2 分钟，先回一句免得用户以为没反应
const IMAGE_WAIT_LINES = ['好，我画一下，大概要一分多钟，等我～', '收到，开始画了，稍等一下下～', '在画了在画了，这个模型有点慢，等我一会儿～'];
const MEME_CAPTIONS = ['（递上梗图）', '看图你就懂了', '这张太应景了', '来，接梗～'];

function stripMentions(text) {
  return String(text ?? '').replace(MENTION_RE, '').trim();
}

/**
 * 剥掉模型复述出来的「系统记录」占位（历史里给模型看的内部记录，不该发给用户）。
 * 只匹配整行都是括号记录的情况，不误伤正文。
 */
function stripToolRecords(text) {
  return String(text ?? '')
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (/^[（(]\s*系统记录[:：]/.test(t)) return false;
      if (/^[（(]\s*已执行工具\s*[）)]$/.test(t)) return false;
      if (/^[（(]\s*已按要求生成并发送图片\s*[）)]$/.test(t)) return false;
      return true;
    })
    .join('\n')
    .trim();
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
    this.lastEventAt = 0;
    this._eventAtSaved = 0;
    // 平台切换宽限期：记录「最近一次切换方向 + 时间」，用于抑制宽限期内的反向自动切换。
    // 只有「后台显式点按钮」会立即生效，自动信号（收到推送/网关 READY）在宽限期内不来回改。
    this._switchMark = null;
    this._switchAt = 0;
    this._retireTimer = null;

    state.blockConcurrencyWhile(async () => {
      try {
        await this.loadConfig();
        const storedRun = await state.storage.get('desired_running');
        this.desiredRunning = storedRun !== false;
        try {
          const lastEventAt = await state.storage.get('last_event_at');
          if (lastEventAt) this.lastEventAt = Number(lastEventAt);
        } catch {}
        this.logger.info(
          `DO init: desiredRunning=${this.desiredRunning} transport=${this.transportName()}`
        );
        // Webhook 模式不建长连接（不计持续时间）。running 语义退化为「是否接收事件」，
        // 让后台「运行中/已停止」的展示保持不变。
        if (!this.isWsTransport()) this.running = this.desiredRunning;
        // 构造函数是所有唤醒的必经之路（Webhook 每次事件、后台查状态、WS 首次拉起、
        // alarm 到点），在这里补排 alarm 就能摆脱对「每分钟 cron 排期」的依赖。
        //
        // ⚠ 但必须先看有没有已排的 alarm：官方文档明确提醒，被 alarm 唤醒时
        // 构造函数先于 alarm() 执行，此时若直接 setAlarm 会覆盖掉正要触发的那一个。
        // 只在「当前没有 alarm」时补排，才安全。
        await this.ensureAlarmScheduled().catch(() => {});
        // 存储清理：没有 cron 兜底了，改成「距上次清理超过 24 小时才做」，
        // 避免每次唤醒都扫一遍存储
        if (state && typeof state.waitUntil === 'function') {
          state.waitUntil(this.pruneDaily());
        }
        if (this.desiredRunning && this.isWsTransport()) await this.startBot();
      } catch (e) {
        this.lastError = `Init: ${e.message}`;
        this.logger.error(`DO init failed: ${e.message}`);
      }
    });
  }

  /** 每天最多清理一次过期会话 */
  async pruneDaily() {    try {
      const last = Number(await this.state.storage.get('pruned_at')) || 0;
      if (Date.now() - last < 24 * 60 * 60 * 1000) return;
      await this.pruneStoredSessions();
      await this.state.storage.put('pruned_at', Date.now());
    } catch (e) {
      this.logger.warn(`pruneDaily failed: ${e.message}`);
    }
  }

  /**
   * 传输方式判定：跟随 QQ 开放平台的实际设置。
   *
   * 平台侧才是真正的开关。判定存成**显式的双向模式**（platformMode），
   * 而不是「有过 Webhook 痕迹就一直当 Webhook」—— 否则从 Webhook 切回
   * WebSocket 时永远翻不回来（webhookVerifiedAt 是历史记录，不会自己消失）。
   *
   * 证据来源：
   *   → webhook：收到 /event 真实推送，或 op=13 校验通过
   *   → ws     ：从网关长连接收到真实的 DISPATCH 消息事件
   *
   * 默认 'ws'：首次接入的人多半是长连接，且能保证「还没配回调」时不断掉唯一通道。
   */
  transportName() {
    if (!this.config) return 'ws';
    const mode = this.config.platformMode;
    if (mode === 'webhook' || mode === 'ws') return mode;
    // 兼容老数据：没存过 platformMode 时就按旧的痕迹推断
    return this.platformUsesWebhook() ? 'webhook' : 'ws';
  }

  /** 平台是否已经切到 Webhook（仅在没有显式 platformMode 时作为兜底推断） */
  platformUsesWebhook() {
    const cfg = this.config || {};
    if (cfg.webhookVerifiedAt) return true;
    if (this.lastEventAt) return true;
    return false;
  }

  /**
   * 把「平台已切 Webhook」写进显式模式，并在宽限期后停掉多余的长连接。
   *
   * 为什么不能一收到推送就立刻 teardown：
   * 平台侧把事件订阅改成 Webhook 后，网关长连接往往不会立刻断（服务端有延迟），
   * 反而可能出现「两条通道同时推送」的窗口。立刻断掉长连接，等于主动放弃
   * 网关那边还能补发的事件，切换瞬间就容易丢消息。
   *
   * 所以改成「先切内存模式、宽限期后回收连接」：
   *   - 立即更新 platformMode，新收到的推送按 Webhook 处理；
   *   - 长连接不急着断，让它在宽限期内继续接收（可能还有事件），靠 msg_id 去重；
   *   - 宽限期结束后再 teardown，避免一直烧 GB-s。
   * 落盘仍不阻塞切换（见下）。
   *
   * force=true 时（后台显式点按钮）跳过宽限期，立即断连接。
   */
  async markPlatformWebhook(reason, { force = false } = {}) {
    if (!this.config) return false;
    const already = this.transportName() === 'webhook' && this.config.platformMode === 'webhook';
    if (already) return false;

    const now = Date.now();
    this.config.platformMode = 'webhook';
    this.config.webhookVerifiedAt = String(now);
    this._switchMark = 'webhook';
    this._switchAt = now;
    this.running = this.desiredRunning;

    // 1) 宽限期：不立刻断连接；force 或已有连接才立即回收
    if (force) {
      this._retireWs('平台已切 Webhook（手动）');
    } else if (this.ws || this.heartbeatTimer || this.reconnectTimer) {
      this.logger.info('平台已切 Webhook，进入宽限期：长连接暂留以接住网关补发的事件');
      this._scheduleWsRetire(now);
    }

    // 2) 再尝试落盘，失败也不影响本次切换
    try {
      const { saveConfig } = await import('./db.js');
      await saveConfig(this.env, { platformMode: 'webhook', webhookVerifiedAt: String(now) });
      this.logger.info(`平台已切到 Webhook（${reason}），已同步`);
    } catch (e) {
      this.logger.warn(`markPlatformWebhook 落盘失败（本次仍已切换）: ${e.message}`);
    }
    return true;
  }

  /**
   * 反向：平台切回了 WebSocket 网关。
   *
   * 这个方向只能靠两个信号：
   *   - 手动：后台「我在平台改成了 WebSocket」按钮（force）
   *   - 自动：长连接还活着、收到 READY/RESUMED/DISPATCH（说明平台在用 WebSocket）
   *
   * 自动信号同样受宽限期保护：刚从 Webhook 切过来或刚切到 Webhook 的短时间内，
   * 不因一条偶然的网关事件就来回改模式（避免切换震荡）。
   */
  async markPlatformWs(reason, { force = false } = {}) {
    if (!this.config) return false;
    const already = this.transportName() === 'ws' && this.config.platformMode === 'ws';
    if (already) return false;

    // 自动信号在宽限期内被抑制：刚切到 webhook，旧连接还可能吐一条 READY 之类
    if (!force && this._switchAt && Date.now() - this._switchAt < SWITCH_GRACE_MS) {
      this.logger.info(`忽略宽限期内的自动 WS 信号（${reason}）`);
      return false;
    }

    const now = Date.now();
    this.config.platformMode = 'ws';
    this.config.webhookVerifiedAt = '';
    this._switchMark = 'ws';
    this._switchAt = now;

    try {
      const { saveConfig } = await import('./db.js');
      await saveConfig(this.env, { platformMode: 'ws', webhookVerifiedAt: '' });
      this.logger.info(`平台已切回 WebSocket（${reason}），已同步`);
    } catch (e) {
      this.logger.warn(`markPlatformWs 落盘失败（本次仍已切换）: ${e.message}`);
    }

    // 切回长连接：如果此刻没有连接，就把它建起来
    if (this.isWsTransport() && this.desiredRunning && !this.isAlive()) {
      this.state.waitUntil(this.startBot());
    }
    return true;
  }

  /** 宽限期结束后回收多余的长连接（只在当前仍是 webhook 模式时执行） */
  _scheduleWsRetire(fromNow) {
    const delay = SWITCH_GRACE_MS + 500;
    if (this._retireTimer) clearTimeout(this._retireTimer);
    this._retireTimer = setTimeout(() => {
      this._retireTimer = null;
      // 宽限期内又切回 ws 了，就别断
      if (!this.isWsTransport()) {
        this._retireWs('Webhook 宽限期结束');
      }
    }, delay);
  }

  /** 真正断开长连接（切换宽限期结束 / 手动强制） */
  _retireWs(why) {
    if (this._retireTimer) {
      clearTimeout(this._retireTimer);
      this._retireTimer = null;
    }
    if (this.ws || this.heartbeatTimer || this.reconnectTimer) {
      this.logger.info(`断开多余的长连接（${why}）`);
      this.teardown();
      this.running = this.desiredRunning;
    }
  }

  /**
   * 探测：网关是否可达 + 凭据是否有效。
   *
   * ⚠ 重要：**探测结果不能用来判断平台的推送方式。**
   * QQ 网关对任何机器人都接受 WebSocket 连接，跟平台侧设的是 Webhook 还是
   * WebSocket 无关。所以「能连上」不能证明平台在用 WebSocket ——
   * 早期版本按这个判据自动切换，结果把用户刚设好的 Webhook 又改回了 WS，属于反向 bug。
   *
   * 因此这里只做**诊断**：报告凭据是否可用、网关是否可达、最近有没有收到推送，
   * 由后台展示给用户，切换必须由用户显式点按钮（action=to-ws / to-webhook）。
   */
  async probePlatform() {
    const out = {
      before: this.transportName(),
      probed: false,
      wsReachable: false,
      transport: this.transportName(),
      reason: '',
    };
    if (!this.config || !this.config.appId || !this.config.secret) {
      out.reason = 'AppID / Secret 未配置，无法探测';
      return out;
    }

    let token;
    try {
      token = await this.getToken();
    } catch (e) {
      out.reason = `取 token 失败：${e.message}`;
      return out;
    }

    // 1) 先问网关要地址 —— 仅用来确认凭据可用，和推送方式无关
    let gwUrl = '';
    try {
      const res = await fetch(`${this.apiBase()}/gateway/bot`, {
        headers: { Authorization: `QQBot ${token}`, 'User-Agent': 'qq-bot-cf/1.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        out.reason = `取网关地址失败：HTTP ${res.status}`;
        return out;
      }
      const data = await res.json();
      gwUrl = data.url || '';
      if (!gwUrl) {
        out.reason = '网关返回空地址';
        return out;
      }
      out.sessionLeft = data?.session_start_limit?.remaining ?? null;
    } catch (e) {
      out.reason = `取网关地址异常：${e.message}`;
      return out;
    }

    // 2) 试连一次，只用于确认网关可达（不据此改模式！）
    out.probed = true;
    try {
      const httpUrl = gwUrl.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 10000);
      let resp;
      try {
        resp = await fetch(httpUrl, { headers: { Upgrade: 'websocket' }, signal: ac.signal });
      } finally {
        clearTimeout(timer);
      }
      const ws = resp.webSocket;
      if (ws) {
        out.wsReachable = true;
        try {
          ws.accept();
          ws.close(1000, 'Probe');
        } catch {}
      } else {
        await resp.body?.cancel();
        out.reason = `网关拒绝升级：HTTP ${resp.status}`;
      }
    } catch (e) {
      out.reason = `连接网关异常：${e.message}`;
    }

    // 3) 只报告，不切换。附上「最近有没有收到推送」这个唯一可信的旁证
    const lastEvent = Number(this.lastEventAt) || 0;
    out.lastEventAt = lastEvent || null;
    out.sinceEventMs = lastEvent ? Date.now() - lastEvent : null;
    out.transport = this.transportName();
    out.note =
      '网关可连不代表平台在用 WebSocket（任何机器人都能连网关）。'
      + '判断平台推送方式只能看：是否收到 /qq/webhook 推送。'
      + '要切换请显式点「切回长连接」或「切到 Webhook」。';
    if (!out.reason) {
      out.reason = out.wsReachable ? '凭据可用、网关可达' : '网关不可达';
    }
    return out;
  }

  /**
   * 仅报告当前状态（不探测）。给不需要真连网关的场景用。
   */
  async detectPlatform() {
    const now = Date.now();
    const lastEvent = Number(this.lastEventAt) || 0;
    const sinceEvent = lastEvent ? now - lastEvent : null;
    return {
      transport: this.transportName(),
      platformMode: this.config.platformMode || '(未设置)',
      lastEventAt: lastEvent || null,
      sinceEventMs: sinceEvent,
      suggestion:
        this.transportName() === 'webhook' && sinceEvent !== null && sinceEvent > 24 * 60 * 60 * 1000
          ? 'ws'
          : null,
    };
  }

  isWsTransport() {
    return this.transportName() === 'ws';
  }

  /**
   * 网关会话状态（sessionId + seq）落盘。
   *
   * QQ 网关支持 RESUME：带上 session_id 和最后收到的 seq，网关会补发之后漏掉的事件。
   * 这些状态必须落盘 —— DO 会被驱逐（Webhook 模式频繁休眠、或部署重启），
   * 只存内存就会丢，重启后只能重新 IDENTIFY（补不回消息，还多烧一次会话配额）。
   *
   * 写操作低频（只在 READY/RESUMED/每收到事件时），成本可忽略。
   */
  saveGwState() {
    try {
      const payload = { sessionId: this.sessionId || '', seq: this.seq ?? null, at: Date.now() };
      this.state.storage.put('gw_state', payload).catch(() => {});
    } catch {}
  }

  async loadGwState() {
    if (this.sessionId) return;
    try {
      const saved = await this.state.storage.get('gw_state');
      if (!saved) return;
      // 会话超过 24 小时基本已失效，没必要再拿它去 RESUME（会被 4006 拒掉）
      if (saved.at && Date.now() - Number(saved.at) > 24 * 60 * 60 * 1000) return;
      if (saved.sessionId) {
        this.sessionId = String(saved.sessionId);
        this.resumeSeq = saved.seq == null ? null : Number(saved.seq);
        this.logger.info(`已恢复网关会话 ${this.sessionId.slice(0, 8)}... @ seq=${this.resumeSeq}`);
      }
    } catch (e) {
      this.logger.warn(`loadGwState failed: ${e.message}`);
    }
  }

  isAlive() {
    if (!this.isWsTransport()) return !!this.desiredRunning;
    const s = this.ws && this.ws.readyState;
    return this.running && (s === 0 || s === 1);
  }

  /** 统一的「接收开关」：不建连接时也要把内存态和持久态一起改掉 */
  async setDesiredRunning(on) {
    this.desiredRunning = !!on;
    await this.state.storage.put('desired_running', !!on);
    if (!this.isWsTransport()) this.running = this.desiredRunning;
    // 开关变化要重排 alarm：开启时挂上自检，关闭时退化成只管提醒
    await this.scheduleNextAlarm().catch(() => {});
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
      case '/event': {
        // Webhook 模式的事件入口（Worker 已验签）：立即返回 200，处理交给 waitUntil
        if (!this.desiredRunning) return Response.json({ ok: true, skipped: 'stopped' });
        let payload = null;
        try {
          payload = await request.json();
        } catch {}
        if (!payload || typeof payload !== 'object') return Response.json({ ok: false, error: 'bad payload' });
        // 记下「最近一次收到真实事件」的时间：后台据此判断 Webhook 通道是否真的通
        // （只写内存 + 低频落盘，避免每条消息都多一次写操作）
        this.lastEventAt = Date.now();
        // 能收到真实推送 = 平台侧确实配了 Webhook。这是最硬的证据，
        // 立刻把本地模式同步过去（但长连接不立刻断，进入宽限期，避免切换瞬间丢消息）
        await this.markPlatformWebhook('收到平台推送').catch(() => {});
        if (!this._eventAtSaved || this.lastEventAt - this._eventAtSaved > 60000) {
          this._eventAtSaved = this.lastEventAt;
          this.state.storage.put('last_event_at', this.lastEventAt).catch(() => {});
          // 顺带补排 alarm：每 60 秒最多一次，成本可忽略，
          // 但能保证「只要有人在用，alarm 一定不会被漏排」
          this.scheduleNextAlarm().catch(() => {});
        }
        const t = String(payload.t || '');
        const d = payload.d || {};
        if (t === 'GROUP_AT_MESSAGE_CREATE' || t === 'GROUP_MESSAGE_CREATE' || t === 'C2C_MESSAGE_CREATE') {
          // handleMessage 返回该会话队列的尾巴；挂到 waitUntil 上防止对象在处理中途被驱逐
          this.state.waitUntil(
            Promise.resolve(this.handleMessage(t, d)).catch((e) =>
              this.logger.error(`Handle error: ${e.message}`)
            )
          );
        } else if (t === 'GROUP_MEMBER_ADD') {
          this.state.waitUntil(this.handleGroupMemberAdd(d).catch(() => {}));
        } else if (t === 'GROUP_ADD_ROBOT') {
          this.state.waitUntil(this.handleGroupAddRobot(d).catch(() => {}));
        } else if (t === 'C2C_MSG_RECEIVE' || t === 'FRIEND_ADD') {
          this.touchGroup(`c2c:${d.openid || ''}`);
        }
        return Response.json({ ok: true, t });
      }
      case '/detect-platform': {
        // 后台「重新检测」：真的去连一次网关，探测平台当前推送方式。
        // 为什么必须手动触发：Webhook 模式下本对象不连网关、收不到 WS 事件，
        // 平台切回 WebSocket 时没有任何被动信号能自动发现。
        const action = url.searchParams.get('action') || 'probe';
        if (action === 'to-ws') {
          await this.markPlatformWs('后台手动切回', { force: true });
          return Response.json({ ok: true, transport: this.transportName(), switched: 'ws' });
        }
        if (action === 'to-webhook') {
          await this.markPlatformWebhook('后台手动切换', { force: true });
          return Response.json({ ok: true, transport: this.transportName(), switched: 'webhook' });
        }
        if (action === 'status') {
          // 只读当前状态，不连网关
          return Response.json({ ok: true, ...(await this.detectPlatform()) });
        }
        // 默认：真探测（会尝试连一次网关）
        const probe = await this.probePlatform();
        return Response.json({ ok: true, ...probe });
      }
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
        const prevTransport = this.transportName();
        await this.loadConfig();
        this.logSystem('后台修改配置，已热更新生效');
        // 传输方式被改过：走宽限期切换（webhook 不立刻断连接、ws 补建连接），
        // 而不是立即 teardown —— 平台切换生效有延迟，立刻断连接会丢切换瞬间的消息。
        if (prevTransport !== this.transportName()) {
          const now = this.transportName();
          this.logger.info(`传输方式变化 ${prevTransport} → ${now}，走宽限期切换`);
          if (now === 'webhook') {
            await this.markPlatformWebhook('配置热更新');
          } else {
            await this.markPlatformWs('配置热更新');
          }
        } else if (this.isWsTransport() && this.running && prevWelcome !== this.config.welcomeEnabled) {
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
        const prevTransport = this.transportName();
        try { await this.loadConfig(); } catch {}
        // 传输方式变了（典型场景：QQ 平台刚校验通过回调地址）：
        // 走宽限期切换，不要立刻 teardown —— 平台切换生效有延迟，立即断连接会丢消息。
        if (prevTransport !== this.transportName()) {
          const now = this.transportName();
          this.logger.info(`Watchdog: 传输方式 ${prevTransport} → ${now}，走宽限期切换`);
          if (now === 'webhook') {
            await this.markPlatformWebhook('看门狗检测');
          } else {
            await this.markPlatformWs('看门狗检测');
          }
        }
        // 到点的定时提醒：正常由 alarm 精确驱动，这里是兜底（cron 每 6 小时一次）
        try { await this.fireDueReminders(); } catch (e) { this.logger.warn(`Reminder scan: ${e.message}`); }
        // 顺带把下一次 alarm 排上：部署新版本后新 DO 没有 alarm，靠这里补
        await this.scheduleNextAlarm().catch(() => {});
        // 会话清理：cron 本身已经很稀疏，直接执行
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
        // Webhook 模式没有连接要守：接收开关开着就算活着，不要拉起网关
        if (!this.isWsTransport()) return Response.json({ ok: true, action: 'alive', transport: 'webhook' });
        // WS 模式：cron 只做兜底，正常靠 DO 自己的 alarm 每 60 秒自检
        await this.scheduleNextAlarm().catch(() => {});
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
          transport: this.transportName(),
          platformMode: this.config.platformMode || '',
          webhookVerifiedAt: this.config.webhookVerifiedAt ? Number(this.config.webhookVerifiedAt) : null,
          lastEventAt: this.lastEventAt || null,
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
          historyLimit: Number(this.config.historyLimit) || 10,
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
    // Webhook 模式每次唤醒都是新实例：token 落盘，避免每条消息都重新换一次凭证
    if (!this.token) {
      try {
        const saved = await this.state.storage.get('token');
        if (saved && saved.value && Number(saved.expiry) > Date.now() + 60000) {
          this.token = saved.value;
          this.tokenExpiry = Number(saved.expiry);
          return this.token;
        }
      } catch {}
    }
    if (!this.tokenPromise) {
      const pending = this.refreshToken().then(async (data) => {
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
        try {
          await this.state.storage.put('token', { value: this.token, expiry: this.tokenExpiry });
        } catch {}
        return this.token;
      }).finally(() => {
        if (this.tokenPromise === pending) this.tokenPromise = null;
      });
      this.tokenPromise = pending;
    }
    return this.tokenPromise;
  }

  async startBot() {
    if (!this.isWsTransport()) {
      // Webhook 模式：没有连接可建，只把「接收开关」打开
      await this.setDesiredRunning(true);
      this.lastStartAt = Date.now();
      return;
    }
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
      // 先把上次的网关会话捞回来：有就能走 RESUME 续上，不用重新 IDENTIFY，
      // 断线期间漏掉的事件由网关补发（这是「不丢消息」的关键）
      await this.loadGwState().catch(() => {});
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
          // 配额耗尽不是永久停机：排上自检，到点自动重试（不再依赖 cron）
          await this.scheduleNextAlarm().catch(() => {});
          return;
        }
      }
      // WS 模式启动后立刻挂上自检，这样即使 cron 很久才跑一次也不会失联
      await this.scheduleNextAlarm().catch(() => {});
      this.state.waitUntil(this.connectWS(gwData.url, generation));
    } catch (e) {
      if (generation !== this.generation) return;
      this.lastError = e.message;
      this.logger.error(`Start failed: ${e.message}`);
      this.running = false;
    }
  }

  teardown() {
    // 断开前先把 seq 存下来：下次 RESUME 要带上它，网关才会补发这之后漏掉的事件
    if (this.sessionId && this.seq != null) this.saveGwState();
    this.generation++;
    this.running = false;
    this.connecting = false;
    this.awaitingAck = false;
    this.seq = null;
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this._retireTimer) { clearTimeout(this._retireTimer); this._retireTimer = null; }
    if (this.ws) { try { this.ws.close(1000, 'Stopping'); } catch (_) {} this.ws = null; }
  }

  async stopBot() {
    this.teardown();
    await this.setDesiredRunning(false);
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
    // 记下断线时的位置：优先用内存里的 seq；若内存已丢（对象被驱逐后重建），
    // 用之前落盘的 resumeSeq 兜住，保证 RESUME 能带上正确的 seq
    this.resumeSeq = this.seq != null ? this.seq : this.resumeSeq;
    this.seq = null;
    if (this.sessionId && this.resumeSeq != null) this.saveGwState();
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
    // 同时排 alarm 兜底：万一这条 setTimeout 随对象驱逐一起没了，自检还能把连接拉起来
    this.scheduleNextAlarm().catch(() => {});
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
      // 连接建立后重排自检：此刻连接在、对象会被长连接钉在内存里，
      // 但一旦连接断开而对象又被驱逐，setTimeout 就没了，只能靠 alarm 兜住
      this.scheduleNextAlarm().catch(() => {});
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
      if (s != null) {
        this.seq = s;
        // seq 是 RESUME 补发的起点，必须尽量新。但每条事件都写存储太浪费，
        // 所以节流成「最多每 5 秒落一次盘」；真正断线时 teardown/scheduleReconnect
        // 还会再补一次，所以最坏也只丢几秒的精度。
        const now = Date.now();
        if (!this._seqSavedAt || now - this._seqSavedAt > 5000) {
          this._seqSavedAt = now;
          this.saveGwState();
        }
      }
      if (t === 'READY') {
        this.reconnectAttempt = 0;
        this.identifyFailures = 0;
        this.lastError = null;
        this.sessionId = d?.session_id || null;
        this.logger.info(`Bot ready: ${d?.user?.username} session=${this.sessionId || 'none'}`);
        // 把会话与 seq 落盘：DO 被驱逐后重启还能用 RESUME 续上，
        // 不用重新 IDENTIFY，中间漏的事件也能补发
        this.saveGwState();
        // 能从网关拿到 READY，说明平台此刻用的是 WebSocket 推送。
        // 如果是「平台已切回 WS 但本地还记着 webhook」，这一下就能纠正过来。
        this.markPlatformWs('网关 READY').catch(() => {});
      } else if (t === 'RESUMED') {
        this.reconnectAttempt = 0;
        this.identifyFailures = 0;
        this.lastError = null;
        this.logger.info('Session resumed');
        this.saveGwState();
        this.markPlatformWs('网关 RESUMED').catch(() => {});
      } else if (t === 'GROUP_AT_MESSAGE_CREATE' || t === 'GROUP_MESSAGE_CREATE' || t === 'C2C_MESSAGE_CREATE') {
        // 收到真实消息事件 —— 平台确实在用 WebSocket。
        // 交给 markPlatformWs 统一处理：它内部有宽限期抑制，
        // 刚切到 Webhook 时旧连接可能还吐消息，不能因此把模式来回改。
        this.markPlatformWs('收到网关消息事件').catch(() => {});
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

  /**
   * 下载用户发来的文件附件，转成 AI 能读的内容。
   *
   * 处理策略：
   *   - 文本类（.md/.py/.js/.json/.csv/代码/日志/配置…）→ 直接解码，主要路径
   *   - docx/xlsx/pptx → 本质是 zip，抽里面的 XML 文本
   *   - 图片 → 交给识图（走 imageUrl 那条路）
   *   - .so/.zip/.exe 等二进制 → 明确告诉 AI「读不了」，避免它瞎编内容
   *
   * 不做 PDF：文本层抽取在纯 JS 下不可靠（字体编码、子集化、扫描件都会失败），
   * 与其给模型一堆乱码，不如明确说读不了。
   */
  async downloadAttachment(url, contentType, filenameHint) {
    const MAX_BYTES = 4 * 1024 * 1024; // 4MB 原始文件上限
    const MAX_TEXT = 200000;           // 仅作极端保护（模型上下文有限，真正的截断在喂模型那一步做）
    const ct = String(contentType || '').toLowerCase();
    const name = String(filenameHint || url.split('?')[0].split('/').pop() || '').slice(0, 80);
    const extMatch = name.match(/\.([a-z0-9]+)$/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : '';

    // 文本类扩展名白名单：代码、标记、配置、数据、日志都算
    const TEXT_EXT = new RegExp(
      '^(' +
        [
          // 文档 / 标记
          'txt', 'md', 'markdown', 'rst', 'adoc', 'org', 'tex', 'bib',
          // 数据 / 配置
          'json', 'jsonl', 'ndjson', 'csv', 'tsv', 'yml', 'yaml', 'toml', 'ini', 'conf', 'cfg', 'env', 'properties', 'lock', 'gitignore', 'gitattributes', 'editorconfig', 'dockerfile',
          // 前端
          'html', 'htm', 'css', 'scss', 'sass', 'less', 'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'vue', 'svelte', 'astro',
          // 后端 / 脚本
          'py', 'pyi', 'rb', 'php', 'java', 'kt', 'kts', 'scala', 'groovy', 'cs', 'fs', 'go', 'rs', 'swift', 'm', 'mm',
          'c', 'h', 'cc', 'cpp', 'cxx', 'hpp', 'hh', 'lua', 'pl', 'r', 'jl', 'dart', 'ex', 'exs', 'erl', 'clj', 'hs', 'ml',
          // 命令 / 构建
          'sh', 'bash', 'zsh', 'fish', 'ps1', 'psm1', 'bat', 'cmd', 'makefile', 'mk', 'cmake', 'gradle', 'pom', 'sbt',
          // 查询 / 序列化
          'sql', 'graphql', 'gql', 'proto', 'xml', 'xsd', 'xsl', 'svg', 'plist',
          // 日志 / 字幕 / 纯文本数据
          'log', 'out', 'err', 'srt', 'ass', 'vtt', 'diff', 'patch',
        ].join('|') +
      ')$',
      'i'
    );
    const isText = ct.startsWith('text/') || /json|xml|csv|javascript|markdown|yaml|x-sh|x-httpd-php|sql/.test(ct) || TEXT_EXT.test(ext);

    let bytes = null;
    const getBytes = async () => {
      if (bytes) return bytes;
      let res;
      try {
        res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      } catch (e) {
        throw new Error(`下载失败：${e.message}`);
      }
      if (!res.ok) throw new Error(`下载失败：HTTP ${res.status}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length > MAX_BYTES) throw new Error(`文件太大（${Math.round(buf.length / 1024 / 1024)}MB，上限 4MB）`);
      bytes = buf;
      return bytes;
    };

    const clip = (t) => {
      const s = String(t || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
      if (s.length <= MAX_TEXT) return s;
      return s.slice(0, MAX_TEXT) + `\n…（内容过长，已截断，原文约 ${s.length} 字）`;
    };

    try {
      // 1) 图片：交给识图链路，这里只报类型
      if (ct.startsWith('image/') || /^(png|jpe?g|gif|webp|bmp|ico)$/.test(ext)) {
        return { ok: false, reason: '这是图片，已按识图处理', isImage: true };
      }

      // 2) Office 必须排在文本判断之前：
      //    docx/xlsx/pptx 的 content-type 里带 "xml" 字样，会被 isText 误判成文本，
      //    然后卡在二进制检查上，永远走不到解压分支。
      if (/^(docx|xlsx|pptx)$/.test(ext)) {
        const b = await getBytes();
        const text = await this.extractOfficeText(b, ext);
        if (!text || !text.trim()) return { ok: false, reason: `${ext} 里没提取到文字` };
        return { ok: true, text, full: text, filename: name, bytes: b.length, kind: ext };
      }

      // 3) 文本类：直接解码
      if (isText) {
        const b = await getBytes();
        const zeros = b.reduce((n, v) => n + (v === 0 ? 1 : 0), 0);
        if (b.length && zeros / b.length > 0.02) {
          return { ok: false, reason: '内容看起来是二进制（不是纯文本）' };
        }
        const text = new TextDecoder('utf-8', { fatal: false }).decode(b);
        // 注意：这里返回**完整全文**，不做截断。
        // 截断只应发生在「喂给模型」时；存进沙箱必须逐字完整，否则用户要回原文件就是残缺的。
        return { ok: true, text, full: text, filename: name, bytes: b.length, kind: 'text' };
      }

      // 4) 其它二进制：明确说读不了，别让模型瞎猜
      const known = {
        so: '编译好的动态库', dll: 'Windows 动态库', exe: '可执行文件', dylib: '动态库',
        zip: '压缩包', rar: '压缩包', '7z': '压缩包', tar: '压缩包', gz: '压缩包',
        pdf: 'PDF 格式暂不支持解析', doc: '老版 Word，请另存为 docx', xls: '老版 Excel，请另存为 xlsx', ppt: '老版 PPT，请另存为 pptx',
        mp3: '音频', wav: '音频', mp4: '视频', mov: '视频', avi: '视频',
      };
      const desc = known[ext] ? `（${known[ext]}）` : '';
      return { ok: false, reason: `这是二进制文件${desc}，无法读取文字内容` };
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  }

  /** raw deflate 解压（Office 的 zip 条目用 raw deflate） */
  async inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') throw new Error('环境不支持解压');
    // 先试 raw deflate；失败再试 zlib（带 2 字节头）
    for (const fmt of ['deflate-raw', 'deflate']) {
      try {
        const ds = new DecompressionStream(fmt);
        const stream = new Blob([bytes]).stream().pipeThrough(ds);
        const buf = await new Response(stream).arrayBuffer();
        return new Uint8Array(buf);
      } catch {}
    }
    throw new Error('解压失败');
  }

  /** 从 docx/xlsx/pptx（zip）里抽 XML 文字 */
  async extractOfficeText(bytes, kind) {
    const entries = await this.unzipEntries(bytes);
    const texts = [];
    for (const [path, data] of entries) {
      // 只挑真正含正文的 XML
      const wanted =
        (kind === 'docx' && path === 'word/document.xml') ||
        (kind === 'pptx' && /^ppt\/slides\/slide\d+\.xml$/.test(path)) ||
        (kind === 'xlsx' && /^xl\/sharedStrings\.xml$/.test(path)) ||
        (kind === 'xlsx' && /^xl\/worksheets\/sheet\d+\.xml$/.test(path));
      if (!wanted) continue;
      const xml = new TextDecoder('utf-8', { fatal: false }).decode(data);
      // <w:t> 是 Word，<a:t> 是 PPT，<t> 是 Excel 共享字符串
      const parts = xml.match(/<(?:w|a)?:?t(?:\s[^>]*)?>([^<]*)<\/(?:w|a)?:?t>/g) || [];
      for (const p of parts) {
        const inner = p.replace(/^<[^>]+>/, '').replace(/<\/[^>]+>$/, '');
        if (inner.trim()) texts.push(this.decodeXmlEntities(inner));
      }
      if (kind === 'xlsx' && path.includes('sheet')) texts.push('\n');
    }
    return texts.join(kind === 'xlsx' ? ' ' : '\n').trim();
  }

  decodeXmlEntities(s) {
    return String(s)
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&amp;/g, '&');
  }

  /**
   * 极简 zip 解包（读中央目录，支持 stored 与 deflate）。
   * Office 文件是标准 zip，deflate 条目必须解压才能拿到 XML。
   */
  async unzipEntries(bytes) {
    const out = [];
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) return out;
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const jobs = [];
    for (let i = 0; i < count; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      const compSize = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true);
      const extraLen = dv.getUint16(p + 30, true);
      const commentLen = dv.getUint16(p + 32, true);
      const localOff = dv.getUint32(p + 42, true);
      const name = new TextDecoder('utf-8').decode(bytes.subarray(p + 46, p + 46 + nameLen));
      const lNameLen = dv.getUint16(localOff + 26, true);
      const lExtraLen = dv.getUint16(localOff + 28, true);
      const dataStart = localOff + 30 + lNameLen + lExtraLen;
      const comp = bytes.subarray(dataStart, dataStart + compSize);
      if (method === 0) out.push([name, comp]);
      else if (method === 8) jobs.push([name, comp]);
      p += 46 + nameLen + extraLen + commentLen;
    }
    // deflate 条目异步解压
    for (const [name, comp] of jobs) {
      try {
        const raw = await this.inflateRaw(Uint8Array.from(comp));
        out.push([name, raw]);
      } catch {
        /* 解不开就跳过这个条目，不影响其它 */
      }
    }
    return out;
  }

  async handleMessage(type, data) {
    if (this.pendingMessages >= MAX_PENDING_MESSAGES) {
      this.logger.warn("Message backlog full (" + this.pendingMessages + "), dropping event");
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
    // 群聊/单聊的附件结构不一定一样：优先挑 content_type 是图片（或 URL 长得像图片）的那一项
    let imageUrl = null;
    let fileAttachment = null; // 非图片附件（txt / md / pdf 等）
    for (const a of attachments) {
      if (!a) continue;
      const url = String(a.url || a.src || a.file_url || '').trim();
      if (!url) continue;
      const ct = String(a.content_type || a.contentType || '').toLowerCase();
      const fname = String(a.filename || a.file_name || a.name || '').trim();
      const looksImage = !ct || ct.startsWith('image/') || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url);
      if (looksImage && !imageUrl) {
        imageUrl = url;
      } else if (!looksImage && !fileAttachment) {
        fileAttachment = { url, contentType: ct, filename: fname };
      }
    }
    if (!imageUrl) {
      // 少数情况下图片以 <img src="..."> 形式内联在 content 里
      const inline = content.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (inline) imageUrl = inline[1];
    }
    if (attachments.length) {
      this.logger.info(
        `Inbound attachments: n=${attachments.length} types=${attachments.map((a) => (a && (a.content_type || a.contentType)) || '?').join(',')} urls=${attachments.map((a) => (a && a.url ? 'y' : 'n')).join(',')} | first=${JSON.stringify(attachments[0]).slice(0, 200)}`
      );
    }
    if (imageUrl) {
      this.logger.info(`Inbound image url=${imageUrl.slice(0, 90)}...`);
    } else if (attachments.length && !fileAttachment) {
      this.logger.warn('Inbound attachments present but no usable url picked');
    } else if (!attachments.length && !isC2C && /\\[图片\\]|\\[image\\]|图片/.test(content)) {
      this.logger.warn('Group message looks like an image but no attachment url (确认是否 @ 了机器人)');
    }
    if (!content && !imageUrl && !fileAttachment) return;
    if (!content) content = imageUrl ? '请描述这张图片' : '（我发了一个文件）';
    // 用户原话（不含后面拼进来的文件全文）。
    // 定时提醒只能在这句上匹配 —— 否则文章里出现「X 点提醒」就会误建提醒。
    const userText = content;

    // 文件附件：把内容读进来交给 AI，让它能真正「看到」文件
    let fileText = '';
    let fileName = '';
    if (fileAttachment) {
      try {
        const r = await this.downloadAttachment(
          fileAttachment.url,
          fileAttachment.contentType,
          fileAttachment.filename
        );
        if (r.ok) {
          fileText = r.text;
          const name = fileAttachment.filename || r.filename || '附件';
          fileName = name;
          // 把文件按原始文件名直接存进 AiDO 沙箱，不经 AI：
          // 「保存用户给的原始内容」不需要模型参与，让模型做反而容易建出空文件。
          let savedNote = '';
          try {
            const aidNs = this.env && this.env.AIDO;
            if (aidNs && typeof aidNs.idFromName === 'function') {
              const astub = aidNs.get(aidNs.idFromName(this.ownerKey({ isC2C, scopeId, userId })));
              const ares = await astub.fetch('https://aido/put', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name,
                  content: r.full || fileText,
                  owner: await maskId(userId || scopeId),
                  // 带上 scope/kind，AiDO 才能同步 D1 索引里的「文件 N 个」。
                  // 不传的话后台沙箱页会一直显示旧的文件数（实际 2 个却显示 1 个）。
                  scope: this.ownerKey({ isC2C, scopeId, userId }),
                  kind: isC2C ? 'c2c' : 'group',
                }),
              });
              const aout = await ares.json().catch(() => null);
              if (aout && aout.ok) {
                savedNote = `\n\n【系统已自动把这个文件按原名存进用户工作区：${aout.path}（${aout.bytes} 字节）】`;
                this.logger.info(`Inbound file auto-saved: ${aout.path} (${aout.bytes}B)`);
              } else if (aout && aout.error) {
                savedNote = `\n\n【系统尝试自动保存失败：${aout.error}】`;
              }
            }
          } catch (e) {
            this.logger.warn(`auto-save inbound file failed: ${e.message}`);
          }
          // 喂给模型的内容可以截断（上下文有限），但存沙箱的必须是完整全文。
          // 截断时明确告知模型「只看到前 N 字」，避免它以为全文就这么短。
          // 尽量让模型看到全文；只有特别大（>6 万字）才截断，并明确告知全文已存好
          const shown = fileText.length > 60000
            ? fileText.slice(0, 60000) + `\n…（内容较长，这里展示前 6 万字，全文 ${fileText.length} 字已完整存入工作区）`
            : fileText;
          content = `${content}\n\n【用户发来文件：${name}，共 ${r.bytes} 字节】\n\`\`\`\n${shown}\n\`\`\`${savedNote}`.slice(0, 80000);
          this.logger.info(`Inbound file attached: ${name} (${r.bytes}B, kind=${r.kind})`);
        } else if (r.isImage && !imageUrl) {
          // 附件其实是图片但没被上面识别到：补上，让它走识图
          imageUrl = fileAttachment.url;
        } else {
          this.logger.warn(`Inbound file not readable: ${r.reason}`);
          content = `${content}\n\n【用户发来文件${fileAttachment.filename ? '：' + fileAttachment.filename : ''}，但无法读取：${r.reason}。请如实告诉用户读不了，不要编造文件内容。】`;
        }
      } catch (e) {
        this.logger.warn(`downloadAttachment failed: ${e.message}`);
      }
    }

    if (!isC2C && this.groupBlacklist.has(scopeId)) return;
    if (this.sensitiveWords.some((w) => content.includes(w))) return;

    // 会话键按「人」隔离（与 ownerKey 一致），而不是按群共享：
    //   - 单聊：c2c:<user>
    //   - 群聊：group:<群>:u:<user>
    // 这样群里不同人 @ 机器人走各自的队列和 ChatDO 实例，可以**并行处理**，
    // 不会出现「A 的消息还没答完，B 就必须干等」的串行阻塞；同时每个人的
    // 对话上下文彼此隔离，不会串味。
    const key = this.ownerKey({ isC2C, scopeId, userId });
    if (!isC2C) this.touchGroup(scopeId);
    const job = { isC2C, userId, scopeId, content, imageUrl, msgId: data.id, userText, fileName, fileText };

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
    // 返回整条队列的尾巴：Webhook 模式下调用方用 waitUntil 挂住它，
    // 否则对象可能在处理中途被驱逐（长任务会直接断掉）
    return next;
  }

  async processMessage(key, job) {
    const { isC2C, userId, scopeId, content, imageUrl, msgId, userText, fileName, fileText } = job;

    // Webhook 模式下可能是全新实例：先把这条消息的 msg_seq 计数从存储里捞回来，
    // 否则第一次回复又会从 1 开始被 QQ 判为重复
    await this.loadMsgSeq(msgId);

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
              '直接 @我 说话；发图片给我可以看图回答',
              '',
              '**🎨 生图 / 表情 / 语音**',
              '- /画 一只橘猫，水彩风格（也可以说「画一张…」）',
              '- /梗图 随机一张，/梗图 名字 指定；/表情 随机 emoji',
              '- /语音 你好呀 —— 内置 TTS 合成语音',
              '',
              '**⏰ 提醒**',
              '直接说「10 分钟后提醒我喝水」「明天 8 点提醒我开会」「每天 8:00 提醒我背单词」',
              '到点主动发消息，重复提醒会自动顺延',
              '',
              '**🗂 工作区**',
              '- /工作 帮我整理这周的待办 —— 交给工作区 AI 执行（任务和笔记只属于你，别人看不到）',
              '- /工作 列表 —— 查看任务与笔记',
              '- /工作 清空 —— 重置本会话工作区',
              '',
              '**📂 文件与长文（自动）**',
              '直接说：「写一篇 3000 字关于秋天的文章，保存成 article.md 发我」',
              '我会在**你的私有工作区**里写文件，完成后自动作为附件发给你；别人看不到你的文件',
              '也可以说「我有哪些文件」「把 index.html 发我」「清空我的文件」',
              '',
              '**🧰 其它**',
              '- /菜单 —— 按钮面板',
              '- /撤回 —— 撤回我上一条',
              '- /帮助 —— 显示本帮助',
            ].join('\n')
          : [
              '🤖 指令帮助',
              '',
              '💬 聊天：@我 说话；发图可以看图',
              '🎨 生图：/画 一只橘猫（或「画一张…」）',
              '😄 表情：/梗图 [名字] · /表情',
              '🔊 语音：/语音 你好呀',
              '⏰ 提醒：10 分钟后提醒我喝水 / 明天 8 点提醒我开会',
              '',
              '🗂 工作：/工作 任务 · /工作 列表 · /工作 清空',
              '📂 文件/长文：直接说「写一篇 3000 字文章存成 article.md 发我」——在私有工作区完成并自动发附件',
              '🧰 其它：/菜单 · /撤回 · /帮助',
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

    // /工作 <任务>：在独立的 AI 工作区 DO 里执行（任务清单 / 笔记 / 多步任务）
    if (/^\/?(工作|工作区|do)(\s|$)/i.test(content)) {
      await this.handleWorkspaceCommand({ isC2C, scopeId, msgId, content, userId });
      return;
    }

    // /沙箱 <任务>：AiDO 沙箱（最高自由度，但只能在它自己的虚拟文件系统里活动）
    if (/^\/?(沙箱|ai|sandbox)(\s|$)/i.test(content)) {
      await this.handleAiSandbox({ isC2C, scopeId, msgId, content, userId });
      return;
    }

    // 定时提醒：识别「X 点提醒我…」直接落库，不绕 AI（AI 未配置也能用）。
    // 只在用户原话上解析：content 里可能拼了几千字文件内容，
    // 正文出现「提醒」字样会误建提醒。
    const reminderIntent = parseReminder(userText || content);
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
      // 新提醒落库后立刻重排 alarm，让它到点被唤醒（不再依赖每分钟 cron）
      await this.scheduleNextAlarm().catch(() => {});
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

    let providers = (this.config.aiProviders || []).filter(
      (p) => p && p.enabled !== 0 && p.baseUrl && p.apiKey && p.model
    );
    if (!providers.length) {
      this.logger.warn('No AI available (去后台「AI 对话」添加并启用一个)');
      return;
    }

    const historyLimit = Number(this.config.historyLimit) || 10;
    const chatDoNs = this.env && (this.env.CHAT || this.env.AI_WORKER);
    const useAiDo = !!chatDoNs;
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

    let aiImage = null;
    if (imageUrl) {
      aiImage = await this.downloadImageAsBase64(imageUrl);
      if (!aiImage) this.logger.warn('Image download failed, sending text-only to AI');
    }

    // 带图消息只发给声明支持识图的模型（后台每个 AI 可单独设置；auto 按模型名判断）
    if (aiImage) {
      const visionProviders = providers.filter((p) => providerSupportsVision(p));
      if (!visionProviders.length) {
        await this.sendReply({
          isC2C,
          scopeId,
          content: '我这边还没接能看图的模型～ 到后台「AI 对话」里，给支持识图的模型把「识图能力」选成「支持识图」，或者换一个多模态模型再发一次。',
          msgId,
        });
        this.logger.warn(`Image message dropped: ${providers.length} provider(s) but none supports vision`);
        return;
      }
      providers = visionProviders;
    }

    let reply = null;
    let aiErr = null;
    let used = null;

    if (useAiDo) {
      // 会话历史与模型调用都交给独立的 ChatDO（长请求不阻塞 QQ 网关）
      try {
        const out = await this.askAiDo({
          key,
          providers,
          systemPrompt: this.buildSystemPrompt(),
          historyLimit,
          content,
          image: aiImage,
        });
        if (out && out.error === 'no_vision') {
          await this.sendReply({
            isC2C,
            scopeId,
            content: '我这边还没接能看图的模型～ 到后台「AI 对话」里，给支持识图的模型把「识图能力」选成「支持识图」。',
            msgId,
          });
          return;
        }
        if (!out || out.error) throw new Error((out && out.error) || 'ChatDO 无响应');
        const text = stripMentions(out.text);
        const clean = /^@\S+\s+/.test(text) ? text.replace(/^@\S+\s+/, '') : text;
        const stripped = stripToolRecords(clean);
        if (!stripped) throw new Error('AI 只返回了内部记录');
        reply = stripped;
        used = out.provider;
      } catch (e) {
        aiErr = e;
        this.logger.warn(`ChatDO 调用失败: ${e.message}`);
        this.logSystem(`ChatDO 调用失败（${e.message.slice(0, 120)}）`);
      }
    } else {
      history.push({ role: 'user', content });
      while (history.length > historyLimit + 1) history.splice(1, 1);
      const msgs = history.slice();
      // 早前对话的压缩摘要（历史被裁剪后，长期记忆靠它保留）
      if (session.summary) msgs.splice(1, 0, { role: 'system', content: `【早前对话摘要】${session.summary}` });
      if (aiImage) {
        msgs[msgs.length - 1] = {
          role: 'user',
          content: [
            { type: 'text', text: content },
            { type: 'image_url', image_url: { url: aiImage } },
          ],
        };
      }
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
          // 模型可能把历史里的内部记录（「（系统记录：…）」）复述出来，发出去前剥掉
          const stripped = stripToolRecords(clean);
          if (!stripped) throw new Error('AI 只返回了内部记录');
          reply = stripped;
          used = provider;
          break;
        } catch (e) {
          aiErr = e;
          this.logger.warn(`AI ${provider.name || provider.model} 不可用: ${e.message}`);
          this.logSystem(`AI「${provider.name || provider.model}」调用失败（${e.message.slice(0, 120)}），自动尝试下一个备用`);
        }
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
        await this.rememberAssistant({ key, session, history, text: '（系统记录：已生成图片并发送给用户）', useAiDo, historyLimit, providers });
        // 标记前面如果写了话，就当作配图文案（图发完再发这句）
        const caption = reply.slice(0, reply.indexOf('[GEN_IMAGE]')).trim();
        await this.handleImageGen({ isC2C, scopeId, msgId, prompt: genMatch[1].trim(), caption, userId, userContent: content });
        return;
      }
      // 兜底：AI 声称「生成好了」却漏了标记，用用户描述 + 回复内容补画
      if (/生成好|画好|已生成|出图|做好了|马上画|正在画/.test(reply)) {
        const prompt = `${content}\n${reply.replace(/\[GEN_IMAGE\]/g, '')}`
          .trim()
          .slice(0, 400);
        if (prompt) {
          await this.rememberAssistant({ key, session, history, text: '（系统记录：已生成图片并发送给用户）', useAiDo, historyLimit, providers });
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
        const toolResult = await this.runTool(toolCall, { isC2C, scopeId, key, msgId, userId, userContent: content, useAiDo });
        await this.rememberAssistant({ key, session, history, text: this.toolRecordNote(toolCall), useAiDo, historyLimit, providers });
        // 有长期价值的结果（发过文件 / 做过任务 / 定过提醒）单独进 facts 层；
        // 图片、梗图、表情这类一次性产物不记，避免上下文膨胀
        const fact = this.factFromTool(toolCall, toolResult);
        if (fact) await this.rememberFact({ key, text: fact, useAiDo });
        // 工具这条也要进聊天记录，并且带上实际用的模型 ——
        // 否则后台「聊天记录」里工具类回复只会显示成一条没有模型的空白记录
        this.logExchange({
          isC2C,
          scopeId,
          userId,
          userContent: imageUrl ? `[图片] ${content}` : content,
          aiReply: this.toolRecordNote(toolCall),
          model: used ? `${used.name} · ${used.model}`.slice(0, 128) : null,
        });
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
    await this.rememberAssistant({ key, session, history, text: normalizeFaceTags(reply), useAiDo, historyLimit, providers });
    if (session) {
      session.lastUsed = Date.now();
      await this.saveSession(key, session);
      // 本地模式的摘要压缩；ChatDO 模式下它自己管历史与摘要
      if (!useAiDo && used && this.state && typeof this.state.waitUntil === 'function') {
        this.state.waitUntil(this.maybeSummarize(key, session, used));
      }
    }
    this.logger.info(`Replied to ${isC2C ? 'c2c' : 'group'} chat: ${reply.slice(0, 50)}...`);

    // 聊天记录写库不阻塞队列：它只是「留痕」，不是回复的必要条件。
    // 同步 await 会拖慢同会话下一条消息（队列是串行的），改成 waitUntil
    // 让队列立即释放，记录在后台异步完成；失败也不影响主流程。
    const logWrite = addChatLog(this.env, {
      kind: isC2C ? 'c2c' : 'group',
      scopeId,
      userId,
      // 带图的消息在记录里标一下，后台能看出这是图片消息
      userContent: imageUrl ? `[图片] ${content}` : content,
      aiReply: normalizeFaceTags(reply),
      model: used ? `${used.name} · ${used.model}`.slice(0, 128) : null,
    }).catch((e) => this.logger.warn(`Chat log write failed: ${e.message}`));
    if (this.state && typeof this.state.waitUntil === 'function') {
      this.state.waitUntil(logWrite);
    } else {
      await logWrite;
    }

    // 把这个人登记进「工作区」索引（不动文件、不动 runs）。
    // 之前只有写/读文件时才建索引，导致只聊天的人在工作区页面里根本看不到。
    this.touchWorkspace({ isC2C, scopeId, userId, lastTask: String(userText || content).slice(0, 60) });
  }

  /**
   * 轻量登记：让这个人出现在后台「工作区」列表里。
   *
   * 不阻塞主流程（挂 waitUntil），失败只记日志。
   * 索引里已经有他时，只更新 lastTask，不动 updatedAt/files/runs。
   */
  touchWorkspace({ isC2C, scopeId, userId, lastTask }) {
    const ns = this.env && this.env.AIDO;
    if (!ns || typeof ns.idFromName !== 'function') return;
    if (!this.state || typeof this.state.waitUntil !== 'function') return;
    const key = this.ownerKey({ isC2C, scopeId, userId });
    const run = (async () => {
      try {
        const stub = ns.get(ns.idFromName(key));
        await stub.fetch('https://aido/touch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope: key,
            kind: isC2C ? 'c2c' : 'group',
            owner: await maskId(userId || scopeId),
            lastTask,
          }),
        });
      } catch (e) {
        this.logger.warn(`touchWorkspace failed: ${e.message}`);
      }
    })();
    this.state.waitUntil(run);
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
          '\n- file：{"path":"index.html"} —— 把沙箱里的文件作为附件发给用户（文件必须已在你的工作区里）' +
          '\n- sandbox：{"task":"要完成的完整任务"} —— 在用户的私有工作区里干活：写长文、生成文件、多步整理；任务完成后文件会自动发给用户' +
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
    const workspaceHint =
      '\n\n【你的工作区】你有一个私有工作区，运行在 Cloudflare Durable Objects 的持久化存储里（AiDO 实例），每个用户一个独立空间，文件路径形如 users/<用户编号>/。' +
      '你可以在里面创建、修改、删除文件（单文件 ≤1.9MB、每人总量 ≤1GB、最多 5000 个文件），也可以把它当作多步任务的草稿本。' +
      '需要写长文、生成文件、整理多步任务时用 sandbox 工具；生成的文件会自动作为附件发给用户。' +
      '\n【关于用户发来的文件】消息里出现「【用户发来文件：xxx】」时，**那段代码块里的文字就是文件真实内容**，已经读到了。' +
      '用户说「存进我的目录」「保存这个」「收下」时，必须把**这段真实内容原样写进工作区**（用 sandbox 工具，任务里明确给出文件名和内容），' +
      '**严禁**创建空文件、占位文件、或只写一句「缺少具体保存内容」的说明文件 —— 那是严重错误。' +
      '如果内容确实没读到（提示「无法读取」），才如实告诉用户读不了，并说明原因。' +
      '如果用户问你在哪、沙箱是什么，就按这段如实回答：你在 Cloudflare 的 Durable Object 存储里活动，数据持久化、实例休眠也不会丢。用户要已有的文件时，用 file 工具直接发；不知道路径就让 sandbox 工具列一下并逐个发。不要因为「不能打包成 zip」就拒绝发送文件。'

    return (
      basePrompt +
      workspaceHint +
      '\n\n对话历史里以「（系统记录：…）」开头的句子是系统内部记录，只用来让你知道刚才做过什么，不要复述给用户。' +
      genHint +
      toolHint +
      memeHint
    );
  }

  /** 工具执行后写回历史的一行内部记录（不发给用户，模型也不该复述） */
  /**
   * 工具执行留痕：写进对话历史的那一行。
   *
   * 设计原则（防止上下文膨胀）：**只记「做过什么」，不记结果全文**。
   * 图片、梗图、表情这类一次性产物只需留个痕迹；
   * 文件/任务这种「以后还会问起」的，另外用 rememberFact() 写进长期记忆。
   */
  toolRecordNote(call) {
    const args = (call && call.args) || {};
    const name = (call && call.name) || '工具';
    if (name === 'file') {
      const p = String(args.path || '').trim();
      return `（系统记录：已把文件 ${p || '附件'} 发给用户）`;
    }
    if (name === 'sandbox') {
      const task = String(args.task || '').slice(0, 200);
      return `（系统记录：已在工作区执行任务「${task}」）`;
    }
    const brief = args.text || args.prompt || args.name || args.when || '';
    const detail = brief ? `「${String(brief).slice(0, 40)}」` : '';
    return `（系统记录：已执行 ${name}${detail}，结果已发送给用户）`;
  }

  /**
   * 值得长期记住的工具结果 → 交给 ChatDO 的 facts 层。
   *
   * 哪些算「值得」：用户会重复问起的东西。
   *   - 发过的文件（路径 + 名字）：下次说「把上次那个文件发我」要能想起来
   *   - 做过的任务（一句话摘要）：下次问「我之前让你做的呢」要答得上
   *   - 定的提醒：什么时候提醒什么
   *
   * 不记：图片 prompt、梗图名、emoji —— 这些是一次性产物，记了只占地方。
   */
  async rememberFact({ key, text, useAiDo }) {
    const clean = String(text || '').trim().slice(0, 120);
    if (!clean) return;
    if (!useAiDo) return; // 没有 ChatDO 就没有 facts 层，跳过
    try {
      const stub = this.chatDoStub(key);
      if (!stub) return;
      await stub.fetch('https://ai-do/fact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, text: clean }),
      });
    } catch (e) {
      this.logger.warn(`rememberFact failed: ${e.message}`);
    }
  }

  /**
   * 沙箱任务完成后，把「做了什么 + 产出哪些文件」写进长期记忆。
   *
   * 为什么放在任务完成之后：沙箱是后台异步跑的，runTool 返回时还不知道结果。
   * 只有跑完才能拿到真实文件列表，这时记下来才准。
   */
  async rememberSandboxFact({ key, task, isC2C, scopeId, userId, useAiDo }) {
    if (!useAiDo) return;
    const parts = [];
    const t = String(task || '').trim().slice(0, 50);
    if (t) parts.push(`做过任务「${t}」`);
    try {
      // 直接问 AiDO 要当前文件列表（比解析发送队列可靠）
      const ns = this.env && this.env.AIDO;
      if (ns && typeof ns.idFromName === 'function') {
        const stub = ns.get(ns.idFromName(this.ownerKey({ isC2C, scopeId, userId })));
        const res = await stub.fetch('https://aido/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        const st = await res.json().catch(() => null);
        const files = st && Array.isArray(st.files) ? st.files.map((f) => String(f.path).split('/').pop()).filter(Boolean) : [];
        if (files.length) parts.push(`工作区现有文件 ${files.slice(0, 4).join('、')}${files.length > 4 ? ` 等 ${files.length} 个` : ''}`);
      }
    } catch {}
    if (parts.length) await this.rememberFact({ key, text: parts.join('，'), useAiDo });
  }

  /** 从工具调用里挑出值得进长期记忆的那条事实（没有就返回 null） */
  factFromTool(call, result) {
    const args = (call && call.args) || {};
    const name = (call && call.name) || '';
    if (name === 'file') {
      const p = String(args.path || '').trim();
      const fname = p.split('/').pop() || p;
      return fname ? `给用户发过文件 ${fname}` : null;
    }
    if (name === 'sandbox') {
      const task = String(args.task || '').trim().slice(0, 60);
      const files = (result && Array.isArray(result.sent) ? result.sent : []).map((f) => String(f).split('/').pop()).filter(Boolean);
      const parts = [];
      if (task) parts.push(`做过任务「${task}」`);
      if (files.length) parts.push(`产出文件 ${files.slice(0, 3).join('、')}`);
      return parts.length ? parts.join('，') : null;
    }
    if (name === 'remind') {
      const when = String(args.when || '').trim().slice(0, 30);
      const what = String(args.text || '').trim().slice(0, 40);
      return when && what ? `设过提醒：${when} 提醒「${what}」` : null;
    }
    return null; // image / meme / voice / 查询类都不记
  }

  /* ------------------------------ 独立工具 DO ------------------------------ */

  /**
   * 私密数据的归属键：工作区 / 沙箱都按「人」存，不再按群共享。
   * - 单聊：c2c:<user>
   * - 群聊：group:<群>:u:<user>（同一个人在同群里的任务/文件只有他自己能看到）
   */
  ownerKey({ isC2C, scopeId, userId }) {
    return isC2C ? `c2c:${userId || scopeId}` : `group:${scopeId}:u:${userId || 'unknown'}`;
  }


  /** 调 ToolDO 执行工具；没有绑定时返回 null，走本地实现 */
  async execToolDo(tool, args, { isC2C, scopeId, msgId, caption, userId }) {
    const ns = this.env && (this.env.WORK || this.env.TOOL);
    if (!ns || typeof ns.idFromName !== 'function') return null;
    const key = this.ownerKey({ isC2C, scopeId, userId });
    const stub = ns.get(ns.idFromName(key));
    const token = await this.getToken();
    const provider = (this.config.aiProviders || []).find((p) => p && p.enabled !== 0 && p.baseUrl && p.apiKey);
    const seqBase = (msgId && this.msgSeqMap ? this.msgSeqMap.get(msgId) : 0) || 0;
    const res = await stub.fetch('https://tool/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool,
        args: { ...(args || {}), ...(caption ? { caption } : {}) },
        ctx: {
          isC2C: !!isC2C,
          scopeId,
          msgId: msgId || '',
          userId: userId || '',
          base: this.apiBase(),
          token,
          seqBase,
        },
        cfg: {
          imageGenModel: this.config.imageGenModel || '',
          imageBase: String(this.config.imageGenBaseUrl || '').trim() || (provider ? provider.baseUrl : ''),
          imageKey: String(this.config.imageGenApiKey || '').trim() || (provider ? provider.apiKey : ''),
          voiceLang: this.config.voiceLang || 'zh',
          voiceGain: this.config.voiceGain || '6',
        },
      }),
    });
    if (!res.ok) throw new Error(`ToolDO HTTP ${res.status}`);
    const out = await res.json();
    if (msgId && out && out.used) {
      if (!this.msgSeqMap) this.msgSeqMap = new Map();
      this.msgSeqMap.set(msgId, seqBase + out.used);
    }
    return { ok: !!(out && out.ok), note: (out && out.note) || '' };
  }

  /** /沙箱 <任务>：在 AiDO 沙箱里执行（最高自由度，但只能动沙箱自己的文件） */
  async handleAiSandbox({ isC2C, scopeId, msgId, content, userId, background = false }) {
    const ns = this.env && this.env.AIDO;
    if (!ns || typeof ns.idFromName !== 'function') {
      await this.sendReply({ isC2C, scopeId, content: 'AiDO 还没启用（缺 AIDO 绑定），等新版部署后再试。', msgId });
      return;
    }
    const key = this.ownerKey({ isC2C, scopeId, userId });
    const stub = ns.get(ns.idFromName(key));
    const callDo = async (path, body) => {
      const res = await stub.fetch(`https://aido${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      if (!res.ok) throw new Error(`AiDO HTTP ${res.status}`);
      return res.json();
    };
    const arg = content.replace(/^\/?(沙箱|ai|sandbox)\s*/i, '').trim();

    if (!arg || /^(帮助|help|\?)$/i.test(arg)) {
      let st = null;
      try {
        st = await callDo('/state');
      } catch {}
      const lines = [
        '🧪 AiDO 沙箱',
        '/沙箱 <任务> —— 让 AI 在隔离沙箱里干活（可以自己建文件、写笔记、做多步任务）',
        '/沙箱 文件 —— 看沙箱里的文件（只有你能看到）',
        '/沙箱 查看 <路径> —— 在聊天里看文件内容',
        '/沙箱 发送 <路径> —— 把文件作为附件发给你（AI 生成文件后也会自己发）',
        '/沙箱 清空 —— 清空沙箱',
        '边界：只能读写它自己的虚拟文件，不能发消息、不能联网、不能碰其他 DO。',
      ];
      if (st && st.files && st.files.length) lines.push(`当前文件：${st.files.length} 个，已执行 ${st.runs || 0} 次`);
      await this.sendReply({ isC2C, scopeId, content: lines.join('\n'), msgId });
      return;
    }
    if (/^(文件|列表|状态)$/i.test(arg)) {
      const st = await callDo('/state');
      const files = st.files && st.files.length
        ? st.files.map((f) => `· ${f.path}（${f.bytes}B）`).join('\n')
        : '（沙箱里还没有文件）';
      await this.sendReply({ isC2C, scopeId, content: `🧪 沙箱文件\n${files}`, msgId });
      return;
    }
    if (/^(查看|读取|read)\s+/i.test(arg)) {
      const path = arg.replace(/^(查看|读取|read)\s+/i, '').trim();
      const out = await callDo('/file', { path }).catch((e) => ({ error: e.message }));
      if (!out || out.error) {
        await this.sendReply({ isC2C, scopeId, content: `没找到文件「${path}」～ /沙箱 文件 看看有哪些`, msgId });
        return;
      }
      const body = String(out.content || '');
      const shown = body.length > 1200 ? body.slice(0, 1200) + '\n…（已截断，完整内容可在后台「沙箱」页查看）' : body;
      await this.sendReply({ isC2C, scopeId, content: `📄 ${out.path}（${out.bytes}B）\n\n${shown}`, msgId });
      return;
    }

    if (/^(发送|发文件|send)\s+/i.test(arg)) {
      const path = arg.replace(/^(发送|发文件|send)\s+/i, '').trim();
      const out = await callDo('/file', { path }).catch((e) => ({ error: e.message }));
      if (!out || out.error) {
        await this.sendReply({ isC2C, scopeId, content: `没找到文件「${path}」～ /沙箱 文件 看看有哪些`, msgId });
        return;
      }
      const name = out.path.split('/').pop();
      const sent = await this.execToolDo('file', { path: out.path, content: out.content, name }, { isC2C, scopeId, msgId, userId });
      if (!sent || !sent.ok) {
        await this.sendReply({ isC2C, scopeId, content: '文件发送失败了，稍后再试～', msgId });
      }
      return;
    }

    if (/^(清空|重置)$/i.test(arg)) {
      await callDo('/reset');
      await this.sendReply({ isC2C, scopeId, content: '沙箱已清空。', msgId });
      return;
    }

    const providers = (this.config.aiProviders || []).filter(
      (p) => p && p.enabled !== 0 && p.baseUrl && p.apiKey && p.model
    );
    if (!providers.length) {
      await this.sendReply({ isC2C, scopeId, content: '还没配置 AI，去后台「AI 对话」加一个再 /沙箱。', msgId });
      return;
    }
    if (isC2C && msgId) this.state.waitUntil(this.sendTyping({ scopeId, msgId }));
    // 长任务（写文章/多步）可能要几分钟，先给个反馈
    // 单聊被动回复只有 4 条额度：不发「开始处理」，把额度留给文件和结果；后台模式已经发过提示
    if (!background && msgId && !isC2C) {
      try {
        await this.sendReply({
          isC2C,
          scopeId,
          content: '收到，开始处理了～长任务可能要几分钟，完成后把结果（和文件）发你。',
          msgId,
        });
      } catch (e) {
        this.logger.warn(`sandbox wait notice failed: ${e.message}`);
      }
    }
    const startedAt = Date.now();
    const out = await callDo('/run', {
      task: arg,
      scope: key,
      kind: isC2C ? 'c2c' : 'group',
      owner: await maskId(userId || scopeId),
      systemPrompt: this.config.systemPrompt || '你是一个靠谱、务实的 QQ 机器人助手。',
      providers,
    });
    if (!out || out.error) {
      await this.sendReply({ isC2C, scopeId, content: `沙箱执行失败：${(out && out.error) || '未知错误'}`, msgId });
      return;
    }
    // AI 在沙箱里要求发送的文件（file.send）：这里真正上传并发送
    const sentFiles = [];
    const failedFiles = [];
    const passiveOk = !!msgId && Date.now() - startedAt < 240000;
    const waitMs = Date.now() - startedAt;
    if (Array.isArray(out.send) && out.send.length) {
      const sendList = out.send.slice(0, 50);
      if (sendList.length > 3) {
        // 超过 3 个文件：打包成一个 zip 发送
        const entries = [];
        for (const p of sendList) {
          try {
            const f = await callDo('/file', { path: p });
            if (f && !f.error) entries.push({ path: f.path, content: String(f.content || '') });
          } catch {
            /* 跳过读不到的文件 */
          }
        }
        if (entries.length > 3) {
          try {
            const zip = buildZip(entries);
            if (zip.length > 4 * 1024 * 1024) {
              failedFiles.push(`打包失败：zip 超过 4MB（${Math.round(zip.length / 1024)}KB）`);
            } else {
              const r = await this.execToolDo(
                'file',
                { name: 'sandbox_files.zip', contentBase64: toBase64(zip) },
                { isC2C, scopeId, msgId: passiveOk ? msgId : '', userId }
              );
              if (r && r.ok) sentFiles.push(`sandbox_files.zip（${entries.length} 个文件）`);
              else failedFiles.push(`sandbox_files.zip（${(r && r.note) || '发送失败'}）`);
            }
          } catch (e) {
            failedFiles.push(`打包失败：${e.message.slice(0, 40)}`);
          }
          sendList.length = 0;
        }
      }
      for (const p of sendList) {
        try {
          const f = await callDo('/file', { path: p });
          if (f && !f.error) {
            const r = await this.execToolDo(
              'file',
              { path: f.path, content: f.content, name: f.path.split('/').pop() },
              // 任务跑了很久时 msg_id 可能已过期，改用主动消息发送
              { isC2C, scopeId, msgId: passiveOk ? msgId : '', userId }
            );
            if (r && r.ok) {
              sentFiles.push(f.path);
            } else {
              failedFiles.push(`${f.path.split('/').pop()}（${(r && r.note) || '发送失败'}）`);
            }
            if (r && !r.ok && !isC2C) {
              // 群聊发文件失败：把内容分段当文本发出来，并提示私聊拿完整文件
              const text = String(f.content || '');
              const chunks = [];
              for (let k = 0; k < text.length && chunks.length < 3; k += 1400) chunks.push(text.slice(k, k + 1400));
              for (const c of chunks) {
                await this.sendReply({ isC2C, scopeId, content: c, msgId: passiveOk ? msgId : '' });
              }
              await this.sendReply({
                isC2C,
                scopeId,
                content: `（文件 ${f.path.split('/').pop()} 发送失败，以上是内容节选；完整文件请私聊我说「把 ${f.path.split('/').pop()}」）`,
                msgId: passiveOk ? msgId : '',
              });
            }
          }
        } catch (e) {
          failedFiles.push(`${p.split('/').pop()}（${e.message.slice(0, 40)}）`);
          this.logger.warn(`sandbox send failed: ${e.message}`);
        }
        // 连续上传容易撞限流，间隔一下
        await new Promise((res) => setTimeout(res, 600));
      }
    }
    const failNote = failedFiles.length ? `\n（未发送成功：${failedFiles.join('、')}）` : '';
    const sentNote = sentFiles.length
      ? `\n（已发送文件：${sentFiles.join('、')}）${isC2C ? '' : '　群里看不到文件卡片的话，私聊我发「把 <文件名> 发我」'}`
      : '';
    if (sentFiles.length) {
      this.logger.info(`sandbox files sent: ${sentFiles.join(',')}（任务耗时 ${Math.round(waitMs / 1000)}s, passive=${passiveOk}）`);
    } else if (Array.isArray(out.send) && out.send.length) {
      this.logger.warn(`sandbox files NOT sent: ${out.send.join(',')}（任务耗时 ${Math.round(waitMs / 1000)}s, passive=${passiveOk}）`);
    }
    const finalText = `${out.reply}${sentNote}\n\n（沙箱：${out.steps} 步 · ${out.files} 个文件）`;
    const sent = await this.sendReply({ isC2C, scopeId, content: finalText, msgId });
    if (!sent && msgId) {
      // 被动回复窗口（5 分钟）可能已经过了，改发主动消息兜底
      await this.sendReply({ isC2C, scopeId, content: finalText });
    }
    this.logExchange({
      isC2C,
      scopeId,
      userId,
      userContent: content,
      aiReply: `[沙箱] ${String(out.reply).slice(0, 300)}`,
      model: 'AiDO',
    });
  }

  /* ------------------------------ AI 工作区（/工作） ------------------------------ */

  async handleWorkspaceCommand({ isC2C, scopeId, msgId, content, userId }) {
    const ns = this.env && (this.env.WORK || this.env.WORKSPACE);
    if (!ns || typeof ns.idFromName !== 'function') {
      await this.sendReply({
        isC2C,
        scopeId,
        content: '工作区还没启用（缺 WORKSPACE 绑定），等新版部署后再试。',
        msgId,
      });
      return;
    }
    const key = this.ownerKey({ isC2C, scopeId, userId });
    const stub = ns.get(ns.idFromName(key));
    const callWs = async (path, body) => {
      const res = await stub.fetch(`https://ws${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      if (!res.ok) throw new Error(`工作区 HTTP ${res.status}`);
      return res.json();
    };
    const arg = content.replace(/^\/?(工作|工作区|do)\s*/i, '').trim();

    if (!arg || /^(帮助|help|\?)$/i.test(arg)) {
      let st = null;
      try {
        st = await callWs('/state');
      } catch {}
      const lines = [
        '🗂 AI 工作区',
        '/工作 <任务> —— 把任务交给工作区里的 AI 执行（它可以维护任务清单和笔记）',
        '/工作 列表 —— 看当前任务与笔记（只有你能看到）',
        '/工作 清空 —— 清空这个会话的工作区',
      ];
      if (st && st.tasks && st.tasks.length) {
        lines.push(`当前：${st.tasks.length} 条任务（已完成 ${st.tasks.filter((x) => x.done).length} 条）`);
      }
      await this.sendReply({ isC2C, scopeId, content: lines.join('\n'), msgId });
      return;
    }

    if (/^(列表|查看|状态)$/i.test(arg)) {
      const st = await callWs('/state');
      const tasks = st.tasks && st.tasks.length
        ? st.tasks.map((x) => `${x.id}. ${x.done ? '✅' : '⬜'} ${x.text}`).join('\n')
        : '（还没有任务）';
      const notes = st.notes && st.notes.length
        ? '\n\n📝 最近笔记\n' + st.notes.slice(-5).map((n) => `· ${n.text}`).join('\n')
        : '';
      await this.sendReply({ isC2C, scopeId, content: `📋 任务清单\n${tasks}${notes}`, msgId });
      return;
    }

    if (/^(清空|重置)$/i.test(arg)) {
      await callWs('/reset');
      await this.sendReply({ isC2C, scopeId, content: '工作区已清空（任务和笔记都删掉了）。', msgId });
      return;
    }

    const providers = (this.config.aiProviders || []).filter(
      (p) => p && p.enabled !== 0 && p.baseUrl && p.apiKey && p.model
    );
    if (!providers.length) {
      await this.sendReply({ isC2C, scopeId, content: '还没配置 AI，去后台「AI 对话」加一个再 /工作。', msgId });
      return;
    }

    if (isC2C && msgId) this.state.waitUntil(this.sendTyping({ scopeId, msgId }));
    const out = await callWs('/run', {
      scope: key,
      kind: isC2C ? 'c2c' : 'group',
      task: arg,
      systemPrompt: this.config.systemPrompt || '你是一个靠谱、务实的 QQ 机器人助手，回答简洁、可执行。',
      providers,
    });
    if (!out || out.error) {
      await this.sendReply({ isC2C, scopeId, content: `工作区执行失败：${(out && out.error) || '未知错误'}`, msgId });
      return;
    }
    const applied = Array.isArray(out.applied) && out.applied.length ? `\n\n（工作区：${out.applied.join('、')}）` : '';
    await this.sendReply({ isC2C, scopeId, content: `${out.reply}${applied}`, msgId });
    this.logExchange({
      isC2C,
      scopeId,
      userId,
      userContent: content,
      aiReply: `[工作区] ${String(out.reply).slice(0, 300)}`,
      model: '工作区',
    });
  }

  /* -------------------- 独立的 ChatDO（会话历史 + 模型调用） -------------------- */

  /** 调 ChatDO 完成一轮对话；没有绑定时返回 null，走本地逻辑 */
  /** 取 ChatDO 的 stub（每次重试都重新取，避免打到已被重启的旧实例） */
  chatDoStub(key) {
    const ns = this.env && (this.env.CHAT || this.env.AI_WORKER);
    if (!ns || typeof ns.idFromName !== 'function') return null;
    return ns.get(ns.idFromName(key));
  }

  async askAiDo({ key, providers, systemPrompt, historyLimit, content, image }) {
    const ns = this.env && (this.env.CHAT || this.env.AI_WORKER);
    if (!ns || typeof ns.idFromName !== 'function') return null;
    const payload = JSON.stringify({ key, providers, systemPrompt, historyLimit, content, image });
    let lastErr = null;
    // 部署 / 休眠会让 DO 实例重启：每次重试都重建 stub，给新实例接管的时间
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const stub = this.chatDoStub(key);
        const res = await stub.fetch('https://ai-do/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        });
        if (!res.ok) throw new Error(`ChatDO HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        lastErr = e;
        this.logger.warn(`ChatDO attempt ${attempt} failed: ${e.message}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
    throw lastErr;
  }

  async recordAiDo({ key, assistant, historyLimit, providers }) {
    // 带上 providers：ChatDO 压缩滚出的消息时要用它调模型生成摘要
    const payload = JSON.stringify({ key, assistant, historyLimit, providers });
    let lastErr = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const stub = this.chatDoStub(key);
        if (!stub) return;
        const res = await stub.fetch('https://ai-do/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        });
        if (!res.ok) throw new Error(`ChatDO record HTTP ${res.status}`);
        return;
      } catch (e) {
        lastErr = e;
        this.logger.warn(`ChatDO record attempt ${attempt} failed: ${e.message}`);
        if (attempt < 2) await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
    throw lastErr;
  }

  /** 记录助手这轮内容：走 ChatDO 就写进 ChatDO，否则写本地会话 */
  async rememberAssistant({ key, session, history, text, useAiDo, historyLimit, providers }) {
    if (useAiDo) {
      try {
        await this.recordAiDo({ key, assistant: text, historyLimit, providers });
      } catch (e) {
        this.logger.warn(`ChatDO record failed: ${e.message}`);
      }
      return;
    }
    history.push({ role: 'assistant', content: text });
  }

  /** 系统提示词指纹：人设 / 生图模型 / 工具开关变了就要重建 session 里的 system 消息 */
  sysKey() {
    return `${this.config.systemPrompt || ''}|${this.config.imageGenModel || ''}|${this.config.toolCalling || ''}`;
  }

  /**
   * 同一 msg_id 的被动回复需要递增 msg_seq（不传默认 1，第二条起会被去重/拒绝）。
   *
   * ⚠ msg_seq 必须跨实例连续：Webhook 模式下每条消息都可能是一个全新的 DO 实例
   * （处理完就休眠、下一次醒来内存全清），如果计数只在内存里，
   * 那条消息的第二次回复会重新从 1 开始，被 QQ 当成重复发送直接拒掉。
   * 所以这里同步写一份到存储，并在新实例里按 msg_id 懒加载。
   */
  nextMsgSeq(msgId) {
    if (!msgId) return 1;
    if (!this.msgSeqMap) this.msgSeqMap = new Map();
    const n = (this.msgSeqMap.get(msgId) || 0) + 1;
    this.msgSeqMap.set(msgId, n);
    // 防胀：只留最近 100 个 msg_id 的计数（被动回复窗口只有几分钟，足够了）
    if (this.msgSeqMap.size > 200) {
      for (const k of this.msgSeqMap.keys()) {
        this.msgSeqMap.delete(k);
        if (this.msgSeqMap.size <= 100) break;
      }
    }
    // 落盘（不 await：sendReply 是热路径，写失败只影响极端场景下的去重，不影响发送）
    try {
      const storage = this.state && this.state.storage;
      if (storage && typeof storage.put === 'function') {
        storage.put(this.msgSeqKey(msgId), n).catch(() => {});
      }
    } catch {}
    return n;
  }

  msgSeqKey(msgId) {
    return `seq:${msgId}`;
  }

  /** 新实例第一次回复某个 msg_id 时，把计数从存储里捞回来 */
  async loadMsgSeq(msgId) {
    if (!msgId) return;
    if (!this.msgSeqMap) this.msgSeqMap = new Map();
    if (this.msgSeqMap.has(msgId)) return;
    try {
      const storage = this.state && this.state.storage;
      if (!storage) return;
      const saved = Number(await storage.get(this.msgSeqKey(msgId))) || 0;
      if (saved > 0) this.msgSeqMap.set(msgId, saved);
    } catch {}
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
          '**🤖 机器人菜单**\n点按钮会把指令填进输入框，再点发送即可。群里只接收 @我 的消息，按钮发出后如果没反应，@我 再发一次就好。',
      },
      keyboard: {
        content: {
          rows: [
            {
              buttons: [
                button('🧭 使用帮助', { data: '/帮助', style: 1 }),
                button('🎨 画一张', { data: '/画 ' }),
              ],
            },
            {
              buttons: [
                button('🗂 我的任务', { data: '/工作 列表' }),
                button('📂 我的文件', { data: '帮我列一下我的文件' }),
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
      // 公网 URL 要等平台把图拉下来（生图常见 2048px / 9MB），30 秒可能不够
      signal: AbortSignal.timeout(body.url ? 60000 : 30000),
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
      let bytes = await this.synthVoice(clean, this.config.voiceLang || 'zh');
      // 音量增益（后台可选关 / +6dB / +9dB）：只改 MP3 global_gain，不重编码
      const gainDb = Math.max(0, Math.min(12, Number(this.config.voiceGain || '6') || 0));
      if (gainDb > 0) {
        try {
          bytes = applyMp3Gain(bytes, gainDb);
        } catch (e) {
          this.logger.warn(`MP3 gain skipped: ${e.message}`);
        }
      }
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
    const fetchImage = async (withReferer) => {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      };
      if (withReferer) headers.Referer = 'https://q.qq.com/';
      return fetch(imageUrl, { headers, signal: AbortSignal.timeout(30000) });
    };
    try {
      let res = await fetchImage(true);
      if (!res.ok) {
        this.logger.warn(`Image fetch failed: HTTP ${res.status}（去掉 Referer 重试一次）`);
        res = await fetchImage(false);
      }
      if (!res.ok) {
        this.logger.warn(`Image fetch failed: HTTP ${res.status}`);
        return null;
      }
      const contentType = res.headers.get('content-type') || '';
      const buf = new Uint8Array(await res.arrayBuffer());
      const size = buf.byteLength;
      // 群里的手机原图可能很大；base64 会再涨 1/3，10MB 以内都收
      if (size < 16 || size > 10 * 1024 * 1024) {
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
    // 生图也在独立的 ToolDO 里执行（没有绑定时走下面的本地实现）
    const toolNs = this.env && (this.env.WORK || this.env.TOOL);
    if (toolNs && typeof toolNs.idFromName === 'function') {
      if (msgId) {
        try {
          await this.sendReply({
            isC2C,
            scopeId,
            content: IMAGE_WAIT_LINES[Math.floor(Math.random() * IMAGE_WAIT_LINES.length)],
            msgId,
          });
        } catch (e) {
          this.logger.warn(`Image wait notice failed: ${e.message}`);
        }
      }
      const out = await this.execToolDo('image', { prompt, caption }, { isC2C, scopeId, msgId, userId });
      if (out) {
        if (out.ok) {
          this.logExchange({
            isC2C,
            scopeId,
            userId,
            userContent: String(userContent || '').trim() || '（生图）',
            aiReply: `[图片] ${String(caption || '（已生成）').slice(0, 200)}`,
            model: `生图 · ${model}`,
          });
        }
        return out;
      }
    }

    this.logger.info(`Image gen: model=${model} prompt=${prompt.slice(0, 40)}...`);
    // 先给个反馈：生图模型普遍要 1~2 分钟，别让用户以为没反应
    if (msgId) {
      try {
        await this.sendReply({
          isC2C,
          scopeId,
          content: IMAGE_WAIT_LINES[Math.floor(Math.random() * IMAGE_WAIT_LINES.length)],
          msgId,
        });
      } catch (e) {
        this.logger.warn(`Image wait notice failed: ${e.message}`);
      }
    }
    try {
      const res = await withRetry(
        async () => {
          const r = await fetch(`${baseUrl}/images/generations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model, prompt, n: 1 }),
            signal: AbortSignal.timeout(150000),
          });
          if (!r.ok) {
            const text = await r.text().catch(() => '');
            const err = new Error(`HTTP ${r.status}${text ? ' ' + text.slice(0, 120) : ''}`);
            err.status = r.status;
            throw err;
          }
          return r;
        },
        {
          maxAttempts: 2,
          delay: 1500,
          // 4xx（模型不存在/参数错）不重试，只重试超时、网络、429、5xx
          shouldRetry: (e) => e.status === undefined || e.status === 429 || e.status >= 500,
          onRetry: (err, attempt) => this.logger.warn(`Image gen retry ${attempt}: ${err.message}`),
        }
      );
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
  /**
   * 判断这条回复该不该按 Markdown 发送。
   *
   * 只认「确实用到了 Markdown 语法」的回复，避免把普通聊天也套 markdown 格式。
   * 表格必须单独识别：`| a | b |` + `|---|---|` 在 QQ 里按纯文本发会露出一堆竖线，
   * 之前漏了这条判据，导致「只有表格没有别的标记」的回复被当成纯文本发出去。
   */
  isMarkdownSafe(text) {
    const s = String(text || '');
    // 表格：至少一行 | a | b |，且存在分隔行 |---|---|
    if (/^\s*\|.*\|\s*$/m.test(s) && /^\s*\|[\s:|-]+\|\s*$/m.test(s)) return true;
    return /(^|\n)\s*#{1,6}\s|\*\*|~~|^\s*[-*]\s|\n\s*>|^>|\[[^\]]+\]\(https?:/m.test(s);
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
    const limit = Number(this.config.historyLimit) || 10;
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

  /**
   * WebSocket 模式的连接自愈周期。
   * 长连接模式下「断线要重连、配额到点要恢复」，本来靠每分钟 cron 兜底；
   * cron 降频到 6 小时后必须由 DO 自己看护，否则一次断线可能几小时没人管。
   */
  static get WS_WATCHDOG_MS() {
    return 60 * 1000;
  }

  /**
   * 把下一次唤醒排到「最近一条待发提醒」的时刻，或 WS 模式下的下次自检。
   *
   * 为什么不用 cron 每分钟轮询：那是每天固定 1,440 次调用，而绝大多数时刻根本没有
   * 待发提醒。改成 alarm 之后，只在实际有活要干时才唤醒，且能精确到秒。
   * 一个 DO 同时只能挂一个 alarm，所以每次都算「最该先做的那件事」，然后覆盖。
   */
  async scheduleNextAlarm() {
    try {
      const now = Date.now();
      let when = null;

      // 1) WS 模式：定期自检连接（断线重连 / 配额到点恢复 / 心跳死了也能发现）
      if (this.isWsTransport() && this.desiredRunning) {
        when = now + QQBotDO.WS_WATCHDOG_MS;
      }

      // 2) 到点的提醒：只有更早才覆盖
      const nextDue = await nextReminderDue(this.env);
      if (nextDue) {
        const at = new Date(nextDue).getTime();
        if (Number.isFinite(at)) {
          // 过去的时刻（例如刚重启、或有积压）立刻唤醒
          const dueAt = Math.max(at, now + 500);
          if (when === null || dueAt < when) when = dueAt;
        }
      }

      if (when === null) return null;
      await this.state.storage.setAlarm(when);
      return when;
    } catch (e) {
      this.logger.warn(`scheduleNextAlarm failed: ${e.message}`);
      return null;
    }
  }

  /**
   * 只在「当前没有 alarm」时补排一个。
   * 构造函数里必须走这个而不是 scheduleNextAlarm()：被 alarm 唤醒时构造函数先跑，
   * 直接 setAlarm 会覆盖掉正要触发的那条，等于把它往后推。
   */
  async ensureAlarmScheduled() {
    try {
      const existing = await this.state.storage.getAlarm();
      if (existing != null) return existing;
      return await this.scheduleNextAlarm();
    } catch (e) {
      this.logger.warn(`ensureAlarmScheduled failed: ${e.message}`);
      return null;
    }
  }

  /**
   * WS 模式自检：由 DO 自己按时唤醒，检查连接是否需要重连。
   * 只在长连接模式下生效；Webhook 模式没有连接要守，什么都不做。
   */
  async wsWatchdog() {
    if (!this.isWsTransport() || !this.desiredRunning) return;
    if (this.fatalStop) return;
    // 配额等待期内不重连，到点后下一轮自然拉起
    if (this.quotaWaitUntil && Date.now() < this.quotaWaitUntil) return;
    if (this.isAlive()) return;
    // 刚启动还在连，给握手留时间
    if (Date.now() - this.lastStartAt < 90000) return;
    this.logger.info('Watchdog: 连接已断，自动重连');
    this.teardown();
    await this.startBot();
  }

  /** alarm 回调：发到点的提醒 + WS 自检，然后把下一次排上 */
  async alarm() {
    try {
      await this.loadConfig().catch(() => {});
      await this.fireDueReminders().catch((e) => this.logger.warn(`alarm reminders: ${e.message}`));
      await this.wsWatchdog().catch((e) => this.logger.warn(`alarm watchdog: ${e.message}`));
    } finally {
      // 无论成功失败都要重排，否则一次失败就再也不唤醒了
      await this.scheduleNextAlarm().catch(() => {});
    }
  }

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

  async runTool(call, { isC2C, scopeId, key, msgId, userId, userContent, useAiDo }) {
    const name = call.name;
    // sandbox 工具：把「写长文 / 做文件 / 多步任务」交给私有工作区执行
    if (name === 'sandbox') {
      const task = String(call.args.task || '').trim();
      if (!task) return this.sendReply({ isC2C, scopeId, content: '要做什么？给我一句任务描述吧～', msgId });
      // 长任务放后台跑，别把整个会话队列（同群其他人的消息）堵住
      const running = this.sandboxRunning || 0;
      if (running >= 2) {
        return this.sendReply({ isC2C, scopeId, content: '前面还有任务在跑，等它完成我再处理这个～', msgId });
      }
      this.sandboxRunning = running + 1;
      try {
        await this.sendReply({
          isC2C,
          scopeId,
          content: '收到，开始处理了～长任务可能要几分钟，完成后把结果（和文件）发你。',
          msgId,
        });
      } catch (e) {
        this.logger.warn(`sandbox ack failed: ${e.message}`);
      }
      const runner = async () => {
        try {
          await this.handleAiSandbox({ isC2C, scopeId, msgId, content: '沙箱 ' + task, userId, background: true });
          // 任务完成后才真正知道「做了什么、产出了哪些文件」，这时再写长期记忆最准。
          // 只记一行摘要，不记文件全文，避免上下文膨胀。
          await this.rememberSandboxFact({ key, task, isC2C, scopeId, userId, useAiDo });
        } catch (e) {
          this.logger.warn(`sandbox background failed: ${e.message}`);
          try {
            await this.sendReply({ isC2C, scopeId, content: `工作区执行失败：${e.message.slice(0, 80)}` });
          } catch {
            /* ignore */
          }
        } finally {
          this.sandboxRunning = Math.max(0, (this.sandboxRunning || 1) - 1);
        }
      };
      if (this.state && typeof this.state.waitUntil === 'function') this.state.waitUntil(runner());
      else await runner();
      return { ok: true };
    }

    // file 工具：从 AiDO 沙箱读文件，再交给 ToolEngine 当附件发出去
    if (name === 'file') {
      const ns = this.env && this.env.AIDO;
      if (!ns || typeof ns.idFromName !== 'function') {
        return this.sendReply({ isC2C, scopeId, content: '沙箱没启用，暂时发不了文件。', msgId });
      }
      const wantPath = String(call.args.path || '').trim();
      if (!wantPath) return this.sendReply({ isC2C, scopeId, content: '要发哪个文件？把路径告诉我。', msgId });
      try {
        const stub = ns.get(ns.idFromName(this.ownerKey({ isC2C, scopeId, userId })));
        const res = await stub.fetch('https://aido/file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: wantPath }),
        });
        const data = await res.json();
        if (!data || data.error) {
          return this.sendReply({ isC2C, scopeId, content: `沙箱里没有「${wantPath}」这个文件～`, msgId });
        }
        const out = await this.execToolDo('file', { path: data.path, content: data.content, name: data.path.split('/').pop() }, {
          isC2C,
          scopeId,
          msgId,
          userId,
        });
        return out;
      } catch (e) {
        this.logger.warn(`file tool failed: ${e.message}`);
        return this.sendReply({ isC2C, scopeId, content: `文件发送失败：${e.message.slice(0, 60)}`, msgId });
      }
    }
    // 工具真正在独立的 ToolDO 里执行（QQBotDO 只管收发）
    const toolNs = this.env && this.env.TOOL;
    if (toolNs && typeof toolNs.idFromName === 'function') {
      try {
        const out = await this.execToolDo(name, call.args || {}, {
          isC2C,
          scopeId,
          msgId,
          caption: call.tail,
          userId,
        });
        if (out) return out;
      } catch (e) {
        this.logger.warn(`ToolDO ${name} failed: ${e.message}`);
      }
    }
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
        await this.scheduleNextAlarm().catch(() => {});
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
