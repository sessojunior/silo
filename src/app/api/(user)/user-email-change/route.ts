import { NextRequest } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { authUser, authVerification } from "@/lib/db/schema";
import { requireAuthUser } from "@/lib/auth/server";
import { isValidEmail, isValidDomain } from "@/lib/auth/validate";
import { errorResponse, parseRequestJson, successResponse } from "@/lib/api-response";
import { isRateLimited, recordRateLimit } from "@/lib/rateLimit";
import { sendEmail } from "@/lib/sendEmail";
import type { EmailTemplateData } from "@/lib/email/types";
import { randomUUID, randomInt } from "crypto";
import { z } from "zod";

// Solicita alteração de email - envia código OTP para o novo email
export const runtime = "nodejs";

const OTP_LENGTH = 6;
const OTP_TTL_SECONDS = 5 * 60;
const OTP_ALLOWED_ATTEMPTS = 3;
const OTP_RATE_LIMIT_MAX = 3;
const OTP_RATE_LIMIT_WINDOW_SECONDS = 60;

const getRequestIp = (req: NextRequest): string => {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
};

const generateNumericOtp = (): string =>
  String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");

const buildEmailChangeIdentifier = (userId: string, newEmail: string): string =>
  `email-change-otp-${userId}-${newEmail}`;

const splitStoredOtpValue = (
  value: string,
): { otp: string; attempts: number } | null => {
  const idx = value.lastIndexOf(":");
  if (idx <= 0 || idx === value.length - 1) return null;
  const otp = value.slice(0, idx);
  const attemptsRaw = value.slice(idx + 1);
  const attempts = Number.parseInt(attemptsRaw, 10);
  if (Number.isNaN(attempts) || attempts < 0) return null;
  return { otp, attempts };
};

const emailInputSchema = z
  .string()
  .trim()
  .toLowerCase()
  .superRefine((value, ctx) => {
    if (!isValidEmail(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "O e-mail é inválido." });
      return;
    }
    if (!isValidDomain(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Apenas e-mails do domínio @inpe.br são permitidos.",
      });
    }
  });

const requestEmailChangeSchema = z.object({
  email: emailInputSchema,
});

const confirmEmailChangeSchema = z.object({
  code: z.string().trim().min(1, "Código de verificação é obrigatório."),
  newEmail: emailInputSchema,
});

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuthUser();
    if (!authResult.ok) return authResult.response;
    const user = authResult.user;

    const parsedBody = await parseRequestJson(req, requestEmailChangeSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const newEmail = parsedBody.data.email;

    // Verifica se o e-mail informado é o mesmo que o atual
    if (newEmail === user.email) {
      return errorResponse(
        "O e-mail informado é o mesmo que o atual. Escolha um e-mail diferente.",
        400,
        { field: "email" },
      );
    }

    // Verifica se já existe um usuário com este email
    const existingUser = await db.query.authUser.findFirst({
      where: eq(authUser.email, newEmail),
    });
    if (existingUser) {
      return errorResponse(
        "Este e-mail já está sendo usado por outro usuário. Digite um e-mail diferente.",
        400,
        { field: "email" },
      );
    }

    const ip = getRequestIp(req);
    const isLimited = await isRateLimited({
      email: newEmail,
      ip,
      route: "user-email-change",
      limit: OTP_RATE_LIMIT_MAX,
      windowInSeconds: OTP_RATE_LIMIT_WINDOW_SECONDS,
    });
    if (isLimited) {
      return errorResponse(
        "Muitas tentativas. Aguarde um pouco e tente novamente.",
        429,
        { field: "email" },
      );
    }

    await recordRateLimit({ email: newEmail, ip, route: "user-email-change" });

    const otp = generateNumericOtp();
    const identifier = buildEmailChangeIdentifier(user.id, newEmail);
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

    await db.delete(authVerification).where(eq(authVerification.identifier, identifier));
    await db.insert(authVerification).values({
      id: randomUUID(),
      identifier,
      value: `${otp}:0`,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const otpTemplateData: EmailTemplateData["otpCode"] = {
      code: otp,
      type: "email-change",
    };

    const emailResult = await sendEmail({
      to: newEmail,
      subject: "Código de verificação para troca de e-mail",
      template: "otpCode",
      data: otpTemplateData,
      text: `Seu código de verificação é ${otp}.`,
    });

    if ("error" in emailResult) {
      await db
        .delete(authVerification)
        .where(eq(authVerification.identifier, identifier));
      return errorResponse(
        "Não foi possível enviar o código de verificação. Tente novamente.",
        500,
      );
    }

    return successResponse({}, "Código de verificação enviado para o novo e-mail.");
  } catch (error) {
    console.error(
      "❌ [API_USER_EMAIL_CHANGE] Erro ao solicitar alteração de e-mail:",
      { error },
    );
    return errorResponse(
      "Erro inesperado ao enviar código. Tente novamente.",
      500,
    );
  }
}

// Confirma alteração de email com código OTP
export async function PUT(req: NextRequest) {
  try {
    const authResult = await requireAuthUser();
    if (!authResult.ok) return authResult.response;
    const user = authResult.user;

    const parsedBody = await parseRequestJson(req, confirmEmailChangeSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { code, newEmail } = parsedBody.data;

    const conflictingUser = await db.query.authUser.findFirst({
      where: and(eq(authUser.email, newEmail), ne(authUser.id, user.id)),
    });
    if (conflictingUser) {
      return errorResponse(
        "Este e-mail já está sendo usado por outro usuário. Digite um e-mail diferente.",
        400,
        { field: "newEmail" },
      );
    }

    const identifier = buildEmailChangeIdentifier(user.id, newEmail);
    const verificationRow = await db.query.authVerification.findFirst({
      where: eq(authVerification.identifier, identifier),
    });
    if (!verificationRow || verificationRow.expiresAt < new Date()) {
      if (verificationRow) {
        await db
          .delete(authVerification)
          .where(eq(authVerification.id, verificationRow.id));
      }
      return errorResponse("Código inválido ou expirado.", 400, {
        field: "code",
      });
    }

    const parsed = splitStoredOtpValue(verificationRow.value);
    if (!parsed) {
      await db
        .delete(authVerification)
        .where(eq(authVerification.id, verificationRow.id));
      return errorResponse("Código inválido ou expirado.", 400, {
        field: "code",
      });
    }

    if (parsed.attempts >= OTP_ALLOWED_ATTEMPTS) {
      await db
        .delete(authVerification)
        .where(eq(authVerification.id, verificationRow.id));
      return errorResponse(
        "Muitas tentativas. Solicite um novo código.",
        429,
        { field: "code" },
      );
    }

    if (code !== parsed.otp) {
      await db
        .update(authVerification)
        .set({
          value: `${parsed.otp}:${parsed.attempts + 1}`,
          updatedAt: new Date(),
        })
        .where(eq(authVerification.id, verificationRow.id));

      return errorResponse("Código inválido ou expirado.", 400, {
        field: "code",
      });
    }

    // Atualiza o email do usuário
    await db
      .update(authUser)
      .set({
        email: newEmail,
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(authUser.id, user.id));

    await db
      .delete(authVerification)
      .where(eq(authVerification.id, verificationRow.id));

    return successResponse({ success: true }, "E-mail alterado com sucesso!");
  } catch (error) {
    console.error("❌ [API_USER_EMAIL_CHANGE] Erro ao alterar e-mail:", {
      error,
    });
    return errorResponse(
      "Erro inesperado ao alterar e-mail. Tente novamente.",
      500,
    );
  }
}
