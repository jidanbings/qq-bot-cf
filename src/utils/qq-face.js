const FACE_TAG_RE = /<faceType=[^>]*>/g;

function decodeFaceExt(tag) {
  try {
    const m = /ext="([^"]*)"/.exec(tag);
    if (!m || !m[1]) return '';
    const bin = atob(m[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const obj = JSON.parse(new TextDecoder('utf-8').decode(bytes));
    const text = obj && typeof obj.text === 'string' ? obj.text.trim() : '';
    return text ? text.slice(0, 16) : '';
  } catch {
    return '';
  }
}

function decodeFaceId(tag) {
  const m = /faceId="?(\d+)"?/i.exec(tag);
  return m ? m[1] : '';
}

export function faceTagLabel(tag) {
  const name = decodeFaceExt(tag);
  if (name) return `[表情：${name}]`;
  const id = decodeFaceId(tag);
  return id ? `[表情 #${id}]` : '[表情]';
}

export function normalizeFaceTags(text) {
  return String(text ?? '').replace(FACE_TAG_RE, (m) => faceTagLabel(m));
}
