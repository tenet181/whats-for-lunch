/**
 * 极简滑动窗口限流（单进程内存），定时清理过期桶。
 */
export function createRateLimiter({ max, windowMs }) {
  const hits = new Map();

  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, stamps] of hits) {
      const kept = stamps.filter((t) => now - t < windowMs);
      if (kept.length === 0) hits.delete(key);
      else hits.set(key, kept);
    }
  }, Math.min(Math.max(windowMs, 10000), 60000));
  if (typeof timer.unref === 'function') timer.unref();

  return {
    check(key) {
      const now = Date.now();
      const stamps = (hits.get(key) || []).filter((t) => now - t < windowMs);
      if (stamps.length >= max) {
        const retryAfter = Math.max(1, Math.ceil((windowMs - (now - stamps[0])) / 1000));
        hits.set(key, stamps);
        return { ok: false, retryAfter };
      }
      stamps.push(now);
      hits.set(key, stamps);
      return { ok: true, remaining: max - stamps.length };
    },
    reset(key) {
      hits.delete(key);
    },
    get size() {
      return hits.size;
    },
  };
}
