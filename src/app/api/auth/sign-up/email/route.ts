import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { errorResponse, parseRequestJson, successResponse } from "@/lib/api-response";
import { translateAuthError } from "@/lib/auth/i18n";
import { auth } from "@/lib/auth/server";
import { isValidDomain, isValidEmail, isValidName, isValidPassword } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import { authVerification } from "@/lib/db/schema";
import { getRateLimitStatus, recordRateLimit } from "@/lib/rateLimit";
import { eq } from "drizzle-orm";

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
      return;
    }
    if (!isValidDomain(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Apenas e-mails do domínio @inpe.br são permitidos.",
      });
    }
  });

const SignUpEmailSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Digite um nome válido.")
    .max(120, "Digite um nome válido.")
    .superRefine((value, ctx) => {
      if (!isValidName(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Digite um nome válido.",
        });
      }
    }),
  email: emailInputSchema,
  password: z
    .string()
    .min(8, "Senha inválida.")
    .max(120, "Senha inválida.")
    .superRefine((value, ctx) => {
      if (!isValidPassword(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "A senha deve ter pelo menos 8 caracteres, com maiúsculas, minúsculas, número e caractere especial.",
        });
      }
    }),
});

type SignUpEmailResponse = {
  cooldownSeconds: number;
};

const SIGN_UP_COOLDOWN_SECONDS = 90;
const SIGN_UP_BURST_LIMIT = 8;
const SIGN_UP_BURST_WINDOW_SECONDS = 10 * 60;

const buildAttemptsIdentifier = (email: string): string =>
  `sign-up-email-verification:attempts:${email}`;

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

const isUserAlreadyExists = (params: {
  status: number;
  payload: { code?: string; message?: string } | null;
}): boolean => {
  if (params.status === 409) return true;
  const code = normalizeErrorKey(params.payload?.code);
  if (code === "USER_ALREADY_EXISTS") return true;
  const message = normalizeErrorKey(params.payload?.message);
  return message === "USER_ALREADY_EXISTS";
};

export async function POST(req: NextRequest) {
  try {
    const parsedBody = await parseRequestJson(req, SignUpEmailSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { name, email, password } = parsedBody.data;

    const ip = getRequestIp(req);

    const cooldownStatus = await getRateLimitStatus({
      email,
      ip,
      route: "sign-up-email-cooldown",
      limit: 1,
      windowInSeconds: SIGN_UP_COOLDOWN_SECONDS,
    });

    if (cooldownStatus.isLimited) {
      const retryAfter = cooldownStatus.retryAfterSeconds;
      return errorResponse(
        "Aguarde para tentar novamente.",
        429,
        { retryAfterSeconds: retryAfter },
        { "Retry-After": String(retryAfter) },
      );
    }

    const burstStatus = await getRateLimitStatus({
      email,
      ip,
      route: "sign-up-email-burst",
      limit: SIGN_UP_BURST_LIMIT,
      windowInSeconds: SIGN_UP_BURST_WINDOW_SECONDS,
    });

    if (burstStatus.isLimited) {
      const retryAfter = burstStatus.retryAfterSeconds;
      return errorResponse(
        "Muitas tentativas. Aguarde para tentar novamente.",
        429,
        { retryAfterSeconds: retryAfter },
        { "Retry-After": String(retryAfter) },
      );
    }

    const response = await auth.api.signUpEmail({
      body: { name, email, password },
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
        "Erro ao criar conta.",
      );

      if (isUserAlreadyExists({ status: response.status, payload })) {
        return errorResponse(translated, 400, { field: "email" });
      }

      return errorResponse(translated, response.status);
    }

    await auth.api.sendVerificationOTP({
      body: {
        email,
        type: "email-verification",
      },
      headers: await headers(),
    });

    const attemptsIdentifier = buildAttemptsIdentifier(email);
    await db
      .delete(authVerification)
      .where(eq(authVerification.identifier, attemptsIdentifier));

    await recordRateLimit({
      email,
      ip,
      route: "sign-up-email-cooldown",
      windowInSeconds: SIGN_UP_COOLDOWN_SECONDS,
    });

    await recordRateLimit({
      email,
      ip,
      route: "sign-up-email-burst",
      windowInSeconds: SIGN_UP_BURST_WINDOW_SECONDS,
    });

    return successResponse<SignUpEmailResponse>(
      { cooldownSeconds: SIGN_UP_COOLDOWN_SECONDS },
      "Conta criada com sucesso. Verifique seu e-mail.",
      201,
    );
  } catch (error) {
    console.error("❌ [API_SIGN_UP_EMAIL] Erro ao criar conta:", { error });
    return errorResponse("Erro ao criar conta.", 500);
  }
}
