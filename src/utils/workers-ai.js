// Cloudflare Workers AI helpers.
// Unlike external OpenAI-compatible endpoints (which we call over fetch),
// built-in CF models run through the env.AI binding:
//   - text generation returns { response: "..." }
//   - image generation (flux) returns a ReadableStream of PNG bytes
//   - TTS (melotts) returns { audio: base64 } or raw bytes

export const CF_MODELS = {
  chat: '@cf/qwen/qwen3-30b-a3b-fp8',
  image: '@cf/black-forest-labs/flux-1-schnell',
  voice: '@cf/myshell-ai/melotts',
};

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
  if (out && typeof out === 'object') {
    if (typeof out.response === 'string') return out.response.trim();
    if (out.result && typeof out.result.response === 'string') return out.result.response.trim();
    if (out.result && typeof out.result === 'string') return out.result.trim();
  }
  if (Array.isArray(out) && out.length) {
    const parts = out
      .map((o) =>
        o && typeof o === 'object'
          ? o.response || o.text || (o.message && o.message.content)
          : typeof o === 'string'
            ? o
            : ''
      )
      .filter((s) => typeof s === 'string' && s);
    if (parts.length) return parts.join('').trim();
  }
  return '';
}

async function toBytes(out) {
  if (out instanceof ArrayBuffer) return new Uint8Array(out);
  if (out instanceof Uint8Array) return out;
  if (out && typeof out.arrayBuffer === 'function') {
    return new Uint8Array(await out.arrayBuffer());
  }
  if (out && typeof out.getReader === 'function') {
    // ReadableStream (CF flux returns the PNG as a stream)
    return new Uint8Array(await new Response(out).arrayBuffer());
  }
  if (out && typeof out.audio === 'string') {
    // melotts can return base64 audio
    const bin = atob(out.audio);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  if (out && typeof out.image === 'string') {
    const bin = atob(out.image);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
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
    max_tokens: 1024,
  };
  if (Number.isFinite(t)) inputs.temperature = t;
  const out = await ai.run(model, inputs);
  const text = extractText(out);
  if (!text) throw new Error('Workers AI 没有返回文本');
  return text;
}

// Image generation. Returns { bytes, mime }. flux returns base64 JPEG in `image`.
export async function cfImage(env, model, prompt) {
  const ai = env && env.AI;
  if (!ai || typeof ai.run !== 'function') {
    throw new Error('当前环境没有 Workers AI 绑定（wrangler.toml 里需要 [ai] binding = "AI"）');
  }
  const out = await ai.run(model, {
    prompt: String(prompt).slice(0, 800),
    steps: 4,
  });
  const bytes = await toBytes(out);
  if (!bytes || !bytes.length) throw new Error('Workers AI 生图没有返回图片');
  // flux 输出 JPEG；其它 CF 生图模型也以 JPEG 为主
  return { bytes, mime: 'image/jpeg' };
}

// Text-to-speech. Returns MP3 bytes.
export async function cfTts(env, model, text, lang) {
  const ai = env && env.AI;
  if (!ai || typeof ai.run !== 'function') {
    throw new Error('当前环境没有 Workers AI 绑定（wrangler.toml 里需要 [ai] binding = "AI"）');
  }
  const out = await ai.run(model, {
    prompt: String(text).slice(0, 300),
    lang: String(lang || 'zh').slice(0, 8),
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
