/**
 * MP3 音量增益（不改内容、不重编码）：
 * 直接修改每一帧 side info 里的 global_gain 字段。解码公式里
 *   amplitude ∝ 2^((global_gain - 210) / 4)
 * 所以 global_gain 每 -1 约 +1.5dB。只处理 Layer III（MeloTTS 输出就是 Layer III）。
 * 参考 mp3gain 的做法；参数/结构见 ISO 11172-3 与 ISO 13818-3。
 */

const V1_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const V2_BITRATES = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const SAMPLE_RATES = {
  3: [44100, 48000, 32000], // MPEG1
  2: [22050, 24000, 16000], // MPEG2
  0: [11025, 12000, 8000], // MPEG2.5
};

function readBits(buf, pos, len) {
  let v = 0;
  for (let i = 0; i < len; i++) {
    const p = pos + i;
    const byte = buf[p >> 3];
    const bit = (byte >> (7 - (p & 7))) & 1;
    v = (v << 1) | bit;
  }
  return v;
}

function writeBits(buf, pos, len, val) {
  for (let i = 0; i < len; i++) {
    const p = pos + i;
    const bit = (val >> (len - 1 - i)) & 1;
    const idx = p >> 3;
    const mask = 1 << (7 - (p & 7));
    buf[idx] = bit ? buf[idx] | mask : buf[idx] & ~mask;
  }
}

/** MP3 CRC16（poly 0x8005，init 0xFFFF，MSB first），覆盖 header 末两字节 + side info */
function crc16(bytes, start, len) {
  let crc = 0xffff;
  for (let k = 0; k < len; k++) {
    crc ^= bytes[start + k] << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x8005) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

/** 改动 side info 后同步更新 CRC 字段（header 后 2 字节） */
function updateCrc(out, start, sideStart, sideLen) {
  const buf = new Uint8Array(2 + sideLen);
  buf[0] = out[start + 2];
  buf[1] = out[start + 3];
  buf.set(out.subarray(sideStart, sideStart + sideLen), 2);
  const c = crc16(buf, 0, buf.length);
  out[start + 4] = (c >> 8) & 0xff;
  out[start + 5] = c & 0xff;
}

/** 解析一帧的头部信息；不是合法 Layer III 帧就返回 null */
function frameInfo(buf, i) {
  if (i + 4 > buf.length) return null;
  if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) return null;
  const h = (buf[i] << 24) | (buf[i + 1] << 16) | (buf[i + 2] << 8) | buf[i + 3];
  const version = (h >>> 19) & 3; // 3=MPEG1, 2=MPEG2, 0=MPEG2.5
  const layer = (h >>> 17) & 3;
  const protection = (h >>> 16) & 1;
  const bitrateIdx = (h >>> 12) & 0xf;
  const srIdx = (h >>> 10) & 3;
  const padding = (h >>> 9) & 1;
  const mode = (h >>> 6) & 3;
  if (layer !== 1 || version === 1 || bitrateIdx === 0 || bitrateIdx === 15 || srIdx === 3) return null;
  const isV1 = version === 3;
  const bitrate = (isV1 ? V1_BITRATES : V2_BITRATES)[bitrateIdx] * 1000;
  const sr = SAMPLE_RATES[version][srIdx];
  const length = Math.floor(((isV1 ? 144 : 72) * bitrate) / sr) + padding;
  if (length < 8) return null;
  return {
    version,
    isV1,
    mono: mode === 3,
    length,
    start: i,
    // protection=0 表示带 CRC：改 side info 后需要重算 CRC（见 updateCrc）
    protectedCrc: protection === 0,
    sideStart: i + 4 + (protection ? 0 : 2),
  };
}

/** 遍历 side info，按 delta（负数=更响）修改每块 global_gain；返回修改的字段数 */
function adjustSideInfo(out, sideStart, isV1, mono, delta) {
  let bit = sideStart * 8;
  const skip = (n) => {
    bit += n;
  };
  skip(isV1 ? 9 : 8); // main_data_begin
  skip(mono ? (isV1 ? 5 : 1) : isV1 ? 3 : 2); // private_bits
  if (isV1) skip(4 * (mono ? 1 : 2)); // scfsi
  const granules = isV1 ? 2 : 1;
  const chans = mono ? 1 : 2;
  let count = 0;
  for (let gr = 0; gr < granules; gr++) {
    for (let ch = 0; ch < chans; ch++) {
      skip(12); // part2_3_length
      skip(9); // big_values
      const ggPos = bit;
      const gg = readBits(out, ggPos, 8);
      const next = Math.max(0, Math.min(255, gg + delta));
      writeBits(out, ggPos, 8, next);
      count++;
      skip(8); // global_gain
      skip(isV1 ? 4 : 9); // scalefac_compress
      const wsf = readBits(out, bit, 1);
      skip(1); // window_switching_flag
      if (wsf) skip(2 + 1 + 10 + 9); // block_type, mixed_block_flag, table_select[2], subblock_gain[3]
      else skip(15 + 4 + 3); // table_select[3], region0_count, region1_count
      skip(1 + 1); // scalefac_scale, count1table_select
    }
  }
  return count;
}

/**
 * 提升 MP3 响度：gainDb 为正数（例如 6 / 9）。返回新数组（失败时原样返回）。
 * 内部按 1.5dB 一档换算成 global_gain 的步数（负步数=更响）。
 */
export function applyMp3Gain(bytes, gainDb) {
  const steps = Math.round(Number(gainDb) / 1.5);
  if (!steps) return bytes;
  const out = new Uint8Array(bytes);
  let i = 0;
  let frames = 0;
  let fields = 0;
  while (i + 4 <= out.length) {
    const info = frameInfo(out, i);
    if (!info) {
      i++;
      continue;
    }
    const sideLen = info.isV1 ? (info.mono ? 17 : 32) : info.mono ? 9 : 17;
    if (info.sideStart + sideLen <= out.length) {
      // global_gain 越小越响：增益正数 → 减去步数
      fields += adjustSideInfo(out, info.sideStart, info.isV1, info.mono, -steps);
      if (info.protectedCrc) updateCrc(out, info.start, info.sideStart, sideLen);
      frames++;
    }
    i += info.length;
  }
  return frames ? out : bytes;
}

export const mp3GainInfo = { V1_BITRATES, V2_BITRATES, SAMPLE_RATES };

/** 扫描所有合法帧（测试/调试用），返回每帧位置与 side info 信息 */
export function scanMp3Frames(bytes) {
  const frames = [];
  let i = 0;
  while (i + 4 <= bytes.length) {
    const info = frameInfo(bytes, i);
    if (!info) {
      i++;
      continue;
    }
    frames.push({ start: i, ...info });
    i += info.length;
  }
  return frames;
}
