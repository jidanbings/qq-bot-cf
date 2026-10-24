/**
 * 定时提醒的时间解析（北京时间 +08:00）。
 * 支持的说法：
 *   - 「10 分钟后提醒我喝水」「半小时后叫我开会」
 *   - 「今天 18:30 提醒我下班」「明天 8:00 提醒我开会」「后天提醒我体检」+ 点
 *   - 「每天 8:00 提醒我背单词」「每周一 9:00 提醒我周会」
 * 解析结果：{ dueAt: ISO, text: 提醒内容, repeatRule: 'daily'|'weekly:N'|null, whenText }
 */

const TRIGGER = /(?:提醒我一下|提醒一下我|提醒一下|提醒我|叫我一下|叫我|记得提醒我|记得提醒)/;
const TZ_MS = 8 * 3600 * 1000;

const CN_NUM = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

function toInt(s) {
  const v = String(s || '').trim();
  if (/^\d+$/.test(v)) return Number(v);
  if (v === '半') return 30;
  if (CN_NUM[v] !== undefined) return CN_NUM[v];
  const m = /^([一二三四五六七八九])?十([一二三四五六七八九])?$/.exec(v);
  if (m) return (m[1] ? CN_NUM[m[1]] : 1) * 10 + (m[2] ? CN_NUM[m[2]] : 0);
  return NaN;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function bjNow(nowMs) {
  const d = new Date(nowMs + TZ_MS);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes() };
}

/** 北京时间某年月日时分 → UTC 毫秒（Date.UTC 负责处理跨天溢出） */
function bjInstant(y, mo, d, h, mi) {
  return Date.UTC(y, mo - 1, d, h, mi) - TZ_MS;
}

function dayInstant(h, mi, nowMs, offsetDays) {
  const n = bjNow(nowMs);
  return bjInstant(n.y, n.mo, n.d + offsetDays, h, mi);
}

const WEEKDAY_CN = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 };
const WEEKDAY_NAME = ['', '一', '二', '三', '四', '五', '六', '日'];

function bjWeekday(nowMs) {
  // getUTCDay: 0=周日 … 6=周六 → 转 ISO 1..7
  return ((new Date(nowMs + TZ_MS).getUTCDay() + 6) % 7) + 1;
}

function nextClock(h, mi, nowMs) {
  let t = dayInstant(h, mi, nowMs, 0);
  if (t <= nowMs) t = dayInstant(h, mi, nowMs, 1);
  return t;
}

function nextWeekday(wd, h, mi, nowMs) {
  const cur = bjWeekday(nowMs);
  let ahead = (wd - cur + 7) % 7;
  let t = dayInstant(h, mi, nowMs, ahead);
  if (t <= nowMs) t = dayInstant(h, mi, nowMs, ahead + 7);
  return t;
}

function clean(s, phrase) {
  return s
    .replace(phrase, '')
    .replace(TRIGGER, '')
    .replace(/^(?:帮我|给我|请|麻烦|记得|到时候)\s*/, '')
    .replace(/^[，,。:：；;\s]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function valid(h, mi) {
  return Number.isInteger(h) && h >= 0 && h < 24 && Number.isInteger(mi) && mi >= 0 && mi < 60;
}

export function parseReminder(content, nowMs = Date.now()) {
  const s = String(content || '').replace(/\s+/g, ' ').trim();
  if (!s || !TRIGGER.test(s)) return null;

  // 1) 相对时间：N 分钟/小时/秒后（「半小时后」= 30 分钟）
  const rel = /([0-9]+|[一二两三四五六七八九十半]+)\s*(秒钟|秒|分钟|分|小时|个小时)\s*后/.exec(s);
  if (rel) {
    const half = rel[1] === '半';
    const n = half ? 30 : toInt(rel[1]);
    if (Number.isFinite(n) && n > 0) {
      const unit = half ? 60000 : rel[2].includes('秒') ? 1000 : rel[2].includes('小时') ? 3600000 : 60000;
      const text = clean(s, rel[0]);
      if (text) {
        return {
          dueAt: new Date(nowMs + n * unit).toISOString(),
          text,
          repeatRule: null,
          whenText: half ? '半小时后' : `${n}${rel[2]}后`,
        };
      }
    }
  }

  // 2) 每天 hh:mm
  const daily = /每天\s*([0-9]{1,2}|[一二两三四五六七八九十]{1,2})\s*[:：点时]\s*([0-9]{1,2}|[一二三四五六七八九十]{1,2})?\s*分?/.exec(s);
  if (daily) {
    const h = toInt(daily[1]);
    const mi = daily[2] ? toInt(daily[2]) : 0;
    if (valid(h, mi)) {
      const text = clean(s, daily[0]);
      if (text) {
        return {
          dueAt: new Date(nextClock(h, mi, nowMs)).toISOString(),
          text,
          repeatRule: 'daily',
          whenText: `每天 ${pad(h)}:${pad(mi)}`,
        };
      }
    }
  }

  // 3) 每周X hh:mm
  const weekly = /每(?:周|星期)([一二三四五六日天])\s*([0-9]{1,2}|[一二两三四五六七八九十]{1,2})\s*[:：点时]\s*([0-9]{1,2}|[一二三四五六七八九十]{1,2})?\s*分?/.exec(s);
  if (weekly) {
    const wd = WEEKDAY_CN[weekly[1]];
    const h = toInt(weekly[2]);
    const mi = weekly[3] ? toInt(weekly[3]) : 0;
    if (wd && valid(h, mi)) {
      const text = clean(s, weekly[0]);
      if (text) {
        return {
          dueAt: new Date(nextWeekday(wd, h, mi, nowMs)).toISOString(),
          text,
          repeatRule: `weekly:${wd}`,
          whenText: `每周${WEEKDAY_NAME[wd]} ${pad(h)}:${pad(mi)}`,
        };
      }
    }
  }

  // 4) 今天/明天/后天 + hh:mm（不写日期时：过点就顺延到明天）
  const abs = /(今天|今晚|今早|明天|明早|明晚|后天)?\s*([0-9]{1,2}|[一二两三四五六七八九十]{1,2})\s*[:：点时]\s*([0-9]{1,2}|[一二三四五六七八九十]{1,2})?\s*分?/.exec(s);
  if (abs) {
    const dayWord = abs[1] || '';
    const h = toInt(abs[2]);
    const mi = abs[3] ? toInt(abs[3]) : 0;
    if (valid(h, mi)) {
      const text = clean(s, abs[0]);
      if (text) {
        const off = /后天/.test(dayWord) ? 2 : /明天|明早|明晚/.test(dayWord) ? 1 : 0;
        let due = dayInstant(h, mi, nowMs, off);
        if (!dayWord && due <= nowMs) due = dayInstant(h, mi, nowMs, 1);
        return {
          dueAt: new Date(due).toISOString(),
          text,
          repeatRule: null,
          whenText: `${dayWord}${pad(h)}:${pad(mi)}`,
        };
      }
    }
  }

  return null;
}

/** 重复任务：算出下一次到期时间（错过多次会自动追上） */
export function nextDueFrom(repeatRule, dueIso, nowMs = Date.now()) {
  const due = new Date(dueIso).getTime();
  if (!Number.isFinite(due)) return null;
  const rule = String(repeatRule || '');
  let step = 0;
  if (rule === 'daily') step = 86400000;
  else if (/^weekly:[1-7]$/.test(rule)) step = 7 * 86400000;
  if (!step) return null;
  let next = due;
  let guard = 0;
  while (next <= nowMs && guard++ < 1000) next += step;
  return new Date(next).toISOString();
}
