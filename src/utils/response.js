
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), microphone=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Cache-Control': 'no-store',
};

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'HttpError';
  }
}

export function jsonResult(data, status = 200, extraHeaders = {}) {
  return Response.json(
    { ok: true, data },
    { status, headers: { ...SECURITY_HEADERS, ...extraHeaders } }
  );
}

export function jsonFail(status, code, message, extraHeaders = {}) {
  return Response.json(
    { ok: false, error: { code, message } },
    { status, headers: { ...SECURITY_HEADERS, ...extraHeaders } }
  );
}

export function htmlResponse(body, nonce) {
  return new Response(body, {
    status: 200,
    headers: {
      ...SECURITY_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy':
        `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; ` +
        `connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
    },
  });
}

export function redirect(location) {
  return new Response(null, {
    status: 302,
    headers: { ...SECURITY_HEADERS, Location: location }
  });
}

export function rateLimitHeaders(result) {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'Retry-After': String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))),
  };
}
