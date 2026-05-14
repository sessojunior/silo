import type { NextFunction, Request, Response } from "express";

type RateLimitEntry = {
  count: number;
  resetAt: number;
  lastSeenAt: number;
};

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL_MS = 5 * 60_000;

let lastCleanupAt = 0;

function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function getDefaultKey(req: Request): string {
  return `ip:${getClientIp(req)}`;
}

function sweepExpiredEntries(now: number): void {
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

function setRateLimitHeaders(res: Response, max: number, remaining: number, resetAt: number): void {
  res.setHeader("RateLimit-Limit", String(max));
  res.setHeader("RateLimit-Remaining", String(Math.max(0, remaining)));
  res.setHeader("RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
}

function applyRateLimit(params: {
  identity: string;
  keyPrefix: string;
  res: Response;
  next: NextFunction;
  now: number;
  max: number;
  windowMs: number;
}): void {
  const {
    identity,
    keyPrefix,
    res,
    next,
    now,
    max,
    windowMs,
  } = params;

  const key = `${keyPrefix}:${identity}`;
  let entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs, lastSeenAt: now };
    store.set(key, entry);
    setRateLimitHeaders(res, max, max - entry.count, entry.resetAt);
    next();
    return;
  }

  entry.count++;
  entry.lastSeenAt = now;
  const remaining = max - entry.count;
  setRateLimitHeaders(res, max, remaining, entry.resetAt);
  if (entry.count > max) {
    res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
    res.status(429).json({
      success: false,
      error: "Muitas requisições. Tente novamente em breve.",
    });
    return;
  }

  next();
}

export function rateLimit(options: {
  windowMs?: number;
  max?: number;
  keyPrefix?: string;
  skip?: (req: Request) => boolean;
  keyGenerator?: (req: Request) => string | Promise<string>;
}) {
  const {
    windowMs = 60_000,
    max = 60,
    keyPrefix = "rl",
    skip,
    keyGenerator = getDefaultKey,
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (skip?.(req)) {
      next();
      return;
    }

    const now = Date.now();
    if (now - lastCleanupAt >= CLEANUP_INTERVAL_MS) {
      sweepExpiredEntries(now);
      lastCleanupAt = now;
    }

    void Promise.resolve()
      .then(() => keyGenerator(req))
      .then((identity) => {
        applyRateLimit({ identity, keyPrefix, res, next, now, max, windowMs });
      })
      .catch((err) => {
        console.warn("⚠️ [RATE_LIMIT] Failed to resolve key, falling back to IP:", err);
        applyRateLimit({ identity: getDefaultKey(req), keyPrefix, res, next, now, max, windowMs });
      });
  };
}
