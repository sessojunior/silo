import { NextRequest } from "next/server";
import { requireAdminAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api-response";

// GET - Buscar histórico de uma tarefa específica
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const { taskId } = await params;

    // Verificar se a tarefa existe
    const task = await db
      .select()
      .from(schema.projectTask)
      .where(eq(schema.projectTask.id, taskId))
      .limit(1);

    if (task.length === 0) {
      return errorResponse("Tarefa não encontrada", 404);
    }

    // Buscar histórico da tarefa com dados do usuário
    const history = await db
      .select({
        id: schema.projectTaskHistory.id,
        action: schema.projectTaskHistory.action,
        fromStatus: schema.projectTaskHistory.fromStatus,
        toStatus: schema.projectTaskHistory.toStatus,
        fromSort: schema.projectTaskHistory.fromSort,
        toSort: schema.projectTaskHistory.toSort,
        details: schema.projectTaskHistory.details,
        createdAt: schema.projectTaskHistory.createdAt,
        user: {
          id: schema.authUser.id,
          name: schema.authUser.name,
          email: schema.authUser.email,
          image: schema.authUser.image,
        },
      })
      .from(schema.projectTaskHistory)
      .innerJoin(
        schema.authUser,
        eq(schema.projectTaskHistory.userId, schema.authUser.id),
      )
      .where(eq(schema.projectTaskHistory.taskId, taskId))
      .orderBy(desc(schema.projectTaskHistory.createdAt));

    return successResponse({
      task: task[0],
      history: history,
    });
  } catch (error) {
    console.error(
      "❌ [API_TASKS_HISTORY] Erro ao buscar histórico da tarefa:",
      { error },
    );
    return errorResponse("Erro interno do servidor", 500);
  }
}
