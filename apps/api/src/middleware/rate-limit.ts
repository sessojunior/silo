import type { Request, Response, NextFunction } from "express";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

export function rateLimit(options: {
  windowMs?: number;
  max?: number;
  keyPrefix?: string;
}) {
  const { windowMs = 60_000, max = 60, keyPrefix = "rl" } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${keyPrefix}:${req.ip}`;
    const now = Date.now();
    let entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 1, resetAt: now + windowMs };
      store.set(key, entry);
      next();
      return;
    }

    entry.count++;
    if (entry.count > max) {
      res.status(429).json({
        success: false,
        error: "Muitas requisições. Tente novamente em breve.",
      });
      return;
    }

    next();
  };
}
