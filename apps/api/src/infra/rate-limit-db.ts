import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db, isDatabaseInfrastructureUnavailable } from "@silo/database";
import { rateLimit } from "@silo/database/schema";
import { randomUUID } from "crypto";

async function cleanRateLimitRecords(olderThanMinutes = 60): Promise<void> {
  try {
    const threshold = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    await db.delete(rateLimit).where(lt(rateLimit.lastRequest, threshold));
  } catch (err) {
    if (isDatabaseInfrastructureUnavailable(err)) return;
    throw err;
  }
}

export async function getRateLimitStatus({
  email,
  ip,
  route,
  limit = 3,
  windowInSeconds = 60,
}: {
  email: string;
  ip: string;
  route: string;
  limit?: number;
  windowInSeconds?: number;
}): Promise<{ isLimited: boolean; retryAfterSeconds: number }> {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowInSeconds * 1000);

    await cleanRateLimitRecords();

    const existing = await db.query.rateLimit.findFirst({
      where: and(
        eq(rateLimit.email, email),
        eq(rateLimit.ip, ip),
        eq(rateLimit.route, route),
      ),
    });

    if (!existing || existing.lastRequest < windowStart)
      return { isLimited: false, retryAfterSeconds: 0 };
    if (existing.count < limit)
      return { isLimited: false, retryAfterSeconds: 0 };

    const unlockAtMs = existing.lastRequest.getTime() + windowInSeconds * 1000;
    const retryAfterSeconds = Math.ceil(Math.max(0, unlockAtMs - now.getTime()) / 1000);
    return { isLimited: true, retryAfterSeconds };
  } catch (err) {
    if (isDatabaseInfrastructureUnavailable(err)) {
      console.error("⛔ [RATE_LIMIT] DB unavailable, failing closed:", (err as Error).message);
      return { isLimited: true, retryAfterSeconds: 60 };
    }
    throw err;
  }
}

export async function recordRateLimit({
  email,
  ip,
  route,
  windowInSeconds = 60,
}: {
  email: string;
  ip: string;
  route: string;
  windowInSeconds?: number;
}): Promise<void> {
  try {
    const resetWindow = new Date(Date.now() - windowInSeconds * 1000);

    await db
      .insert(rateLimit)
      .values({ id: randomUUID(), route, email, ip, count: 1, lastRequest: new Date() })
      .onConflictDoUpdate({
        target: [rateLimit.email, rateLimit.ip, rateLimit.route],
        set: {
          count: sql`CASE WHEN ${rateLimit.lastRequest} < ${resetWindow} THEN 1 ELSE ${rateLimit.count} + 1 END`,
          lastRequest: new Date(),
        },
      });
  } catch (err) {
    if (isDatabaseInfrastructureUnavailable(err)) {
      console.warn("⚠️ [RATE_LIMIT] DB unavailable, skipping recordRateLimit:", (err as Error).message);
      return;
    }
    throw err;
  }
}

export async function clearRateLimitForEmail(params: {
  email: string;
  routes?: readonly string[];
}): Promise<void> {
  try {
    const normalizedEmail = params.email.trim().toLowerCase();
    if (!normalizedEmail) return;

    if (params.routes && params.routes.length > 0) {
      await db.delete(rateLimit).where(
        and(eq(rateLimit.email, normalizedEmail), inArray(rateLimit.route, [...params.routes])),
      );
      return;
    }

    await db.delete(rateLimit).where(eq(rateLimit.email, normalizedEmail));
  } catch (err) {
    if (isDatabaseInfrastructureUnavailable(err)) {
      console.warn("⚠️ [RATE_LIMIT] DB unavailable, skipping clearRateLimitForEmail:", (err as Error).message);
      return;
    }
    throw err;
  }
}
