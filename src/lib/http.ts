import { log } from "./log";

export function jsonError(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
): Response {
  return Response.json({ error: { ...extra, code, message } }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function withErrors<Args extends unknown[]>(
  handler: (...args: Args) => Response | Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch {
      log("error", "Unexpected request error", { status: 500 });
      return jsonError(500, "INTERNAL_ERROR", "Internal server error");
    }
  };
}

interface RateLimitBucket {
  count: number;
  expiresAt: number;
}

const buckets = new Map<string, RateLimitBucket>();
const maxBuckets = 10_000;
let nextCleanup = 0;

export function ipRateLimit(key: string, limit: number, windowMs: number): boolean {
  if (!Number.isSafeInteger(limit) || limit < 0 || !Number.isSafeInteger(windowMs) || windowMs <= 0) {
    throw new RangeError("Invalid rate limit configuration");
  }
  if (limit === 0) return false;

  const now = Date.now();
  if (now >= nextCleanup || buckets.size >= maxBuckets) {
    for (const [storedKey, bucket] of buckets) {
      if (bucket.expiresAt <= now) buckets.delete(storedKey);
    }
    nextCleanup = now + 60_000;
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.expiresAt <= now) {
    if (!bucket && buckets.size >= maxBuckets) return false;
    buckets.set(key, { count: 1, expiresAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}
