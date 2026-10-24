/**
 * QQ 消息元素处理：官方把表情作为内联元素下发，例如
 *   <faceType=1,faceId="349",ext="eyJ0ZXh0Ijoi5Z2a5by6In0=">
 * faceType=1 表示表情；faceId 是表情编号；ext 是 base64 的 UTF-8 JSON（如 {"text":"坚强"}）。
 * 这里把它转成可读文字（[表情：坚强]），避免原始标签进 AI 上下文和聊天记录。
 */

const FACE_TAG_RE = /<faceType=[^>]*>/g;

function decodeFaceName(tag) {
  try {
    const m = /ext="([^"]*)"/.exec(tag);
    if (!m || !m[1]) return '';
    // ext 是 base64 的 UTF-8 JSON，先按 UTF-8 解码再 parse
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

/** 把单个表情标签转成可读标签 */
export function faceTagLabel(tag) {
  const name = decodeFaceName(tag);
  return name ? `[表情：${name}]` : '[表情]';
}

/** 把文本里的所有 QQ 表情元素转成可读文字 */
export function normalizeFaceTags(text) {
  return String(text ?? '').replace(FACE_TAG_RE, (m) => faceTagLabel(m));
}
