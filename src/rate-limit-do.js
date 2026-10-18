
export class RateLimiter {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/reset') {
      await this.state.storage.deleteAll();
      await this.state.storage.deleteAlarm();
      return Response.json({ ok: true });
    }

    if (url.pathname !== '/hit') {
      return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    const limit = Math.max(1, Number(url.searchParams.get('limit')) || 1);
    const windowMs = Math.max(1000, Number(url.searchParams.get('windowMs')) || 60000);
    const now = Date.now();

    let rec = await this.state.storage.get('window');
    if (!rec || now >= rec.resetAt) rec = { count: 0, resetAt: now + windowMs };
    rec.count += 1;
    await this.state.storage.put('window', rec);
    
    await this.state.storage.setAlarm(rec.resetAt);

    return Response.json({
      ok: true,
      allowed: rec.count <= limit,
      limit,
      remaining: Math.max(0, limit - rec.count),
      resetAt: rec.resetAt,
    });
  }

  async alarm() {
    const rec = await this.state.storage.get('window');
    if (!rec || Date.now() >= rec.resetAt) {
      await this.state.storage.deleteAll();
    } else {
      await this.state.storage.setAlarm(rec.resetAt);
    }
  }
}
