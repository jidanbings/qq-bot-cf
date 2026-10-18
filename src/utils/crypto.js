
const PREFIX = 'enc:v1:';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(text) {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importKey(env) {
  if (!env.CONFIG_ENC_KEY) throw new Error('未配置 CONFIG_ENC_KEY，无法加解密敏感配置');
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(env.CONFIG_ENC_KEY));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export async function maskId(value) {
  const text = String(value ?? '');
  if (!text) return '';
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`qqbot-mask:v1:${text}`));
  return [...new Uint8Array(digest).slice(0, 4)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function keyFingerprint(env) {
  if (!env.CONFIG_ENC_KEY) return '';
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(`qqbot-key-check:v1:${env.CONFIG_ENC_KEY}`)
  );
  return [...new Uint8Array(digest).slice(0, 8)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function encryptText(env, plaintext, aad) {
  const key = await importKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(aad) },
    key,
    encoder.encode(plaintext)
  );
  return `${PREFIX}${toBase64(iv)}:${toBase64(new Uint8Array(cipher))}`;
}

export async function decryptText(env, stored, aad) {
  if (!isEncrypted(stored)) return stored;
  
  let key;
  try {
    key = await importKey(env);
  } catch {
    throw new Error(`无法解密 ${aad}：没有可用的 CONFIG_ENC_KEY`);
  }
  try {
    const [ivPart, dataPart] = stored.slice(PREFIX.length).split(':');
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(ivPart), additionalData: encoder.encode(aad) },
      key,
      fromBase64(dataPart)
    );
    return decoder.decode(plain);
  } catch {
    throw new Error(`无法解密 ${aad}：CONFIG_ENC_KEY 不正确或数据已损坏`);
  }
}
