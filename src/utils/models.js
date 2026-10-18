import { HttpError } from './response.js';

const MAX_MODELS = 500;
const MAX_ID_LENGTH = 128;

export async function fetchModelList(baseUrl, apiKey) {
  let res;
  try {
    res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    const timedOut = err && (err.name === 'TimeoutError' || err.name === 'AbortError');
    throw new HttpError(
      502,
      'models_unreachable',
      timedOut ? '拉取模型列表超时' : '无法连接到 AI 接口，请检查 Base URL'
    );
  }

  if (!res.ok) {
    await res.body?.cancel();
    
    if (res.status === 401 || res.status === 403) {
      throw new HttpError(400, 'models_unauthorized', 'API Key 无效或没有权限');
    }
    throw new HttpError(502, 'models_failed', `AI 接口返回 HTTP ${res.status}`);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new HttpError(502, 'models_bad_format', 'AI 接口返回的不是 JSON，请确认 Base URL 是 OpenAI 兼容地址');
  }

  const list = Array.isArray(data) ? data : data?.data;
  if (!Array.isArray(list)) {
    throw new HttpError(502, 'models_bad_format', 'AI 接口返回的不是模型列表，请确认 Base URL 是 OpenAI 兼容地址');
  }

  const ids = new Set();
  for (const item of list) {
    const id = typeof item === 'string' ? item : item?.id;
    if (typeof id === 'string' && id && id.length <= MAX_ID_LENGTH) ids.add(id);
  }
  if (!ids.size) throw new HttpError(502, 'models_empty', 'AI 接口没有返回可用模型');

  return [...ids].sort().slice(0, MAX_MODELS);
}
