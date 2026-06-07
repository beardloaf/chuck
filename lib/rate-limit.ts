/**
 * Tiny in-memory rate limiter for v1. Keyed by IP, fixed-window.
 *
 * Good enough for a single-instance deploy. For multi-instance production,
 * swap the Map for Upstash Redis (`upstash/ratelimit`).
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Identifier (typically IP). */
  key: string;
  /** Max requests per window. */
  limit: number;
  /** Window length in ms. */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
}

export function rateLimit(opts: RateLimitOptions): RateLimitResult {
  const { key, limit, windowMs } = opts;
  const now = Date.now();

  // Sweep stale buckets occasionally — cheap O(n) but rare.
  if (buckets.size > 1024 && Math.random() < 0.01) {
    for (const [k, b] of buckets) {
      if (b.resetAt < now) buckets.delete(k);
    }
  }

  let b = buckets.get(key);
  if (!b || b.resetAt < now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  return {
    ok: b.count <= limit,
    remaining: Math.max(0, limit - b.count),
    resetAt: b.resetAt,
  };
}

/** Extract the caller's IP from a NextRequest (best-effort). */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
