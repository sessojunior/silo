import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { userGroup } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdminAuthUser } from "@/lib/auth/server";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const groupId = searchParams.get("groupId");

    if (!userId || !groupId) {
      return errorResponse("userId e groupId são obrigatórios.", 400);
    }

    await db
      .delete(userGroup)
      .where(and(eq(userGroup.userId, userId), eq(userGroup.groupId, groupId)));

    return successResponse(null, "Usuário removido do grupo com sucesso.");
  } catch (error) {
    console.error("❌ [API_GROUPS_USERS] Erro ao remover usuário do grupo:", {
      error,
    });
    return errorResponse("Erro interno do servidor", 500);
  }
}
