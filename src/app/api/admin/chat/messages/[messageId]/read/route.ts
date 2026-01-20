import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { db } from "@/lib/db";
import { chatMessage } from "@/lib/db/schema";
import { eq, and, isNull, ne } from "drizzle-orm";
import { requireAdminAuthUser } from "@/lib/auth/server";

// POST: Marcar mensagem como lida
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    const { messageId } = await params;
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;
    const user = authResult.user;

    const userId = user.id;

    // Buscar a mensagem
    const message = await db
      .select()
      .from(chatMessage)
      .where(eq(chatMessage.id, messageId))
      .limit(1);

    if (message.length === 0) {
      return errorResponse("Mensagem não encontrada", 404);
    }

    const msg = message[0];

    // Verificar se o usuário atual é o destinatário da mensagem
    const isRecipient =
      msg.receiverUserId === userId || // Mensagem direta para o usuário
      (msg.receiverGroupId && msg.senderUserId !== userId); // Para grupos, qualquer membro exceto o remetente pode marcar como lida

    if (!isRecipient) {
      return errorResponse("Você não pode marcar esta mensagem como lida", 403);
    }

    // Verificar se já está marcada como lida
    if (msg.readAt) {
      return successResponse({
        success: true,
        message: "Mensagem já estava marcada como lida",
        readAt: msg.readAt,
      });
    }

    // Marcar como lida
    const now = new Date();
    await db
      .update(chatMessage)
      .set({
        readAt: now,
        updatedAt: now,
      })
      .where(eq(chatMessage.id, messageId));

    return successResponse(
      {
        success: true,
        message: "Mensagem marcada como lida",
        readAt: now,
      },
      "Mensagem marcada como lida",
    );
  } catch (error) {
    console.error("Erro ao marcar mensagem como lida:", error);
    return errorResponse("Erro ao marcar mensagem como lida.", 500);
  }
}

// PUT: Marcar múltiplas mensagens como lidas (para conversas)
export async function PUT(request: NextRequest) {
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
            ne(chatMessage.senderUserId, userId), // Mensagens de OUTROS usuários (não do próprio usuário)
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
    const messageIds = unreadMessages.map((msg) => msg.id);

    // Para múltiplas mensagens, fazer update individual
    for (const messageId of messageIds) {
      await db
        .update(chatMessage)
        .set({
          readAt: now,
          updatedAt: now,
        })
        .where(eq(chatMessage.id, messageId));
    }

    return successResponse({
      success: true,
      message: `${messageIds.length} mensagens marcadas como lidas`,
      updatedCount: messageIds.length,
      readAt: now,
    });
  } catch (error) {
    console.error(
      "❌ [API_CHAT_MESSAGES_MESSAGEID_READ] Erro ao marcar mensagens como lidas:",
      { error },
    );
    return errorResponse("Erro interno do servidor", 500);
  }
}
