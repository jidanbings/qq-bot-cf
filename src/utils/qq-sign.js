/**
 * QQ 机器人开放平台 Webhook 签名校验（Ed25519）
 *
 * 官方算法（https://bot.q.qq.com/wiki/develop/api-v2/dev-prepare/interface-framework/sign.html）：
 *   1. 把 Bot Secret 用 repeat 补齐到 32 字节，作为 Ed25519 的 seed
 *   2. 由 seed 派生 KeyPair：私钥用于「回调地址验证」(op=13) 的签名，公钥用于校验事件推送
 *   3. 事件推送校验：msg = X-Signature-Timestamp + HTTP Body（原始字节），验 X-Signature-Ed25519（hex）
 *
 * 两个实现坑（都已踩过）：
 *   - Secret 不足 32 字节时要**反复整串重复**再截断，不是补零：
 *     secret="naOC0ocQE3shWLAfffVLB1rhYPG7" 的 seed 是 "naOC0ocQE3shWLAfffVLB1rhYPG7naOC"。
 *   - Ed25519 的 32 字节 seed 不能用 importKey('raw') 导入（会抛
 *     "Unsupported key usage for Ed25519 key"），必须包成 PKCS#8 DER 再导入。
 */

const SEED_SIZE = 32;

// PKCS#8 头：SEQUENCE { INTEGER 0, SEQUENCE { OID 1.3.101.112 }, OCTET STRING(32) }
const PKCS8_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

/** 把 secret 用「整串重复 + 截断」补齐成 32 字节 seed */
export function deriveSeed(secret) {
  let seed = String(secret || '');
  if (!seed) throw new Error('缺少 Bot Secret');
  // 与官方 Go 示例保持一致：seed = strings.Repeat(seed, 2) 直到长度足够
  while (seed.length < SEED_SIZE) seed = seed + seed;
  return new TextEncoder().encode(seed.slice(0, SEED_SIZE));
}

/** seed → PKCS#8 DER */
function seedToPkcs8(seed) {
  const der = new Uint8Array(PKCS8_PREFIX.length + seed.length);
  der.set(PKCS8_PREFIX, 0);
  der.set(seed, PKCS8_PREFIX.length);
  return der;
}

/** 由 secret 派生 Ed25519 私钥（可签名，也用于导出公钥） */
async function derivePrivateKey(secret) {
  const seed = deriveSeed(secret);
  return crypto.subtle.importKey('pkcs8', seedToPkcs8(seed), { name: 'Ed25519' }, true, ['sign']);
}

/**
 * 由 secret 派生 Ed25519 公钥（校验事件推送用）
 * Ed25519 私钥的 JWK 里同时带 x（公钥），据此建 verify 用的 key。
 */
export async function derivePublicKey(secret) {
  const priv = await derivePrivateKey(secret);
  const jwk = await crypto.subtle.exportKey('jwk', priv);
  if (!jwk || !jwk.x) throw new Error('无法从 Secret 派生公钥');
  return crypto.subtle.importKey(
    'jwk',
    { kty: 'OKP', crv: 'Ed25519', x: jwk.x },
    { name: 'Ed25519' },
    false,
    ['verify']
  );
}

const hexToBytes = (hex) => {
  const s = String(hex || '').trim().toLowerCase();
  if (!s || s.length % 2 !== 0 || /[^0-9a-f]/.test(s)) return null;
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
};

const bytesToHex = (bytes) => {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
};

/**
 * 校验事件推送签名
 * @param {object} p
 * @param {string} p.secret      Bot Secret
 * @param {string} p.signature   请求头 X-Signature-Ed25519（hex）
 * @param {string} p.timestamp   请求头 X-Signature-Timestamp
 * @param {Uint8Array} p.body    请求体原始字节
 * @returns {Promise<boolean>}
 */
export async function verifyWebhookSignature({ secret, signature, timestamp, body }) {
  if (!secret || !signature || !timestamp || !body) return false;
  const sig = hexToBytes(signature);
  if (!sig || sig.length !== 64) return false;
  try {
    const key = await derivePublicKey(secret);
    // 签名体 = timestamp + body，按字节拼接；body 不能先转字符串（会破坏编码）
    const prefix = new TextEncoder().encode(String(timestamp));
    const msg = new Uint8Array(prefix.length + body.length);
    msg.set(prefix, 0);
    msg.set(body, prefix.length);
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, sig, msg);
  } catch {
    return false;
  }
}

/**
 * 「回调地址验证」（op=13）的签名：msg = event_ts + plain_token，用私钥签名
 * @returns {Promise<string>} hex 签名
 */
export async function signValidation(secret, eventTs, plainToken) {
  const key = await derivePrivateKey(secret);
  const ts = new TextEncoder().encode(String(eventTs || ''));
  const pt = new TextEncoder().encode(String(plainToken || ''));
  const msg = new Uint8Array(ts.length + pt.length);
  msg.set(ts, 0);
  msg.set(pt, ts.length);
  const sig = await crypto.subtle.sign({ name: 'Ed25519' }, key, msg);
  return bytesToHex(new Uint8Array(sig));
}

export { bytesToHex, hexToBytes };
