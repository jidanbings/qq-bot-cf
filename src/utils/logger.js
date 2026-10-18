
import { redact } from './redact.js';

const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

function stamp(ms) {
  const d = new Date(ms + TZ_OFFSET_MS);
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` +
    ` ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
  );
}

export class Logger {
  constructor(prefix = '', maxLogs = 50) {
    this.prefix = prefix;
    this.maxLogs = maxLogs;
    this.logs = [];
  }

  log(msg, level = 'info') {
    const ms = Date.now();
    const text = redact(`${this.prefix ? `[${this.prefix}] ` : ''}${msg}`);

    console.log(`[${new Date(ms).toISOString()}] [${level.toUpperCase()}] ${text}`);

    this.logs.push({ at: ms, time: stamp(ms), level: level.toLowerCase(), text });
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  info(msg) {
    this.log(msg, 'info');
  }

  warn(msg) {
    this.log(msg, 'warn');
  }

  error(msg) {
    this.log(msg, 'error');
  }

  getLogs(limit = 30) {
    return this.logs.slice(-limit).map((item) => ({ ...item }));
  }
}
