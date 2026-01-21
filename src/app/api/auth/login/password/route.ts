import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, parseRequestJson, successResponse } from "@/lib/api-response";
import { translateAuthError } from "@/lib/auth/i18n";
import { auth } from "@/lib/auth/server";
import { isValidEmail } from "@/lib/auth/validate";
import { clearRateLimitForEmail, getRateLimitStatus, recordRateLimit } from "@/lib/rateLimit";

const getRequestIp = (req: NextRequest): string => {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
};

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
    }
  });

const LoginPasswordSchema = z.object({
  email: emailInputSchema,
  password: z.string().min(1, "Digite sua senha."),
});

type LoginPasswordResponse = {
  signedIn: true;
};

const LOGIN_PASSWORD_MAX_ATTEMPTS = 5;
const LOGIN_PASSWORD_WINDOW_SECONDS = 5 * 60;
const LOGIN_PASSWORD_WAIT_MESSAGE = "Aguarde para tentar novamente.";

const readSetCookieHeaders = (headers: Headers): string[] => {
  const maybe = headers as unknown as { getSetCookie?: () => string[] };
  if (typeof maybe.getSetCookie === "function") return maybe.getSetCookie();
  const raw = headers.get("set-cookie");
  return raw ? [raw] : [];
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

const isInvalidEmailOrPassword = (params: {
  status: number;
  payload: { code?: string; message?: string } | null;
}): boolean => {
  if (params.status === 401) return true;
  const code = normalizeErrorKey(params.payload?.code);
  if (code === "INVALID_EMAIL_OR_PASSWORD") return true;
  const message = normalizeErrorKey(params.payload?.message);
  return message === "INVALID_EMAIL_OR_PASSWORD";
};

export async function POST(req: NextRequest) {
  try {
    const parsedBody = await parseRequestJson(req, LoginPasswordSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { email, password } = parsedBody.data;

    const ip = getRequestIp(req);
    const rate = await getRateLimitStatus({
      email,
      ip,
      route: "login-password",
      limit: LOGIN_PASSWORD_MAX_ATTEMPTS,
      windowInSeconds: LOGIN_PASSWORD_WINDOW_SECONDS,
    });

    if (rate.isLimited) {
      return errorResponse(
        LOGIN_PASSWORD_WAIT_MESSAGE,
        429,
        { field: "email", retryAfterSeconds: rate.retryAfterSeconds },
        { "Retry-After": String(rate.retryAfterSeconds) },
      );
    }

    const response = await auth.api.signInEmail({
      body: { email, password },
      headers: req.headers,
      asResponse: true,
    });

    if (!response.ok) {
      const payload = await readBetterAuthErrorPayload(response);
      const translated = translateAuthError(
        {
          code: payload?.code,
          message: payload?.message,
          status: response.status,
        },
        "Erro ao entrar. Verifique suas credenciais.",
      );

      if (isInvalidEmailOrPassword({ status: response.status, payload })) {
        await recordRateLimit({
          email,
          ip,
          route: "login-password",
          windowInSeconds: LOGIN_PASSWORD_WINDOW_SECONDS,
        });

        const after = await getRateLimitStatus({
          email,
          ip,
          route: "login-password",
          limit: LOGIN_PASSWORD_MAX_ATTEMPTS,
          windowInSeconds: LOGIN_PASSWORD_WINDOW_SECONDS,
        });

        if (after.isLimited) {
          return errorResponse(
            LOGIN_PASSWORD_WAIT_MESSAGE,
            429,
            { field: "email", retryAfterSeconds: after.retryAfterSeconds },
            { "Retry-After": String(after.retryAfterSeconds) },
          );
        }

        return errorResponse("E-mail ou senha inválidos.", 401, { field: "password" });
      }

      return errorResponse(translated, response.status);
    }

    const responseHeaders = new Headers();
    for (const cookie of readSetCookieHeaders(response.headers)) {
      responseHeaders.append("set-cookie", cookie);
    }

    await clearRateLimitForEmail({ email });

    return successResponse<LoginPasswordResponse>(
      { signedIn: true },
      "Login realizado com sucesso!",
      200,
      undefined,
      responseHeaders,
    );
  } catch (error) {
    console.error("❌ [API_LOGIN_PASSWORD] Erro ao entrar:", { error });
    return errorResponse("Erro ao entrar.", 500);
  }
}
