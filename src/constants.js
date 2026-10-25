export const COOKIE_NAME = 'bot_session';

export const APP_VERSION = '3.6.8.2';

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
};

export const WS_CLOSE_REASON = {
  4001: '鏃犳晥鐨?opcode',
  4002: '鏃犳晥鐨?payload',
  4006: '鏃犳晥鐨?session id锛岄渶閲嶆柊 identify',
  4007: 'seq 閿欒',
  4008: '鍙戦€?payload 杩囧揩锛岃闄愭祦',
  4009: '杩炴帴杩囨湡锛岄渶 resume 閲嶈繛',
  4010: '鏃犳晥鐨?shard',
  4011: '闇€澶勭悊鐨?guild 杩囧',
  4012: '鏃犳晥鐨?version',
  4013: '鏃犳晥鐨?intent',
  4014: 'intent 鏃犳潈闄愶紙璇ヤ簨浠舵湭鐢宠/鏈紑閫氾級',
  4914: '鏈哄櫒浜哄凡涓嬫灦锛屽彧鍏佽杩炴帴娌欑鐜',
  4915: '鏈哄櫒浜哄凡灏佺',
};

export const WS_FATAL_CLOSE = new Set([4001, 4002, 4010, 4011, 4012, 4013, 4014, 4914, 4915]);
