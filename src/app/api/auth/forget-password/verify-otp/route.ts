import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, parseRequestJson, successResponse } from "@/lib/api-response";
import {
  AUTH_INVALID_EMAIL_MAX_ATTEMPTS,
  AUTH_INVALID_EMAIL_WINDOW_SECONDS,
  AUTH_OTP_LOCKOUT_SECONDS,
  AUTH_OTP_MAX_ATTEMPTS,
  AUTH_OTP_RESEND_COOLDOWN_SECONDS,
} from "@/lib/auth/rate-limits";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { authUser, authVerification } from "@/lib/db/schema";
import { clearRateLimitForEmail, getRateLimitStatus, recordRateLimit } from "@/lib/rateLimit";
import { randomUUID } from "crypto";

const VerifyOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().trim().length(6),
});

type VerifyOtpResponse = {
  success: true;
};

const VERIFY_LOCKOUT_ROUTE = "forget-password-verify-otp-lockout";
const VERIFY_LOCKOUT_MESSAGE = "Aguarde para reenviar o código.";

const getRequestIp = (req: NextRequest): string => {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
};

const buildAttemptsIdentifier = (email: string): string =>
  `forget-password:attempts:${email}`;

const parseAttempts = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
};

const getBetterAuthErrorCode = (error: unknown): string | null => {
  if (typeof error !== "object" || error === null) return null;
  if (!("body" in error)) return null;

  const body = (error as { body?: unknown }).body;
  if (typeof body !== "object" || body === null) return null;
  if (!("code" in body)) return null;

  const code = (body as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
};

const isOtpInvalidOrExpired = (error: unknown): boolean => {
  const code = getBetterAuthErrorCode(error);
  if (!code) return false;
  return code === "INVALID_OTP" || code === "EXPIRED_OTP" || code === "OTP_EXPIRED";
};

const isOtpTooManyAttempts = (error: unknown): boolean =>
  getBetterAuthErrorCode(error) === "TOO_MANY_ATTEMPTS";

const isResponse = (value: unknown): value is Response =>
  typeof value === "object" &&
  value !== null &&
  "ok" in value &&
  "status" in value &&
  "headers" in value;

const getResendRetryAfterSeconds = async (params: {
  email: string;
  ip: string;
  lockoutSeconds: number;
}): Promise<number> => {
  const resendCooldownStatus = await getRateLimitStatus({
    email: params.email,
    ip: params.ip,
    route: "forget-password-send-otp-cooldown",
    limit: 1,
    windowInSeconds: AUTH_OTP_RESEND_COOLDOWN_SECONDS,
  });
  return Math.max(params.lockoutSeconds, resendCooldownStatus.retryAfterSeconds);
};

export async function POST(req: NextRequest) {
  try {
    const parsedBody = await parseRequestJson(req, VerifyOtpSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { email, code } = parsedBody.data;

    const ip = getRequestIp(req);
    const lockoutStatus = await getRateLimitStatus({
      email,
      ip,
      route: VERIFY_LOCKOUT_ROUTE,
      limit: 1,
      windowInSeconds: AUTH_OTP_LOCKOUT_SECONDS,
    });

    if (lockoutStatus.isLimited) {
      const retryAfter = await getResendRetryAfterSeconds({
        email,
        ip,
        lockoutSeconds: lockoutStatus.retryAfterSeconds,
      });
      return errorResponse(
        VERIFY_LOCKOUT_MESSAGE,
        429,
        { field: "code", retryAfterSeconds: retryAfter },
        { "Retry-After": String(retryAfter) },
      );
    }

    const user = await db.query.authUser.findFirst({
      where: eq(authUser.email, email),
    });

    if (!user) {
      const invalidEmailStatus = await getRateLimitStatus({
        email: "unknown",
        ip,
        route: "forget-password-wrong-email",
        limit: AUTH_INVALID_EMAIL_MAX_ATTEMPTS,
        windowInSeconds: AUTH_INVALID_EMAIL_WINDOW_SECONDS,
      });

      if (invalidEmailStatus.isLimited) {
        return errorResponse(
          "Aguarde para tentar novamente.",
          429,
          { field: "email", retryAfterSeconds: invalidEmailStatus.retryAfterSeconds },
          { "Retry-After": String(invalidEmailStatus.retryAfterSeconds) },
        );
      }

      await recordRateLimit({
        email: "unknown",
        ip,
        route: "forget-password-wrong-email",
        windowInSeconds: AUTH_INVALID_EMAIL_WINDOW_SECONDS,
      });

      return errorResponse("E-mail inexistente.", 404, { field: "email" });
    }

    const attemptsIdentifier = buildAttemptsIdentifier(email);
    const attemptsRow = await db.query.authVerification.findFirst({
      where: eq(authVerification.identifier, attemptsIdentifier),
    });

    const now = new Date();
    if (attemptsRow && attemptsRow.expiresAt < now) {
      await db
        .delete(authVerification)
        .where(eq(authVerification.id, attemptsRow.id));
    } else {
      const attempts = parseAttempts(attemptsRow?.value);
      if (attempts >= AUTH_OTP_MAX_ATTEMPTS) {
        await recordRateLimit({
          email,
          ip,
          route: VERIFY_LOCKOUT_ROUTE,
          windowInSeconds: AUTH_OTP_LOCKOUT_SECONDS,
        });
        const retryAfter = await getResendRetryAfterSeconds({
          email,
          ip,
          lockoutSeconds: AUTH_OTP_LOCKOUT_SECONDS,
        });
        return errorResponse(
          VERIFY_LOCKOUT_MESSAGE,
          429,
          { field: "code", retryAfterSeconds: retryAfter },
          { "Retry-After": String(retryAfter) },
        );
      }
    }

    const verification = await (async (): Promise<{ success: boolean } | Response> => {
      try {
        const result = await auth.api.checkVerificationOTP({
          body: {
            email,
            otp: code,
            type: "forget-password",
          },
          headers: await headers(),
        });

        return { success: result?.success === true };
      } catch (error) {
        if (isOtpTooManyAttempts(error)) {
          await recordRateLimit({
            email,
            ip,
            route: VERIFY_LOCKOUT_ROUTE,
            windowInSeconds: AUTH_OTP_LOCKOUT_SECONDS,
          });
          const retryAfter = await getResendRetryAfterSeconds({
            email,
            ip,
            lockoutSeconds: AUTH_OTP_LOCKOUT_SECONDS,
          });
          return errorResponse(
            VERIFY_LOCKOUT_MESSAGE,
            429,
            { field: "code", retryAfterSeconds: retryAfter },
            { "Retry-After": String(retryAfter) },
          );
        }

        if (!isOtpInvalidOrExpired(error)) throw error;
        return { success: false };
      }
    })();

    if (isResponse(verification)) {
      return verification;
    }

    if (!verification.success) {
      const attemptsRow2 = await db.query.authVerification.findFirst({
        where: eq(authVerification.identifier, attemptsIdentifier),
      });

      const expiresAt =
        attemptsRow2?.expiresAt && attemptsRow2.expiresAt > now
          ? attemptsRow2.expiresAt
          : new Date(now.getTime() + 10 * 60 * 1000);

      const currentAttempts = parseAttempts(attemptsRow2?.value);
      const nextAttempts = currentAttempts + 1;

      if (attemptsRow2) {
        await db
          .update(authVerification)
          .set({
            value: String(nextAttempts),
            expiresAt,
            updatedAt: now,
          })
          .where(eq(authVerification.id, attemptsRow2.id));
      } else {
        await db.insert(authVerification).values({
          id: randomUUID(),
          identifier: attemptsIdentifier,
          value: String(nextAttempts),
          expiresAt,
          createdAt: now,
          updatedAt: now,
        });
      }

      if (nextAttempts >= AUTH_OTP_MAX_ATTEMPTS) {
        await recordRateLimit({
          email,
          ip,
          route: VERIFY_LOCKOUT_ROUTE,
          windowInSeconds: AUTH_OTP_LOCKOUT_SECONDS,
        });
        return errorResponse(
          VERIFY_LOCKOUT_MESSAGE,
          429,
          { field: "code", retryAfterSeconds: AUTH_OTP_LOCKOUT_SECONDS },
          { "Retry-After": String(AUTH_OTP_LOCKOUT_SECONDS) },
        );
      }

      return errorResponse("Código inválido ou expirado.", 400, { field: "code" });
    }

    if (attemptsRow) {
      await db
        .delete(authVerification)
        .where(eq(authVerification.id, attemptsRow.id));
    } else {
      await db
        .delete(authVerification)
        .where(eq(authVerification.identifier, attemptsIdentifier));
    }

    await clearRateLimitForEmail({ email });

    return successResponse<VerifyOtpResponse>({ success: true });
  } catch (error) {
    console.error("❌ [API_FORGET_PASSWORD_VERIFY_OTP] Erro ao verificar OTP:", {
      error,
    });
    return errorResponse("Erro ao verificar código.", 500);
  }
}
