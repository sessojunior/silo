import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth/server";
import { randomUUID } from "crypto";
import { successResponse, errorResponse } from "@/lib/api-response";

export const runtime = "nodejs";

// Obtém os dados de preferências do usuário logado
export async function GET() {
  try {
    // Verifica se o usuário está logado e obtém os dados do usuário
    const user = await getAuthUser();
    if (!user) return errorResponse("Usuário não logado.", 401);

    // Busca as preferências do usuário no banco de dados
    const findUserPreferences = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, user.id),
    });

    // Retorna as preferências do usuário
    return successResponse({ userPreferences: findUserPreferences ?? {} });
  } catch (error) {
    const errorInfo =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { error };
    console.error(
      "❌ [API_USER_PREFERENCES] Erro ao obter as preferências do usuário:",
      errorInfo,
    );
    return errorResponse("Erro inesperado. Tente novamente.", 500);
  }
}

// Altera as preferências do usuário logado
export async function PUT(req: NextRequest) {
  try {
    // Verifica se o usuário está logado e obtém os dados do usuário
    const user = await getAuthUser();
    if (!user) return errorResponse("Usuário não logado.", 401);

    // Obtem os dados recebidos
    const body = await req.json();
    const chatEnabled = body.chatEnabled;

    // Verifica se as preferências do usuário já existem no banco de dados pelo ID do usuário
    const findUserPreferences = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, user.id),
    });

    // Se as preferências do usuário ainda não existirem, cadastra as preferências do usuário
    if (!findUserPreferences) {
      // Insere as preferências do usuário no banco de dados
      const [insertUserPreferences] = await db
        .insert(userPreferences)
        .values({
          id: randomUUID(),
          userId: user.id,
          chatEnabled,
        })
        .returning();
      if (!insertUserPreferences)
        return errorResponse(
          "Ocorreu um erro ao salvar as preferências do usuário no banco de dados.",
          500,
        );

      // Retorna a resposta com sucesso
      return successResponse(null, "Preferências atualizadas com sucesso!");
    }

    // Se as preferências do usuário já existirem, atualiza os dados
    const [updateUserPreferences] = await db
      .update(userPreferences)
      .set({ chatEnabled })
      .where(eq(userPreferences.userId, user.id))
      .returning();
    if (!updateUserPreferences) {
      return errorResponse(
        "Ocorreu um erro ao alterar as preferências do usuário.",
        500,
      );
    }

    // Retorna a resposta com sucesso
    return successResponse(null, "Preferências atualizadas com sucesso!");
  } catch (error) {
    const errorInfo =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { error };
    console.error(
      "❌ [API_USER_PREFERENCES] Erro ao alterar as preferências do usuário:",
      errorInfo,
    );
    return errorResponse("Erro inesperado. Tente novamente.", 500);
  }
}
