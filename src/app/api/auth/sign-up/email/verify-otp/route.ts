import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, parseRequestJson, successResponse } from "@/lib/api-response";
import { translateAuthError } from "@/lib/auth/i18n";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { authUser, authVerification, group, userGroup } from "@/lib/db/schema";
import {
  clearRateLimitForEmail,
  getRateLimitStatus,
  recordRateLimit,
} from "@/lib/rateLimit";
import { randomUUID } from "crypto";

const VerifyOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().trim().length(6),
  password: z.string().min(8).max(160).optional(),
  autoSignIn: z.boolean().optional(),
});

type VerifyOtpResponse = {
  success: true;
  signedIn?: boolean;
};

const OTP_MAX_ATTEMPTS = 5;
const VERIFY_LOCKOUT_SECONDS = 90;
const VERIFY_LOCKOUT_ROUTE = "sign-up-email-verification-verify-otp-lockout";

const buildAttemptsIdentifier = (email: string): string =>
  `sign-up-email-verification:attempts:${email}`;

const getRequestIp = (req: NextRequest): string => {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
};

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

const readSetCookieHeaders = (headers: Headers): string[] => {
  const maybe = headers as unknown as { getSetCookie?: () => string[] };
  if (typeof maybe.getSetCookie === "function") return maybe.getSetCookie();
  const raw = headers.get("set-cookie");
  return raw ? [raw] : [];
};

const readBetterAuthErrorPayload = async (
  response: Response,
): Promise<{ code?: string; message?: string } | null> => {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return null;
  }

  if (typeof payload !== "object" || payload === null) return null;
  const raw = payload as { code?: unknown; message?: unknown };

  const code = typeof raw.code === "string" ? raw.code : undefined;
  const message = typeof raw.message === "string" ? raw.message : undefined;
  return { ...(code ? { code } : {}), ...(message ? { message } : {}) };
};

export async function POST(req: NextRequest) {
  try {
    const parsedBody = await parseRequestJson(req, VerifyOtpSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { email, code, password, autoSignIn } = parsedBody.data;

    const ip = getRequestIp(req);
    const lockoutStatus = await getRateLimitStatus({
      email,
      ip,
      route: VERIFY_LOCKOUT_ROUTE,
      limit: 1,
      windowInSeconds: VERIFY_LOCKOUT_SECONDS,
    });

    if (lockoutStatus.isLimited) {
      const retryAfter = lockoutStatus.retryAfterSeconds;
      return errorResponse(
        "Aguarde para reenviar o código.",
        429,
        { field: "code", retryAfterSeconds: retryAfter },
        { "Retry-After": String(retryAfter) },
      );
    }

    const user = await db.query.authUser.findFirst({
      where: eq(authUser.email, email),
    });

    if (!user) {
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
      if (attempts >= OTP_MAX_ATTEMPTS) {
        await recordRateLimit({
          email,
          ip,
          route: VERIFY_LOCKOUT_ROUTE,
          windowInSeconds: VERIFY_LOCKOUT_SECONDS,
        });
        return errorResponse(
          "Aguarde para reenviar o código.",
          429,
          { field: "code", retryAfterSeconds: VERIFY_LOCKOUT_SECONDS },
          { "Retry-After": String(VERIFY_LOCKOUT_SECONDS) },
        );
      }
    }

    const verification = await (async (): Promise<{ success: boolean } | Response> => {
      try {
        const result = await auth.api.checkVerificationOTP({
          body: {
            email,
            otp: code,
            type: "email-verification",
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
            windowInSeconds: VERIFY_LOCKOUT_SECONDS,
          });

          return errorResponse(
            "Aguarde para reenviar o código.",
            429,
            { field: "code", retryAfterSeconds: VERIFY_LOCKOUT_SECONDS },
            { "Retry-After": String(VERIFY_LOCKOUT_SECONDS) },
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

      if (nextAttempts >= OTP_MAX_ATTEMPTS) {
        await recordRateLimit({
          email,
          ip,
          route: VERIFY_LOCKOUT_ROUTE,
          windowInSeconds: VERIFY_LOCKOUT_SECONDS,
        });
        return errorResponse(
          "Aguarde para reenviar o código.",
          429,
          { field: "code", retryAfterSeconds: VERIFY_LOCKOUT_SECONDS },
          { "Retry-After": String(VERIFY_LOCKOUT_SECONDS) },
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

    const shouldActivateUser = user.emailVerified === false;
    if (shouldActivateUser) {
      await db
        .update(authUser)
        .set({
          emailVerified: true,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(authUser.id, user.id));

      const adminGroup = await db.query.group.findFirst({
        where: eq(group.role, "admin"),
      });

      if (!adminGroup) {
        return errorResponse(
          'Grupo "Administradores" não configurado no sistema.',
          500,
        );
      }

      const isAlreadyAdmin = await db.query.userGroup.findFirst({
        where: and(
          eq(userGroup.userId, user.id),
          eq(userGroup.groupId, adminGroup.id),
        ),
      });

      if (!isAlreadyAdmin) {
        await db.insert(userGroup).values({
          id: randomUUID(),
          userId: user.id,
          groupId: adminGroup.id,
          joinedAt: new Date(),
        });
      }
    }

    if (autoSignIn === true && typeof password === "string") {
      const signInResponse = await auth.api.signInEmail({
        body: { email, password },
        headers: req.headers,
        asResponse: true,
      });

      if (!signInResponse.ok) {
        const payload = await readBetterAuthErrorPayload(signInResponse);
        const translated = translateAuthError(
          {
            code: payload?.code,
            message: payload?.message,
            status: signInResponse.status,
          },
          "Erro ao entrar.",
        );
        return errorResponse(translated, signInResponse.status);
      }

      const responseHeaders = new Headers();
      for (const cookie of readSetCookieHeaders(signInResponse.headers)) {
        responseHeaders.append("set-cookie", cookie);
      }

      await clearRateLimitForEmail({ email });

      return successResponse<VerifyOtpResponse>(
        { success: true, signedIn: true },
        "Conta verificada com sucesso.",
        200,
        undefined,
        responseHeaders,
      );
    }

    return successResponse<VerifyOtpResponse>(
      { success: true, signedIn: false },
      "Conta verificada com sucesso.",
    );
  } catch (error) {
    console.error("❌ [API_SIGN_UP_EMAIL_VERIFY_OTP] Erro ao verificar OTP:", {
      error,
    });
    return errorResponse("Erro ao verificar código.", 500);
  }
}
