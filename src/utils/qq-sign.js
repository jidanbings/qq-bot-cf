
const SEED_SIZE = 32;

const PKCS8_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

export function deriveSeed(secret) {
  let seed = String(secret || '');
  if (!seed) throw new Error('缺少 Bot Secret');
  while (seed.length < SEED_SIZE) seed = seed + seed;
  return new TextEncoder().encode(seed.slice(0, SEED_SIZE));
}

function seedToPkcs8(seed) {
  const der = new Uint8Array(PKCS8_PREFIX.length + seed.length);
  der.set(PKCS8_PREFIX, 0);
  der.set(seed, PKCS8_PREFIX.length);
  return der;
}

async function derivePrivateKey(secret) {
  const seed = deriveSeed(secret);
  return crypto.subtle.importKey('pkcs8', seedToPkcs8(seed), { name: 'Ed25519' }, true, ['sign']);
}

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

export async function verifyWebhookSignature({ secret, signature, timestamp, body }) {
  if (!secret || !signature || !timestamp || !body) return false;
  const sig = hexToBytes(signature);
  if (!sig || sig.length !== 64) return false;
  try {
    const key = await derivePublicKey(secret);
    const prefix = new TextEncoder().encode(String(timestamp));
    const msg = new Uint8Array(prefix.length + body.length);
    msg.set(prefix, 0);
    msg.set(body, prefix.length);
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, sig, msg);
  } catch {
    return false;
  }
}

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
