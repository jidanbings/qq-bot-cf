export const COOKIE_NAME = 'bot_session';

export const APP_VERSION = '3.9.4';

export const LOGIN_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };
export const API_LIMIT = { limit: 120, windowMs: 60 * 1000 };

export const QQ_BASE = 'https://api.bot.qq.com';

export const QQ_SANDBOX_BASE = 'https://sandbox.api.sgroup.qq.com';
export const INTENT_GROUP_AND_C2C = (1 << 25);
export const INTENT_GROUP_MEMBER = (1 << 24);
export const INTENT_ALL_GROUP_AND_C2C = INTENT_GROUP_AND_C2C | INTENT_GROUP_MEMBER;

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const CHAT_LOG_MAX_ROWS = 2000;

export const QQ_OPCODE = {
  DISPATCH: 0,
  HEARTBEAT: 1,
  IDENTIFY: 2,
  RESUME: 6,
  RECONNECT: 7,
  INVALID_SESSION: 9,
  HELLO: 10,
  HEARTBEAT_ACK: 11,
  HTTP_CALLBACK_ACK: 12,
  CALLBACK_VALIDATION: 13,
};

export const WS_CLOSE_REASON = {
  4001: '无效的 opcode',
  4002: '无效的 payload',
  4006: '无效的 session id，需重新 identify',
  4007: 'seq 错误',
  4008: '发送 payload 过快，被限流',
  4009: '连接过期，需 resume 重连',
  4010: '无效的 shard',
  4011: '需处理的 guild 过多',
  4012: '无效的 version',
  4013: '无效的 intent',
  4014: 'intent 无权限（该事件未申请/未开通）',
  4914: '机器人已下架，只允许连接沙箱环境',
  4915: '机器人已封禁',
};

export const WS_FATAL_CLOSE = new Set([4001, 4002, 4010, 4011, 4012, 4013, 4014, 4914, 4915]);
