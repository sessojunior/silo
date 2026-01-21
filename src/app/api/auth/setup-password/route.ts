import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { authAccount, authUser, authVerification } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/hash";
import { parseRequestJson, successResponse, errorResponse } from "@/lib/api-response";
import { randomUUID } from "crypto";
import { z } from "zod";
import { isValidPassword } from "@/lib/auth/validate";
import { clearRateLimitForEmail } from "@/lib/rateLimit";

const SetupPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().trim().length(6),
  password: z
    .string()
    .min(8)
    .max(120)
    .refine(isValidPassword, "Senha inválida."),
  autoSignIn: z.boolean().optional(),
});

const OTP_MAX_ATTEMPTS = 5;
const OTP_RESET_MESSAGE = "Excesso tentativas inválidas. Comece novamente.";

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

export async function POST(req: NextRequest) {
  try {
    const parsedBody = await parseRequestJson(req, SetupPasswordSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { email, code, password, autoSignIn } = parsedBody.data;

    const attemptsIdentifier = `forget-password:attempts:${email}`;
    const now = new Date();
    const attemptsRow = await db.query.authVerification.findFirst({
      where: eq(authVerification.identifier, attemptsIdentifier),
    });

    if (attemptsRow && attemptsRow.expiresAt < now) {
      await db
        .delete(authVerification)
        .where(eq(authVerification.id, attemptsRow.id));
    } else if (attemptsRow) {
      const attempts = parseAttempts(attemptsRow.value);
      if (attempts >= OTP_MAX_ATTEMPTS) {
        return errorResponse(
          OTP_RESET_MESSAGE,
          429,
          { field: "code", resetFlow: true },
        );
      }
    }

    // 1. Verify OTP
    const verification = await (async (): Promise<{ success: boolean } | Response> => {
      try {
        const result = await auth.api.checkVerificationOTP({
          body: {
            email,
            otp: code,
            type: "forget-password",
          },
          headers: req.headers,
        });

        return { success: result?.success === true };
      } catch (error) {
        if (isOtpTooManyAttempts(error)) {
          return errorResponse(OTP_RESET_MESSAGE, 429, {
            field: "code",
            resetFlow: true,
          });
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
        return errorResponse(
          OTP_RESET_MESSAGE,
          429,
          { field: "code", resetFlow: true },
        );
      }

      return errorResponse("Código inválido ou expirado.", 400, {
        field: "code",
      });
    }

    await db
      .delete(authVerification)
      .where(eq(authVerification.identifier, attemptsIdentifier));

    // 2. Find user
    const user = await db.query.authUser.findFirst({
      where: eq(authUser.email, email),
    });

    if (!user) {
      return errorResponse("Usuário não encontrado.", 404);
    }

    // 3. Update password
    const hashedPassword = await hashPassword(password);

    // Check if account exists
    const account = await db.query.authAccount.findFirst({
      where: and(
        eq(authAccount.userId, user.id),
        eq(authAccount.providerId, "credential"),
      ),
    });

    if (account) {
      await db
        .update(authAccount)
        .set({ password: hashedPassword })
        .where(eq(authAccount.id, account.id));
    } else {
      await db.insert(authAccount).values({
        id: randomUUID(),
        userId: user.id,
        accountId: email,
        providerId: "credential",
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    if (autoSignIn) {
      const signInResponse = await auth.api.signInEmail({
        body: { email, password },
        headers: req.headers,
        asResponse: true,
      });

      if (signInResponse.ok) {
        const responseHeaders = new Headers();
        for (const cookie of readSetCookieHeaders(signInResponse.headers)) {
          responseHeaders.append("set-cookie", cookie);
        }
        await clearRateLimitForEmail({ email });
        return successResponse(
          { signedIn: true },
          "Senha definida com sucesso.",
          200,
          undefined,
          responseHeaders,
        );
      }
    }

    return successResponse({ signedIn: false }, "Senha definida com sucesso.");
  } catch (e) {
    console.error("❌ [API_SETUP_PASSWORD] Erro ao definir senha:", e);
    return errorResponse("Erro ao definir senha.", 500);
  }
}
