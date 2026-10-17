
export async function hitRateLimit(env, key, { limit, windowMs }) {
  try {
    const stub = env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName(key));
    const res = await stub.fetch(`https://ratelimit/hit?limit=${limit}&windowMs=${windowMs}`, {
      method: 'POST',
    });
    if (!res.ok) {
      return { allowed: true, limit, remaining: limit, resetAt: Date.now() + windowMs };
    }
    return res.json();
  } catch (err) {
    console.error('Rate limit check failed:', err);
    return { allowed: true, limit, remaining: limit, resetAt: Date.now() + windowMs };
  }
}

export async function resetRateLimit(env, keys) {
  await Promise.all(
    keys.map(async (key) => {
      try {
        const stub = env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName(key));
        await stub.fetch('https://ratelimit/reset', { method: 'POST' });
      } catch (err) {
        console.error(`Reset rate limit failed for ${key}:`, err);
      }
    })
  );
}
