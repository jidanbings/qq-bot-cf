const RULES = [
  [/sk-[A-Za-z0-9_-]{6,}/g, 'sk-***'],
  [/(Bearer|QQBot)\s+[A-Za-z0-9._~+/=-]{6,}/gi, '$1 ***'],
  [/("(?:client_secret|clientSecret|secret|apiKey|api_key|access_token|token)"\s*:\s*")[^"]*(")/gi, '$1***$2'],
  [/[A-Fa-f0-9]{32,}/g, '***'],
];

export function redact(value) {
  let text = String(value ?? '');
  for (const [re, sub] of RULES) text = text.replace(re, sub);
  return text;
}
