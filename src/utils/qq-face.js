
const FACE_TAG_RE = /<faceType=[^>]*>/g;

function decodeFaceName(tag) {
  try {
    const m = /ext="([^"]*)"/.exec(tag);
    if (!m || !m[1]) return '';
    const bin = atob(m[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const obj = JSON.parse(new TextDecoder('utf-8').decode(bytes));
    const text = obj && typeof obj.text === 'string' ? obj.text.trim() : '';
    return text ? text.slice(0, 12) : '';
  } catch {
    return '';
  }
}

export function faceTagLabel(tag) {
  const name = decodeFaceName(tag);
  return name ? `[表情：${name}]` : '[表情]';
}

export function normalizeFaceTags(text) {
  return String(text ?? '').replace(FACE_TAG_RE, (m) => faceTagLabel(m));
}
