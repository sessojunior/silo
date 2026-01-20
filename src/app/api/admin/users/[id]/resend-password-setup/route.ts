import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authUser, authAccount } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdminAuthUser } from "@/lib/auth/server";
import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";
import { successResponse, errorResponse } from "@/lib/api-response";

// Reenvia o email de setup de senha para um usuário que ainda não definiu senha
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const { id } = await params;

    if (!id) {
      return errorResponse("ID do usuário é obrigatório.", 400, {
        field: "id",
      });
    }

    // Buscar usuário
    const targetUser = await db.query.authUser.findFirst({
      where: eq(authUser.id, id),
    });

    if (!targetUser) {
      return errorResponse("Usuário não encontrado.", 404, { field: "id" });
    }

    // Verificar se o usuário já tem senha definida
    const account = await db.query.authAccount.findFirst({
      where: and(
        eq(authAccount.userId, targetUser.id),
        eq(authAccount.providerId, "credential"),
      ),
    });

    if (account?.password) {
      return errorResponse(
        "Este usuário já possui senha definida. Não é necessário reenviar o código de setup.",
        400,
      );
    }

    // Envia código OTP usando Better Auth
    await auth.api.sendVerificationOTP({
      body: {
        email: targetUser.email,
        type: "forget-password",
      },
      headers: await headers(),
    });

    return successResponse(
      { success: true },
      "Código OTP para definição de senha foi reenviado por email com sucesso.",
    );
  } catch (error) {
    console.error("❌ [API_RESEND_PASSWORD] Erro ao reenviar código:", {
      error,
    });
    return errorResponse("Erro interno do servidor", 500);
  }
}
