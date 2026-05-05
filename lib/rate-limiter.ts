import { createClient } from "redis";

export type RateLimitResult = {
  key: string;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
  limited: boolean;
};

type AppRedisClient = ReturnType<typeof createClient>;

let redisClient: AppRedisClient | null = null;
let redisConnectPromise: Promise<AppRedisClient | null> | null = null;
let warnedMissingRedisConfig = false;

function getRedisUrl() {
  const value = process.env.REDIS_URL?.trim();
  return value && value.length > 0 ? value : null;
}

async function getRedisClient(): Promise<AppRedisClient | null> {
  if (redisClient) {
    return redisClient;
  }

  if (redisConnectPromise) {
    return redisConnectPromise;
  }

  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    if (!warnedMissingRedisConfig) {
      warnedMissingRedisConfig = true;
      console.warn("[rate-limit] REDIS_URL is not configured; rate limiting is currently disabled.");
    }
    return null;
  }

  redisConnectPromise = (async () => {
    const client = createClient({ url: redisUrl });
    client.on("error", (error) => {
      console.error("[rate-limit] Redis client error", error);
    });
    await client.connect();
    redisClient = client;
    return client;
  })().catch((error) => {
    redisConnectPromise = null;
    console.error("[rate-limit] Failed to connect to Redis", error);
    return null;
  });

  return redisConnectPromise;
}

// In-memory fallback used when Redis is unreachable.
// Resets on process restart — intentionally conservative (low limits).
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

function sanitizeTtl(ttlMs: number | null | undefined, fallbackMs: number) {
  if (typeof ttlMs !== "number" || Number.isNaN(ttlMs) || ttlMs <= 0) {
    return fallbackMs;
  }

  return ttlMs;
}

export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const normalizedLimit = Math.max(1, Math.floor(limit));
  const normalizedWindowMs = Math.max(1000, Math.floor(windowMs));
  const client = await getRedisClient();

  if (!client) {
    // Redis unavailable — fall back to in-process memory limiter.
    return memoryCheckRateLimit(key, normalizedLimit, normalizedWindowMs);
  }

  const windowSeconds = Math.max(1, Math.ceil(normalizedWindowMs / 1000));
  const now = Date.now();

  const pipelineResults = await client
    .multi()
    .incr(key)
    .pTTL(key)
    .expire(key, windowSeconds, "NX")
    .pTTL(key)
    .exec();

  const countRaw = Number(pipelineResults[0] ?? 0);
  const ttlBeforeRaw = Number(pipelineResults[1] ?? 0);
  const ttlAfterRaw = Number(pipelineResults[3] ?? 0);
  const ttlMs = sanitizeTtl(ttlAfterRaw > 0 ? ttlAfterRaw : ttlBeforeRaw, normalizedWindowMs);
  const remaining = Math.max(0, normalizedLimit - countRaw);
  const limited = countRaw > normalizedLimit;
  const retryAfterSeconds = limited ? Math.max(1, Math.ceil(ttlMs / 1000)) : 0;

  return {
    key,
    limit: normalizedLimit,
    remaining,
    resetAt: now + ttlMs,
    retryAfterSeconds,
    limited,
  };
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
