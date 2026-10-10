// A tiny "no more than N requests per minute per visitor" limiter.
// Why: every Team Finder request makes two paid AI calls, so one visitor
// clicking 200 times would cost real money.
// It remembers visitors in memory, so it resets when the server restarts.
// For a bigger launch, swap it for the `express-rate-limit` package.

export function createRateLimiter({ windowMs = 60_000, max = 6, now = () => Date.now() } = {}) {
  const visitors = new Map(); // key -> { count, resetAt }

  function check(key) {
    const time = now();
    const entry = visitors.get(key);
    if (!entry || time >= entry.resetAt) {
      visitors.set(key, { count: 1, resetAt: time + windowMs });
      return { allowed: true, retryAfterSec: 0 };
    }
    if (entry.count >= max) {
      return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - time) / 1000) };
    }
    entry.count += 1;
    return { allowed: true, retryAfterSec: 0 };
  }

  /** Remove visitors whose window has ended, so the Map does not grow forever. */
  function sweep() {
    const time = now();
    for (const [key, entry] of visitors) {
      if (time >= entry.resetAt) visitors.delete(key);
    }
  }

  /** Express middleware: answers 429 when a visitor is over the limit. */
  function middleware(req, res, next) {
    const verdict = check(String(req.ip));
    if (verdict.allowed) return next();
    res.set('Retry-After', String(verdict.retryAfterSec));
    return res.status(429).json({
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a minute and try again.' },
    });
  }

  return { check, sweep, middleware };
}
