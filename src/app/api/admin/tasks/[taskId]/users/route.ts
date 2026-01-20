import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requireAdminAuthUser } from "@/lib/auth/server";
import { eq } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api-response";

// GET /api/admin/tasks/[taskId]/users - Buscar usuários associados a uma tarefa
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const { taskId } = await params;

    // Buscar usuários associados à tarefa
    const taskUsers = await db
      .select({
        id: schema.projectTaskUser.userId,
        role: schema.projectTaskUser.role,
        assignedAt: schema.projectTaskUser.assignedAt,
        name: schema.authUser.name,
        email: schema.authUser.email,
        image: schema.authUser.image,
      })
      .from(schema.projectTaskUser)
      .innerJoin(
        schema.authUser,
        eq(schema.projectTaskUser.userId, schema.authUser.id),
      )
      .where(eq(schema.projectTaskUser.taskId, taskId));

    return successResponse({ data: taskUsers });
  } catch (error) {
    console.error("❌ [API_TASKS_USERS] Erro ao buscar usuários da tarefa:", {
      error,
    });
    return errorResponse("Erro interno do servidor", 500);
  }
}

// POST /api/admin/tasks/[taskId]/users - Associar usuários a uma tarefa
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const { taskId } = await params;
    const { userIds, role = "assignee" } = await request.json();

    if (!userIds || !Array.isArray(userIds)) {
      return errorResponse("IDs de usuários são obrigatórios", 400);
    }

    // Remover associações existentes
    await db
      .delete(schema.projectTaskUser)
      .where(eq(schema.projectTaskUser.taskId, taskId));

    // Criar novas associações
    const taskUsersToCreate = userIds.map((userId: string) => ({
      taskId,
      userId,
      role,
      assignedAt: new Date(),
    }));

    if (taskUsersToCreate.length > 0) {
      await db.insert(schema.projectTaskUser).values(taskUsersToCreate);
    }

    return successResponse(
      { success: true },
      "Usuários associados com sucesso",
    );
  } catch (error) {
    console.error("❌ [API_TASKS_USERS] Erro ao associar usuários à tarefa:", {
      error,
    });
    return errorResponse("Erro interno do servidor", 500);
  }
}
