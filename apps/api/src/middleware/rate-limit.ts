import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

type RateLimitEntry = {
  count: number;
  resetAt: number;
  lastSeenAt: number;
};

const store = new Map<string, RateLimitEntry>();

const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
  "__Host-better-auth.session_token",
] as const;

const CLEANUP_INTERVAL_MS = 5 * 60_000;

let lastCleanupAt = 0;

function getHeaderValue(req: Request, name: string): string | undefined {
  const value = req.get(name);
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function parseCookieHeader(cookieHeader: string): Map<string, string> {
  const cookies = new Map<string, string>();

  for (const cookiePart of cookieHeader.split(";")) {
    const trimmedCookie = cookiePart.trim();
    if (!trimmedCookie) continue;

    const separatorIndex = trimmedCookie.indexOf("=");
    if (separatorIndex <= 0) continue;

    const name = trimmedCookie.slice(0, separatorIndex).trim();
    const value = trimmedCookie.slice(separatorIndex + 1).trim();
    if (name) cookies.set(name, value);
  }

  return cookies;
}

function getClientIp(req: Request): string {
  const forwardedFor = getHeaderValue(req, "x-forwarded-for");
  if (forwardedFor) {
    const forwardedIp = forwardedFor.split(",")[0]?.trim();
    if (forwardedIp) return forwardedIp;
  }

  const realIp = getHeaderValue(req, "x-real-ip");
  if (realIp) return realIp;

  return req.ip || "unknown";
}

function getSessionToken(req: Request): string | null {
  const cookieHeader = getHeaderValue(req, "cookie");
  if (!cookieHeader) return null;

  const cookies = parseCookieHeader(cookieHeader);
  for (const cookieName of SESSION_COOKIE_NAMES) {
    const token = cookies.get(cookieName);
    if (token) return token;
  }

  return null;
}

function hashIdentity(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function getDefaultKey(req: Request): string {
  const sessionToken = getSessionToken(req);
  if (sessionToken) {
    return `session:${hashIdentity(sessionToken)}`;
  }

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

export function rateLimit(options: {
  windowMs?: number;
  max?: number;
  keyPrefix?: string;
  skip?: (req: Request) => boolean;
  keyGenerator?: (req: Request) => string;
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

    const key = `${keyPrefix}:${keyGenerator(req)}`;
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
  };
}
