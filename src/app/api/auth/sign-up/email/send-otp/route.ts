import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, parseRequestJson, successResponse } from "@/lib/api-response";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { authUser, authVerification } from "@/lib/db/schema";
import { getRateLimitStatus, isRateLimited, recordRateLimit } from "@/lib/rateLimit";

const SendOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  resend: z.boolean().optional(),
});

type SendOtpResponse = {
  cooldownSeconds: number;
};

const buildAttemptsIdentifier = (email: string): string =>
  `sign-up-email-verification:attempts:${email}`;

const getRequestIp = (req: NextRequest): string => {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
};

const WRONG_EMAIL_LIMIT = 10;
const WRONG_EMAIL_WINDOW_SECONDS = 5 * 60;

const RESEND_COOLDOWN_SECONDS = 90;
const RESEND_LIMIT = 8;
const RESEND_WINDOW_SECONDS = 10 * 60;

export async function POST(req: NextRequest) {
  try {
    const parsedBody = await parseRequestJson(req, SendOtpSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { email, resend } = parsedBody.data;

    const user = await db.query.authUser.findFirst({
      where: eq(authUser.email, email),
    });

    if (!user) {
      const ip = getRequestIp(req);
      const isLimited = await isRateLimited({
        email: "unknown",
        ip,
        route: "sign-up-email-verification-wrong-email",
        limit: WRONG_EMAIL_LIMIT,
        windowInSeconds: WRONG_EMAIL_WINDOW_SECONDS,
      });
      if (isLimited) {
        return errorResponse(
          "Muitas tentativas. Aguarde 5 minutos e tente novamente.",
          429,
          { field: "email" },
        );
      }

      await recordRateLimit({
        email: "unknown",
        ip,
        route: "sign-up-email-verification-wrong-email",
        windowInSeconds: WRONG_EMAIL_WINDOW_SECONDS,
      });

      return errorResponse("E-mail inexistente.", 404, { field: "email" });
    }

    const ip = getRequestIp(req);

    const cooldownStatus = await getRateLimitStatus({
      email,
      ip,
      route: "sign-up-email-verification-send-otp-cooldown",
      limit: 1,
      windowInSeconds: RESEND_COOLDOWN_SECONDS,
    });

    if (cooldownStatus.isLimited) {
      const retryAfter = cooldownStatus.retryAfterSeconds;
      return errorResponse(
        "Aguarde para reenviar o código.",
        429,
        { retryAfterSeconds: retryAfter },
        { "Retry-After": String(retryAfter) },
      );
    }

    const burstStatus = await getRateLimitStatus({
      email,
      ip,
      route: "sign-up-email-verification-send-otp-burst",
      limit: RESEND_LIMIT,
      windowInSeconds: RESEND_WINDOW_SECONDS,
    });

    if (burstStatus.isLimited) {
      const retryAfter = burstStatus.retryAfterSeconds;
      return errorResponse(
        "Muitas tentativas. Aguarde para reenviar o código.",
        429,
        { retryAfterSeconds: retryAfter },
        { "Retry-After": String(retryAfter) },
      );
    }

    const attemptsIdentifier = buildAttemptsIdentifier(email);
    await db
      .delete(authVerification)
      .where(eq(authVerification.identifier, attemptsIdentifier));

    await auth.api.sendVerificationOTP({
      body: {
        email,
        type: "email-verification",
      },
      headers: await headers(),
    });

    await recordRateLimit({
      email,
      ip,
      route: "sign-up-email-verification-send-otp-cooldown",
      windowInSeconds: RESEND_COOLDOWN_SECONDS,
    });

    await recordRateLimit({
      email,
      ip,
      route: "sign-up-email-verification-send-otp-burst",
      windowInSeconds: RESEND_WINDOW_SECONDS,
    });

    return successResponse<SendOtpResponse>(
      { cooldownSeconds: RESEND_COOLDOWN_SECONDS },
      resend ? "Código reenviado para seu e-mail." : "Código enviado para seu e-mail.",
    );
  } catch (error) {
    console.error("❌ [API_SIGN_UP_EMAIL_SEND_OTP] Erro ao enviar OTP:", { error });
    return errorResponse("Erro ao enviar código.", 500);
  }
}

