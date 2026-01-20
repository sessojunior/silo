import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { authAccount } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth/server";
import { hashPassword } from "@/lib/auth/hash";
import { isValidPassword } from "@/lib/auth/validate";
import { sendEmail } from "@/lib/sendEmail";
import { successResponse, errorResponse } from "@/lib/api-response";
import { randomUUID } from "crypto";

// Altera os dados do perfil do usuário logado
export async function PUT(req: NextRequest) {
  try {
    // Verifica se o usuário está logado e obtém os dados do usuário
    const user = await getAuthUser();
    if (!user) return errorResponse("Usuário não logado.", 401);

    // Obtem os dados recebidos
    const body = await req.json();
    const password = body.password as string;

    if (!isValidPassword(password)) {
      return errorResponse("A senha é inválida.", 400, { field: "password" });
    }

    // Criptografa a senha
    const hashedPassword = await hashPassword(password);

    // Altera a senha do usuário na tabela de contas
    const updatePassword = await db
      .update(authAccount)
      .set({ password: hashedPassword })
      .where(
        and(
          eq(authAccount.userId, user.id),
          eq(authAccount.providerId, "credential"),
        ),
      )
      .returning();

    if (updatePassword.length === 0) {
      // Se não atualizou nada, pode ser que a conta não exista (ex: login social)
      // Tenta criar
      await db.insert(authAccount).values({
        id: randomUUID(),
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Envia um e-mail avisando que a senha foi alterada
    // Usando template moderno com fallback para texto simples
    await sendEmail({
      to: user.email,
      subject: `Senha alterada`,
      template: "passwordChanged",
      data: { email: user.email },
      text: `Sua senha no Silo foi alterada com sucesso.`, // Fallback
    });

    // Retorna a resposta com sucesso
    return successResponse({ message: "Senha alterada com sucesso!" });
  } catch (error) {
    console.error(
      "❌ [API_USER_PASSWORD] Erro ao alterar a senha do usuário:",
      { error },
    );
    return errorResponse("Erro inesperado. Tente novamente.", 500);
  }
}
