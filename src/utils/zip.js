/**
 * 极简 ZIP 打包（stored，不压缩）：纯 JS，无依赖。
 * 只支持 UTF-8 文本文件，够沙箱用。
 */

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(n) {
  return [n & 0xff, (n >>> 8) & 0xff];
}

function u32(n) {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}

function dosDateTime(d = new Date()) {
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() / 2) & 0x1f);
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
  return { time, date };
}

/**
 * @param {{path: string, content: string}[]} entries
 * @returns {Uint8Array}
 */
export function buildZip(entries) {
  const enc = new TextEncoder();
  const { time, date } = dosDateTime();
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const e of entries) {
    const name = enc.encode(e.path);
    const data = enc.encode(e.content);
    const crc = crc32(data);

    const local = [
      0x50, 0x4b, 0x03, 0x04, // signature
      ...u16(20), // version needed
      ...u16(0x0800), // UTF-8 flag
      ...u16(0), // stored
      ...u16(time),
      ...u16(date),
      ...u32(crc),
      ...u32(data.length),
      ...u32(data.length),
      ...u16(name.length),
      ...u16(0), // extra
    ];
    const localBytes = new Uint8Array(local.length + name.length + data.length);
    localBytes.set(local, 0);
    localBytes.set(name, local.length);
    localBytes.set(data, local.length + name.length);
    locals.push(localBytes);

    const central = [
      0x50, 0x4b, 0x01, 0x02,
      ...u16(20),
      ...u16(20),
      ...u16(0x0800),
      ...u16(0),
      ...u16(time),
      ...u16(date),
      ...u32(crc),
      ...u32(data.length),
      ...u32(data.length),
      ...u16(name.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(offset),
    ];
    const centralBytes = new Uint8Array(central.length + name.length);
    centralBytes.set(central, 0);
    centralBytes.set(name, central.length);
    centrals.push(centralBytes);

    offset += localBytes.length;
  }

  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const eocd = [
    0x50, 0x4b, 0x05, 0x06,
    ...u16(0),
    ...u16(0),
    ...u16(entries.length),
    ...u16(entries.length),
    ...u32(centralSize),
    ...u32(offset),
    ...u16(0),
  ];

  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const b of locals) {
    out.set(b, p);
    p += b.length;
  }
  for (const b of centrals) {
    out.set(b, p);
    p += b.length;
  }
  out.set(eocd, p);
  return out;
}
