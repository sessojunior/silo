import { and, eq, inArray, lt, sql } from "drizzle-orm";
import {
  db,
  isDatabaseAvailable,
  isDatabaseInfrastructureUnavailable,
} from "@/lib/db";
import { rateLimit } from "@/lib/db/schema";
import { randomUUID } from "crypto";

const logRateLimitStorageFallback = (
  operation: string,
  error: unknown,
): void => {
  console.warn("⚠️ [RATE_LIMIT] Storage indisponível; seguindo sem persistência.", {
    operation,
    code:
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : undefined,
    message: error instanceof Error ? error.message : String(error),
  });
};

// Verifica se um IP ou email ultrapassaram o limite de envio para um tipo específico

// Verifica se a taxa de envio de e-mails para um IP ou e-mail foi excedida
// Retorna true se estiver bloqueado, false se estiver permitido
// - email - E-mail de destino
// - ip - IP do usuário que fez a requisição
// - route - Tipo da rota (ex: 'sign-in', 'email-verification', 'forget-password')
// - limit - Número máximo de tentativas (padrão: 3 tentativas)
// - windowInSeconds - Janela de tempo permitida em segundos (padrão: 60 segundos)
export async function isRateLimited({
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
}): Promise<boolean> {
  try {
    if (!(await isDatabaseAvailable())) return false;

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

    if (!existing) return false;
    if (existing.lastRequest < windowStart) return false;
    return existing.count >= limit;
  } catch (error) {
    if (!isDatabaseInfrastructureUnavailable(error)) throw error;
    logRateLimitStorageFallback("isRateLimited", error);
    return false;
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
    if (!(await isDatabaseAvailable())) {
      return { isLimited: false, retryAfterSeconds: 0 };
    }

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

    if (!existing) return { isLimited: false, retryAfterSeconds: 0 };
    if (existing.lastRequest < windowStart)
      return { isLimited: false, retryAfterSeconds: 0 };
    if (existing.count < limit)
      return { isLimited: false, retryAfterSeconds: 0 };

    const unlockAtMs = existing.lastRequest.getTime() + windowInSeconds * 1000;
    const remainingMs = Math.max(0, unlockAtMs - now.getTime());
    const retryAfterSeconds = Math.ceil(remainingMs / 1000);
    return { isLimited: true, retryAfterSeconds };
  } catch (error) {
    if (!isDatabaseInfrastructureUnavailable(error)) throw error;
    logRateLimitStorageFallback("getRateLimitStatus", error);
    return { isLimited: false, retryAfterSeconds: 0 };
  }
}

// Atualiza ou cria o registro de tentativa de envio
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
    if (!(await isDatabaseAvailable())) return;

    const resetWindow = new Date(new Date().getTime() - windowInSeconds * 1000);

    await db
      .insert(rateLimit)
      .values({
        id: randomUUID(),
        route,
        email,
        ip,
        count: 1,
        lastRequest: new Date(),
      })
      .onConflictDoUpdate({
        target: [rateLimit.email, rateLimit.ip, rateLimit.route],
        set: {
          count: sql`CASE 
				WHEN ${rateLimit.lastRequest} < ${resetWindow} THEN 1 
				ELSE ${rateLimit.count} + 1 
			END`,
          lastRequest: new Date(),
        },
      });
  } catch (error) {
    if (!isDatabaseInfrastructureUnavailable(error)) throw error;
    logRateLimitStorageFallback("recordRateLimit", error);
  }
}

export async function clearRateLimitForEmail(params: {
  email: string;
  routes?: readonly string[];
}): Promise<void> {
  try {
    if (!(await isDatabaseAvailable())) return;

    const normalizedEmail = params.email.trim().toLowerCase();
    if (!normalizedEmail) return;

    if (params.routes && params.routes.length > 0) {
      await db
        .delete(rateLimit)
        .where(
          and(
            eq(rateLimit.email, normalizedEmail),
            inArray(rateLimit.route, [...params.routes]),
          ),
        );
      return;
    }

    await db.delete(rateLimit).where(eq(rateLimit.email, normalizedEmail));
  } catch (error) {
    if (!isDatabaseInfrastructureUnavailable(error)) throw error;
    logRateLimitStorageFallback("clearRateLimitForEmail", error);
  }
}

// Função auxiliar que remove registros antigos do banco (ex: mais de 60 minutos)
// Usado para limpar tentativas antigas e manter o banco leve
async function cleanRateLimitRecords(olderThanMinutes = 60): Promise<void> {
  try {
    if (!(await isDatabaseAvailable())) return;

    const threshold = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    await db.delete(rateLimit).where(lt(rateLimit.lastRequest, threshold));
  } catch (error) {
    if (!isDatabaseInfrastructureUnavailable(error)) throw error;
    logRateLimitStorageFallback("cleanRateLimitRecords", error);
  }
}
