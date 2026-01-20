import { successResponse, errorResponse } from "@/lib/api-response";
import { and, or, isNull, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requireAdminAuthUser } from "@/lib/auth/server";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;
    const user = authResult.user;

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get("groupId");
    const userId = searchParams.get("userId");

    let totalCount = 0;

    if (groupId) {
      // Verificar se usuário participa do grupo
      const isMember = await db
        .select()
        .from(schema.userGroup)
        .where(
          and(
            eq(schema.userGroup.userId, user.id),
            eq(schema.userGroup.groupId, groupId),
          ),
        )
        .limit(1);

      if (isMember.length === 0) {
        return errorResponse("Usuário não participa deste grupo", 403);
      }

      // Contar mensagens do grupo
      const result = await db
        .select({ count: schema.chatMessage.id })
        .from(schema.chatMessage)
        .where(
          and(
            eq(schema.chatMessage.receiverGroupId, groupId),
            isNull(schema.chatMessage.deletedAt),
          ),
        );

      totalCount = result.length;
    } else if (userId) {
      // Contar mensagens da conversa entre usuários
      const result = await db
        .select({ count: schema.chatMessage.id })
        .from(schema.chatMessage)
        .where(
          and(
            or(
              // Mensagens enviadas pelo usuário atual para o target
              and(
                eq(schema.chatMessage.senderUserId, user.id),
                eq(schema.chatMessage.receiverUserId, userId),
              ),
              // Mensagens recebidas do target pelo usuário atual
              and(
                eq(schema.chatMessage.senderUserId, userId),
                eq(schema.chatMessage.receiverUserId, user.id),
              ),
            ),
            isNull(schema.chatMessage.deletedAt),
          ),
        );

      totalCount = result.length;
    } else {
      return errorResponse("Especifique groupId ou userId", 400);
    }

    return successResponse({
      totalCount,
    });
  } catch (error) {
    console.error("Erro ao contar mensagens:", error);
    return errorResponse("Erro ao contar mensagens.", 500);
  }
}
