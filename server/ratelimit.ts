// Minimal in-memory sliding-window rate limiter for auth endpoints (anti brute-force).
// Single-instance: counters live in process memory. For multi-instance deployments,
// front this with a shared store (Redis) or rely on the reverse-proxy/WAF.
type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

/** Returns { ok } and how long to wait when blocked. Each call counts as one attempt. */
export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const e = store.get(key);
  if (!e || e.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  e.count += 1;
  if (e.count > max) return { ok: false, retryAfterSec: Math.ceil((e.resetAt - now) / 1000) };
  return { ok: true, retryAfterSec: 0 };
}

/** Clear the counter for a key (e.g. after a successful login). */
export function rateLimitReset(key: string): void {
  store.delete(key);
}

// Opportunistic cleanup so the map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [k, e] of Array.from(store.entries())) if (e.resetAt <= now) store.delete(k);
}, 10 * 60 * 1000).unref?.();
