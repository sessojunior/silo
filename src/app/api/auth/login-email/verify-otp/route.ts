import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, parseRequestJson, successResponse } from "@/lib/api-response";
import { translateAuthError } from "@/lib/auth/i18n";
import { auth } from "@/lib/auth/server";
import { isValidDomain, isValidEmail } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import { authUser, authVerification } from "@/lib/db/schema";

const emailInputSchema = z
  .string()
  .trim()
  .toLowerCase()
  .superRefine((value, ctx) => {
    if (!isValidEmail(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Digite um e-mail válido.",
      });
      return;
    }
    if (!isValidDomain(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Apenas e-mails do domínio @inpe.br são permitidos.",
      });
    }
  });

const VerifyOtpSchema = z.object({
  email: emailInputSchema,
  code: z.string().trim().length(6, "Digite o código com 6 caracteres."),
});

type VerifyOtpResponse = {
  signedIn: true;
};

const OTP_MAX_ATTEMPTS = 5;
const OTP_RESET_MESSAGE = "Excesso tentativas inválidas. Comece novamente.";

const buildAttemptsIdentifier = (email: string): string =>
  `login-email:attempts:${email}`;

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

const getBetterAuthErrorMessage = (error: unknown): string | null => {
  if (typeof error !== "object" || error === null) return null;
  if (!("body" in error)) return null;

  const body = (error as { body?: unknown }).body;
  if (typeof body !== "object" || body === null) return null;
  if (!("message" in body)) return null;

  const message = (body as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
};

const normalizeErrorKey = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "_");
  return normalized.length > 0 ? normalized : null;
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

const isOtpInvalidOrExpired = (error: unknown): boolean => {
  const code = getBetterAuthErrorCode(error);
  if (!code) return false;
  return code === "INVALID_OTP" || code === "EXPIRED_OTP" || code === "OTP_EXPIRED";
};

const isOtpTooManyAttempts = (error: unknown): boolean =>
  getBetterAuthErrorCode(error) === "TOO_MANY_ATTEMPTS";

const readSetCookieHeaders = (headers: Headers): string[] => {
  const maybe = headers as unknown as { getSetCookie?: () => string[] };
  if (typeof maybe.getSetCookie === "function") return maybe.getSetCookie();
  const raw = headers.get("set-cookie");
  return raw ? [raw] : [];
};

const isInternalAuthResult = (
  value: unknown,
): value is { type: "invalid_otp" } | { type: "too_many" } => {
  if (typeof value !== "object" || value === null) return false;
  if (!("type" in value)) return false;
  const type = (value as { type?: unknown }).type;
  return type === "invalid_otp" || type === "too_many";
};

export async function POST(req: NextRequest) {
  try {
    const parsedBody = await parseRequestJson(req, VerifyOtpSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { email, code } = parsedBody.data;

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
        return errorResponse(
          OTP_RESET_MESSAGE,
          429,
          { field: "code", resetFlow: true },
        );
      }
    }

    const signInResponse = await (async (): Promise<Response | null | { type: "invalid_otp" } | { type: "too_many" }> => {
      try {
        const response = await auth.api.signInEmailOTP({
          body: { email, otp: code },
          headers: req.headers,
          asResponse: true,
        });

        if (response.ok) return response;

        const payload = await readBetterAuthErrorPayload(response);
        const candidates = [
          normalizeErrorKey(payload?.code),
          normalizeErrorKey(payload?.message),
        ].filter((value): value is string => Boolean(value));

        if (candidates.includes("TOO_MANY_ATTEMPTS")) {
          return { type: "too_many" };
        }

        if (
          candidates.includes("INVALID_OTP") ||
          candidates.includes("OTP_EXPIRED") ||
          candidates.includes("EXPIRED_OTP")
        ) {
          return { type: "invalid_otp" };
        }

        const translated = translateAuthError(
          {
            code: payload?.code,
            message: payload?.message,
            status: response.status,
          },
          "Erro ao entrar. Verifique suas credenciais.",
        );

        return errorResponse(translated, response.status, { field: "code" });
      } catch (error) {
        if (isOtpTooManyAttempts(error)) {
          return { type: "too_many" };
        }

        if (isOtpInvalidOrExpired(error)) return { type: "invalid_otp" };

        const translated = translateAuthError(
          {
            code: getBetterAuthErrorCode(error) ?? undefined,
            message: getBetterAuthErrorMessage(error) ?? undefined,
          },
          "Erro ao entrar. Verifique suas credenciais.",
        );

        return errorResponse(translated, 400, { field: "code" });
      }
    })();

    if (signInResponse === null) return errorResponse("Erro ao verificar código.", 500);

    if (isInternalAuthResult(signInResponse)) {
      if (signInResponse.type === "too_many") {
        return errorResponse(
          OTP_RESET_MESSAGE,
          429,
          { field: "code", resetFlow: true },
        );
      }
    } else if (signInResponse instanceof Response) {
      if (!signInResponse.ok) return signInResponse;

      if (attemptsRow) {
        await db
          .delete(authVerification)
          .where(eq(authVerification.id, attemptsRow.id));
      } else {
        await db
          .delete(authVerification)
          .where(eq(authVerification.identifier, attemptsIdentifier));
      }

      const responseHeaders = new Headers();
      for (const cookie of readSetCookieHeaders(signInResponse.headers)) {
        responseHeaders.append("set-cookie", cookie);
      }

      return successResponse<VerifyOtpResponse>(
        { signedIn: true },
        "Login realizado com sucesso!",
        200,
        undefined,
        responseHeaders,
      );
    }

    if (!isInternalAuthResult(signInResponse) || signInResponse.type !== "invalid_otp") {
      return errorResponse("Erro ao verificar código.", 500);
    }

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

    return errorResponse("Código inválido ou expirado.", 400, { field: "code" });
  } catch (error) {
    console.error("❌ [API_LOGIN_EMAIL_VERIFY_OTP] Erro ao verificar OTP:", {
      error,
    });
    return errorResponse("Erro ao verificar código.", 500);
  }
}
