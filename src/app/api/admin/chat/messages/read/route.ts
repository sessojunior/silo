import { successResponse, errorResponse } from "@/lib/api-response";
import { db } from "@/lib/db";
import { chatMessage } from "@/lib/db/schema";
import { eq, and, isNull, ne } from "drizzle-orm";
import { requireAdminAuthUser } from "@/lib/auth/server";
import { NextRequest } from "next/server";

// POST: Marcar todas as mensagens de uma conversa como lidas
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;
    const user = authResult.user;

    const userId = user.id;

    const { targetId, type } = await request.json();

    if (!targetId || !type) {
      return errorResponse("targetId e type são obrigatórios", 400);
    }

    // Buscar mensagens não lidas do usuário atual
    const whereCondition =
      type === "user"
        ? and(
            eq(chatMessage.receiverUserId, userId),
            eq(chatMessage.senderUserId, targetId),
            isNull(chatMessage.readAt),
          )
        : and(
            eq(chatMessage.receiverGroupId, targetId),
            ne(chatMessage.senderUserId, userId), // Mensagens de OUTROS usuários no grupo
            isNull(chatMessage.readAt),
          );

    const unreadMessages = await db
      .select()
      .from(chatMessage)
      .where(whereCondition);

    if (unreadMessages.length === 0) {
      return successResponse({
        success: true,
        message: "Nenhuma mensagem não lida encontrada",
        updatedCount: 0,
      });
    }

    // Marcar todas como lidas
    const now = new Date();

    // Para múltiplas mensagens, fazer update individual
    for (const msg of unreadMessages) {
      await db
        .update(chatMessage)
        .set({
          readAt: now,
          updatedAt: now,
        })
        .where(eq(chatMessage.id, msg.id));
    }

    return successResponse({
      success: true,
      message: `${unreadMessages.length} mensagens marcadas como lidas`,
      updatedCount: unreadMessages.length,
      readAt: now,
    });
  } catch (error) {
    console.error(
      "❌ [API_CHAT_MESSAGES_READ] Erro ao marcar mensagens como lidas:",
      { error },
    );
    return errorResponse("Erro interno do servidor", 500);
  }
}
