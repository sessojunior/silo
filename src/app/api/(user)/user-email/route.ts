import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { authUser } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth/server";
import { isValidEmail } from "@/lib/auth/validate";
import { sendEmail } from "@/lib/sendEmail";
import { successResponse, errorResponse } from "@/lib/api-response";

// Altera os dados do perfil do usuário logado
export async function PUT(req: NextRequest) {
  try {
    // Verifica se o usuário está logado e obtém os dados do usuário
    const user = await getAuthUser();
    if (!user) return errorResponse("Usuário não logado.", 401);

    // Obtem os dados recebidos
    const body = await req.json();
    const newEmail = (body.email as string)?.trim().toLowerCase();

    if (!isValidEmail(newEmail)) {
      return errorResponse("O e-mail é inválido.", 400, { field: "email" });
    }

    // Verifica se o e-mail informado é o mesmo que o atual
    if (newEmail === user.email) {
      return errorResponse("O e-mail informado é o mesmo que o atual.", 400, {
        field: "email",
      });
    }

    // Atualiza o e-mail do usuário no banco de dados
    const [updateUser] = await db
      .update(authUser)
      .set({ email: newEmail })
      .where(eq(authUser.id, user.id))
      .returning();
    if (!updateUser) {
      return errorResponse(
        "Ocorreu um erro ao alterar o e-mail do usuário.",
        500,
      );
    }

    // Envia um e-mail ao antigo e-mail avisando que o e-mail foi alterado
    // Usando template moderno com fallback para texto simples
    await sendEmail({
      to: user.email,
      subject: `E-mail alterado para ${newEmail}`,
      template: "emailChanged",
      data: { oldEmail: user.email, newEmail },
      text: `O seu e-mail para utilização no Silo foi alterado de ${user.email} para ${newEmail}.`, // Fallback
    });

    // Envia um e-mail ao novo e-mail avisando que o e-mail foi alterado
    // Usando template moderno com fallback para texto simples
    await sendEmail({
      to: newEmail,
      subject: `E-mail alterado para ${newEmail}`,
      template: "emailChanged",
      data: { oldEmail: user.email, newEmail },
      text: `O seu e-mail para utilização no Silo foi alterado de ${user.email} para ${newEmail}.`, // Fallback
    });

    // Retorna a resposta com sucesso
    return successResponse({ message: "E-mail alterado com sucesso!" });
  } catch (error) {
    console.error("❌ [API_USER_EMAIL] Erro ao alterar o e-mail do usuário:", {
      error,
    });
    return errorResponse("Erro inesperado. Tente novamente.", 500);
  }
}
