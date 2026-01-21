import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { authAccount, authUser } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/hash";
import { headers } from "next/headers";
import { parseRequestJson, successResponse, errorResponse } from "@/lib/api-response";
import { randomUUID } from "crypto";
import { z } from "zod";
import { isValidPassword } from "@/lib/auth/validate";

const SetupPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().trim().length(6),
  password: z
    .string()
    .min(8)
    .max(120)
    .refine(isValidPassword, "Senha inválida."),
});

export async function POST(req: NextRequest) {
  try {
    const parsedBody = await parseRequestJson(req, SetupPasswordSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { email, code, password } = parsedBody.data;

    // 1. Verify OTP
    const verification = await auth.api.checkVerificationOTP({
      body: {
        email,
        otp: code,
        type: "forget-password",
      },
      headers: await headers(),
    });

    if (!verification?.success) {
      return errorResponse("Código inválido ou expirado.", 400, {
        field: "code",
      });
    }

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

    return successResponse({ success: true }, "Senha definida com sucesso.");
  } catch (e) {
    console.error("❌ [API_SETUP_PASSWORD] Erro ao definir senha:", e);
    return errorResponse("Erro ao definir senha.", 500);
  }
}
