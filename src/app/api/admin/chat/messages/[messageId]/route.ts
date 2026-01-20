import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requireAdminAuthUser } from "@/lib/auth/server";

// PATCH: Marcar userMessage como lida
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;
    const user = authResult.user;

    const { messageId } = await params;

    // Buscar userMessage recebida pelo usuário atual e ainda não lida
    const message = await db
      .select()
      .from(schema.chatMessage)
      .where(
        and(
          eq(schema.chatMessage.id, messageId),
          eq(schema.chatMessage.receiverUserId, user.id), // Apenas userMessage recebidas
          isNull(schema.chatMessage.readAt), // Ainda não lida
          isNull(schema.chatMessage.deletedAt), // Não excluída
        ),
      )
      .limit(1);

    if (message.length === 0) {
      return errorResponse(
        "Mensagem não encontrada, já lida ou não é uma conversa privada",
        404,
      );
    }

    // Marcar como lida
    await db
      .update(schema.chatMessage)
      .set({ readAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.chatMessage.id, messageId));

    return successResponse({ success: true, readAt: new Date() });
  } catch (error) {
    console.error("Erro ao marcar mensagem como lida:", error);
    return errorResponse("Erro ao marcar mensagem como lida.", 500);
  }
}

// DELETE: Excluir mensagem (apenas até 24h após envio)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;
    const user = authResult.user;

    const { messageId } = await params;

    // Buscar mensagem enviada pelo usuário atual
    const message = await db
      .select()
      .from(schema.chatMessage)
      .where(
        and(
          eq(schema.chatMessage.id, messageId),
          eq(schema.chatMessage.senderUserId, user.id), // Apenas próprias mensagens
          isNull(schema.chatMessage.deletedAt), // Ainda não excluída
        ),
      )
      .limit(1);

    if (message.length === 0) {
      return errorResponse(
        "Mensagem não encontrada ou você não tem permissão para excluí-la",
        404,
      );
    }

    const msg = message[0];

    // Verificar se ainda pode excluir (até 24h)
    const now = new Date();
    const createdAt = new Date(msg.createdAt);
    const hoursSinceCreated =
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceCreated > 24) {
      return errorResponse(
        "Prazo para exclusão expirado (máximo 24 horas)",
        400,
      );
    }

    // Soft delete - marcar como excluída
    await db
      .update(schema.chatMessage)
      .set({
        deletedAt: now,
        content: "[Mensagem excluída]", // Placeholder visual
      })
      .where(eq(schema.chatMessage.id, messageId));

    return successResponse({
      success: true,
      message: "Mensagem excluída com sucesso",
    });
  } catch (error) {
    console.error("Erro ao excluir mensagem:", error);
    return errorResponse("Erro ao excluir mensagem.", 500);
  }
}
