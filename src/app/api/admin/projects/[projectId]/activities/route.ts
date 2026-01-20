import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { projectActivity, project } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdminAuthUser } from "@/lib/auth/server";
import { successResponse, errorResponse } from "@/lib/api-response";

// GET /api/admin/projects/[projectId]/activities - Buscar todas as atividades de um projeto
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const { projectId } = await params;

    // Verificar se o projeto existe
    const existingProject = await db
      .select()
      .from(project)
      .where(eq(project.id, projectId))
      .limit(1);

    if (existingProject.length === 0) {
      return errorResponse("Projeto não encontrado", 404);
    }

    // Buscar todas as atividades do projeto
    const activities = await db
      .select()
      .from(projectActivity)
      .where(eq(projectActivity.projectId, projectId))
      .orderBy(projectActivity.createdAt);

    return successResponse({ activities });
  } catch (error) {
    console.error("❌ [API_PROJECTS_ACTIVITIES] Erro ao buscar atividades:", {
      error,
    });
    return errorResponse("Erro interno do servidor", 500);
  }
}

// POST /api/admin/projects/[projectId]/activities - Criar nova atividade
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const { projectId } = await params;
    const body = await request.json();

    // Validação dos dados obrigatórios
    if (!body.name || !body.description) {
      return errorResponse("Nome e descrição são obrigatórios", 400);
    }

    // Verificar se o projeto existe
    const existingProject = await db
      .select()
      .from(project)
      .where(eq(project.id, projectId))
      .limit(1);

    if (existingProject.length === 0) {
      return errorResponse("Projeto não encontrado", 404);
    }

    // Validar datas se fornecidas
    if (body.startDate && body.endDate && body.startDate > body.endDate) {
      return errorResponse(
        "Data de início deve ser anterior à data de fim",
        400,
      );
    }

    // Validar dias estimados se fornecido
    if (
      body.estimatedDays &&
      (isNaN(Number(body.estimatedDays)) || Number(body.estimatedDays) < 0)
    ) {
      return errorResponse(
        "Dias estimados deve ser um número válido e positivo",
        400,
      );
    }

    // Criar a atividade
    const newActivity = await db
      .insert(projectActivity)
      .values({
        projectId,
        name: body.name,
        description: body.description,
        category: body.category || null,
        estimatedDays: body.estimatedDays ? Number(body.estimatedDays) : null,
        startDate: body.startDate || null,
        endDate: body.endDate || null,
        priority: body.priority || "medium",
        status: body.status || "todo",
      })
      .returning();

    return successResponse(
      { activity: newActivity[0] },
      "Atividade criada com sucesso",
      201,
    );
  } catch (error) {
    console.error("❌ [API_PROJECTS_ACTIVITIES] Erro ao criar atividade:", {
      error,
    });
    return errorResponse("Erro interno do servidor", 500);
  }
}

// PUT /api/admin/projects/[projectId]/activities - Atualizar atividade
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const { projectId } = await params;
    const body = await request.json();

    // Validação do ID da atividade
    if (!body.id) {
      return errorResponse("ID da atividade é obrigatório", 400);
    }

    // Validação dos dados obrigatórios
    if (!body.name || !body.description) {
      return errorResponse("Nome e descrição são obrigatórios", 400);
    }

    // Verificar se a atividade existe e pertence ao projeto
    const existingActivity = await db
      .select()
      .from(projectActivity)
      .where(
        and(
          eq(projectActivity.id, body.id),
          eq(projectActivity.projectId, projectId),
        ),
      )
      .limit(1);

    if (existingActivity.length === 0) {
      return errorResponse("Atividade não encontrada", 404);
    }

    // Validar datas se fornecidas
    if (body.startDate && body.endDate && body.startDate > body.endDate) {
      return errorResponse(
        "Data de início deve ser anterior à data de fim",
        400,
      );
    }

    // Validar dias estimados se fornecido
    if (
      body.estimatedDays &&
      (isNaN(Number(body.estimatedDays)) || Number(body.estimatedDays) < 0)
    ) {
      return errorResponse(
        "Dias estimados deve ser um número válido e positivo",
        400,
      );
    }

    // Atualizar a atividade
    const updatedActivity = await db
      .update(projectActivity)
      .set({
        name: body.name,
        description: body.description,
        category: body.category || null,
        estimatedDays: body.estimatedDays ? Number(body.estimatedDays) : null,
        startDate: body.startDate || null,
        endDate: body.endDate || null,
        priority: body.priority || "medium",
        status: body.status || "todo",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projectActivity.id, body.id),
          eq(projectActivity.projectId, projectId),
        ),
      )
      .returning();

    return successResponse(
      { activity: updatedActivity[0] },
      "Atividade atualizada com sucesso",
    );
  } catch (error) {
    console.error("❌ [API_PROJECTS_ACTIVITIES] Erro ao atualizar atividade:", {
      error,
    });
    return errorResponse("Erro interno do servidor", 500);
  }
}

// DELETE /api/admin/projects/[projectId]/activities - Excluir atividade
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const { projectId } = await params;
    const { searchParams } = new URL(request.url);
    const activityId = searchParams.get("activityId");

    // Validação do ID da atividade
    if (!activityId) {
      return errorResponse("ID da atividade é obrigatório", 400);
    }

    // Verificar se a atividade existe e pertence ao projeto
    const existingActivity = await db
      .select()
      .from(projectActivity)
      .where(
        and(
          eq(projectActivity.id, activityId),
          eq(projectActivity.projectId, projectId),
        ),
      )
      .limit(1);

    if (existingActivity.length === 0) {
      return errorResponse("Atividade não encontrada", 404);
    }

    // Excluir a atividade
    await db
      .delete(projectActivity)
      .where(
        and(
          eq(projectActivity.id, activityId),
          eq(projectActivity.projectId, projectId),
        ),
      );

    return successResponse(null, "Atividade excluída com sucesso");
  } catch (error) {
    console.error("❌ [API_PROJECTS_ACTIVITIES] Erro ao excluir atividade:", {
      error,
    });
    return errorResponse("Erro interno do servidor", 500);
  }
}
