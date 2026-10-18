
import { HttpError } from './response.js';

export function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}

export function sessionCookie(id, maxAge) {
  return `bot_session=${id}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `bot_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export const RECOVERY_COOKIE = 'bot_recovery';
export const RECOVERY_TTL_MS = 60 * 60 * 1000;

function toHex(bytes) {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

async function signRecovery(env, ts) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.ADMIN_TOKEN || ''),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`qqbot-recover:v1:${ts}`)
  );
  return toHex(new Uint8Array(sig));
}

export async function makeRecoveryToken(env) {
  const ts = Date.now();
  return `${ts}.${await signRecovery(env, ts)}`;
}

export async function checkRecoveryToken(env, value) {
  if (!env.ADMIN_TOKEN || !value) return false;
  const idx = value.indexOf('.');
  if (idx <= 0) return false;
  const ts = Number(value.slice(0, idx));
  if (!Number.isFinite(ts)) return false;
  const age = Date.now() - ts;
  if (age < 0 || age > RECOVERY_TTL_MS) return false;
  return safeEqual(await signRecovery(env, ts), value.slice(idx + 1));
}

export function recoveryCookie(value, maxAgeSeconds) {
  return `${RECOVERY_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSeconds}`;
}

export function clearRecoveryCookie() {
  return `${RECOVERY_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

export function assertSameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return;
  let host;
  try {
    host = new URL(origin).host;
  } catch {
    throw new HttpError(403, 'forbidden', '非法的 Origin');
  }
  if (host !== new URL(request.url).host) {
    throw new HttpError(403, 'forbidden', '拒绝跨站请求');
  }
}

export async function readJson(request, maxBytes = 64 * 1024) {
  const text = await request.text();
  if (text.length > maxBytes) {
    throw new HttpError(413, 'payload_too_large', '请求体过大');
  }
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new HttpError(400, 'invalid_json', '请求体不是合法 JSON');
  }
}
