export type RateLimitResult = {
  key: string;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
  limited: boolean;
};
// In-memory rate limiter.
// Resets on process restart and is suitable for a single app instance.
const memoryStore = new Map<string, { count: number; resetAt: number }>();

function memoryCheckRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now >= entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { key, limit, remaining: limit - 1, resetAt: now + windowMs, retryAfterSeconds: 0, limited: false };
  }

  entry.count += 1;
  const remaining = Math.max(0, limit - entry.count);
  const limited = entry.count > limit;
  const retryAfterSeconds = limited ? Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) : 0;

  return { key, limit, remaining, resetAt: entry.resetAt, retryAfterSeconds, limited };
}

// Periodically evict stale in-memory entries to prevent unbounded growth.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memoryStore) {
    if (now >= v.resetAt) memoryStore.delete(k);
  }
}, 5 * 60 * 1000);

export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const normalizedLimit = Math.max(1, Math.floor(limit));
  const normalizedWindowMs = Math.max(1000, Math.floor(windowMs));
  return memoryCheckRateLimit(key, normalizedLimit, normalizedWindowMs);
}

export function getRateLimitHeaders(result: RateLimitResult): HeadersInit {
  const now = Date.now();
  const resetSeconds = Math.max(0, Math.ceil((result.resetAt - now) / 1000));

  const headers: Record<string, string> = {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(resetSeconds),
  };

  if (result.retryAfterSeconds > 0) {
    headers["Retry-After"] = String(result.retryAfterSeconds);
  }

  return headers;
}

export function mergeRateLimitHeaders(results: RateLimitResult[]): HeadersInit {
  if (results.length === 0) {
    return {};
  }

  const strictest = results.reduce((current, candidate) => {
    if (candidate.limited && !current.limited) {
      return candidate;
    }

    if (candidate.remaining < current.remaining) {
      return candidate;
    }

    return current;
  }, results[0]);

  return getRateLimitHeaders(strictest);
}
