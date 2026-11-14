// Cloudflare Workers AI helpers.
// Unlike external OpenAI-compatible endpoints (which we call over fetch),
// built-in CF models run through the env.AI binding. env.AI.run() resolves to
// the same object the REST API puts under `result`:
//   - chat  (qwen3):  { choices: [{ message: { content, reasoning } }], response }
//   - image (flux):   { image: "<base64 jpeg>" }
//   - tts   (melotts):{ audio: "<base64 wav>" }

export const CF_MODELS = {
  chat: '@cf/qwen/qwen3-30b-a3b-fp8',
  image: '@cf/black-forest-labs/flux-1-schnell',
  voice: '@cf/myshell-ai/melotts',
};

// qwen3 is a reasoning model: it spends tokens on `reasoning` before writing
// `content`. Too small a budget leaves content null with finish_reason=length.
const CHAT_MAX_TOKENS = 2048;

export function cfChatProvider() {
  return {
    id: 'cf-chat',
    name: 'Cloudflare',
    builtin: 'cf',
    kind: 'chat',
    model: CF_MODELS.chat,
    baseUrl: '',
    apiKey: '',
    temperature: '0.8',
    enabled: 1,
    vision: '0',
  };
}

function extractText(out) {
  if (typeof out === 'string') return out.trim();
  if (!out || typeof out !== 'object') return '';
  // Primary shape (verified): OpenAI-style chat completion
  const choice = Array.isArray(out.choices) ? out.choices[0] : null;
  const msg = choice && choice.message ? choice.message : null;
  if (msg) {
    const content = typeof msg.content === 'string' ? msg.content.trim() : '';
    if (content) return content;
  }
  // Fallbacks for other CF text models
  if (typeof out.response === 'string' && out.response.trim()) return out.response.trim();
  if (out.result && typeof out.result === 'object') {
    const nested = extractText(out.result);
    if (nested) return nested;
  }
  if (typeof out.result === 'string') return out.result.trim();
  if (Array.isArray(out) && out.length) {
    const parts = out
      .map((o) => (o && typeof o === 'object' ? o.response || o.text || '' : typeof o === 'string' ? o : ''))
      .filter((s) => typeof s === 'string' && s);
    if (parts.length) return parts.join('').trim();
  }
  return '';
}

// Why content can still be empty: the model used the whole budget on reasoning.
function describeEmpty(out) {
  const choice = out && Array.isArray(out.choices) ? out.choices[0] : null;
  const finish = choice ? choice.finish_reason : '';
  if (finish === 'length') return 'Workers AI 思考超长被截断（可减小提示词或提高 max_tokens）';
  return 'Workers AI 没有返回文本';
}

function b64ToBytes(b64) {
  const bin = atob(String(b64));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Normalizes whatever env.AI.run returned into raw bytes.
// Handles: base64 field, raw binary, stream, and a `result`-wrapped envelope.
async function toBytes(out) {
  if (!out) return null;
  if (out instanceof ArrayBuffer) return new Uint8Array(out);
  if (out instanceof Uint8Array) return out;
  if (typeof out.arrayBuffer === 'function') return new Uint8Array(await out.arrayBuffer());
  if (typeof out.getReader === 'function') {
    // ReadableStream
    return new Uint8Array(await new Response(out).arrayBuffer());
  }
  if (typeof out === 'object') {
    if (typeof out.image === 'string') return b64ToBytes(out.image);
    if (typeof out.audio === 'string') return b64ToBytes(out.audio);
    // Some endpoints wrap everything under `result`
    if (out.result && typeof out.result === 'object') return toBytes(out.result);
  }
  return null;
}

// Text generation. `messages` is [{ role, content }]; content must be a string
// (the built-in CF chat model is text-only, no image input).
export async function cfText(env, model, messages, temperature) {
  const ai = env && env.AI;
  if (!ai || typeof ai.run !== 'function') {
    throw new Error('当前环境没有 Workers AI 绑定（wrangler.toml 里需要 [ai] binding = "AI"）');
  }
  const t = Number(temperature);
  const inputs = {
    messages,
    max_tokens: CHAT_MAX_TOKENS,
  };
  if (Number.isFinite(t)) inputs.temperature = t;
  const out = await ai.run(model, inputs);
  const text = extractText(out);
  if (!text) throw new Error(describeEmpty(out));
  return text;
}

// flux-1-schnell is English-trained: a Chinese prompt produces unrelated imagery
// So any non-ASCII prompt is translated to English first via the CF chat model.
const HAS_CJK = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/;

export async function cfTranslatePrompt(env, prompt) {
  const zh = String(prompt || '').trim();
  if (!zh || !HAS_CJK.test(zh)) return zh;
  try {
    const out = await cfText(
      env,
      CF_MODELS.chat,
      [
        {
          role: 'system',
          content:
            'You convert image descriptions into ONE concise English image-generation prompt. ' +
            'Keep the subject, style, colors, composition and mood. Output ONLY the English prompt — ' +
            'no quotes, no explanation, no Chinese characters.',
        },
        { role: 'user', content: zh.slice(0, 600) },
      ],
      0.3
    );
    const clean = String(out || '')
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return clean || zh;
  } catch {
    // Translation is best-effort: a failure must not block image generation.
    return zh;
  }
}

// Image generation. Returns { bytes, mime, promptUsed }.
// flux returns base64 JPEG in `image`; Chinese prompts are auto-translated.
export async function cfImage(env, model, prompt) {
  const ai = env && env.AI;
  if (!ai || typeof ai.run !== 'function') {
    throw new Error('当前环境没有 Workers AI 绑定（wrangler.toml 里需要 [ai] binding = "AI"）');
  }
  const raw = String(prompt || '').trim();
  if (!raw) throw new Error('缺少画面描述');
  const finalPrompt = await cfTranslatePrompt(env, raw);
  const out = await ai.run(model, {
    prompt: finalPrompt.slice(0, 800),
    steps: 4,
  });
  const bytes = await toBytes(out);
  if (!bytes || !bytes.length) throw new Error('Workers AI 生图没有返回图片');
  return { bytes, mime: 'image/jpeg', promptUsed: finalPrompt };
}

// Text-to-speech. Returns WAV bytes (PCM 16bit/44.1kHz/mono — NOT mp3).
// Supported langs (verified): en, es, fr, jp, zh. Anything else returns HTTP 400.
export const CF_TTS_LANGS = ['zh', 'en', 'es', 'fr', 'jp'];

export async function cfTts(env, model, text, lang) {
  const ai = env && env.AI;
  if (!ai || typeof ai.run !== 'function') {
    throw new Error('当前环境没有 Workers AI 绑定（wrangler.toml 里需要 [ai] binding = "AI"）');
  }
  const safe = CF_TTS_LANGS.includes(lang) ? lang : 'zh';
  const out = await ai.run(model, {
    prompt: String(text).slice(0, 300),
    lang: safe,
  });
  const bytes = await toBytes(out);
  if (!bytes || !bytes.length) throw new Error('Workers AI TTS 没有返回音频');
  return bytes;
}

// Unified chat completion: routes to env.AI for builtin CF models, otherwise
// to the OpenAI-compatible endpoint. Returns the assistant text.
export async function providerChat(env, provider, messages, { temperature, timeout = 90000 } = {}) {
  if (provider && provider.builtin === 'cf') {
    return cfText(env, provider.model, messages, temperature);
  }
  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify({
      model: provider.model,
      messages,
      temperature: temperature == null || temperature === '' ? 0.8 : Number(temperature),
    }),
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`HTTP ${res.status}${text ? ' ' + text.slice(0, 120) : ''}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const out = String(data.choices?.[0]?.message?.content || '').trim();
  if (!out) throw new Error('AI 返回空内容');
  return out;
}
