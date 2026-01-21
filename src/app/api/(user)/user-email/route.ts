import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { authUser } from "@/lib/db/schema";
import { requireAuthUser } from "@/lib/auth/server";
import { isValidEmail } from "@/lib/auth/validate";
import { sendEmail } from "@/lib/sendEmail";
import { parseRequestJson, successResponse, errorResponse } from "@/lib/api-response";
import { z } from "zod";

const UpdateEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .refine(isValidEmail, "O e-mail é inválido."),
});

// Altera os dados do perfil do usuário logado
export async function PUT(req: NextRequest) {
  try {
    const authResult = await requireAuthUser();
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;

    const parsedBody = await parseRequestJson(req, UpdateEmailSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const newEmail = parsedBody.data.email;

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
    return successResponse({}, "E-mail alterado com sucesso!");
  } catch (error) {
    console.error("❌ [API_USER_EMAIL] Erro ao alterar o e-mail do usuário:", {
      error,
    });
    return errorResponse("Erro inesperado. Tente novamente.", 500);
  }
}
