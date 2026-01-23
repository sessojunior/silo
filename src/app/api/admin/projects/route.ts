import { NextRequest } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";

import { db } from "@/lib/db";
import {
  project,
  projectActivity,
  projectTask,
  projectTaskHistory,
  projectTaskUser,
} from "@/lib/db/schema";
import { requirePermissionAuthUser } from "@/lib/permissions";
import { asc, eq, ilike, or, and, inArray } from "drizzle-orm";
import {
  parseRequestJson,
  parseRequestQuery,
  successResponse,
  errorResponse,
} from "@/lib/api-response";

export const runtime = "nodejs";

// Schema de validação para criação/edição de projetos
const ProjectSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(255, "Nome muito longo"),
  shortDescription: z
    .string()
    .min(1, "Descrição curta é obrigatória")
    .max(500, "Descrição curta muito longa"),
  description: z.string().min(1, "Descrição é obrigatória"),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z
    .enum(["active", "completed", "paused", "cancelled"])
    .default("active"),
});

const ListProjectsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["all", "active", "completed", "paused", "cancelled"]).optional(),
  priority: z.enum(["all", "low", "medium", "high", "urgent"]).optional(),
});

const UpdateProjectSchema = ProjectSchema.extend({
  id: z.string().uuid("ID do projeto é obrigatório"),
});

const DeleteProjectQuerySchema = z.object({
  id: z.string().uuid("ID do projeto é obrigatório"),
});

// GET - Listar projetos com filtros e busca
export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionAuthUser("projects", "list");
    if (!authResult.ok) return authResult.response;

    const parsedQuery = parseRequestQuery(request, ListProjectsQuerySchema);
    if (!parsedQuery.ok) return parsedQuery.response;
    const { search, status, priority } = parsedQuery.data;

    // Construir query com filtros de forma simplificada
    const whereConditions = [];

    if (search) {
      whereConditions.push(
        or(
          ilike(project.name, `%${search}%`),
          ilike(project.shortDescription, `%${search}%`),
          ilike(project.description, `%${search}%`),
        ),
      );
    }

    if (status && status !== "all") {
      whereConditions.push(eq(project.status, status));
    }

    if (priority && priority !== "all") {
      whereConditions.push(eq(project.priority, priority));
    }

    // Executar query
    let projects;
    if (whereConditions.length === 0) {
      projects = await db.select().from(project).orderBy(asc(project.name));
    } else if (whereConditions.length === 1) {
      projects = await db
        .select()
        .from(project)
        .where(whereConditions[0])
        .orderBy(asc(project.name));
    } else {
      projects = await db
        .select()
        .from(project)
        .where(and(...whereConditions))
        .orderBy(asc(project.name));
    }

    return successResponse(projects);
  } catch (error) {
    const errorInfo =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { error };
    console.error("❌ [API_PROJECTS] Erro ao buscar projetos:", errorInfo);
    return errorResponse("Erro interno do servidor", 500);
  }
}

// POST - Criar novo projeto
export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionAuthUser("projects", "create");
    if (!authResult.ok) return authResult.response;

    const parsedBody = await parseRequestJson(request, ProjectSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const validatedData = parsedBody.data;

    // Criar projeto
    const newProject = await db
      .insert(project)
      .values({
        id: randomUUID(),
        name: validatedData.name,
        shortDescription: validatedData.shortDescription,
        description: validatedData.description,
        startDate: validatedData.startDate || null,
        endDate: validatedData.endDate || null,
        priority: validatedData.priority,
        status: validatedData.status,
      })
      .returning();

    return successResponse(newProject[0], "Projeto criado com sucesso", 201);
  } catch (error) {
    const errorInfo =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { error };
    console.error("❌ [API_PROJECTS] Erro ao criar projeto:", errorInfo);
    return errorResponse("Erro interno do servidor", 500);
  }
}

// PUT - Atualizar projeto
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requirePermissionAuthUser("projects", "update");
    if (!authResult.ok) return authResult.response;

    const parsedBody = await parseRequestJson(request, UpdateProjectSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { id, ...validatedData } = parsedBody.data;

    // Atualizar projeto
    const updatedProject = await db
      .update(project)
      .set({
        name: validatedData.name,
        shortDescription: validatedData.shortDescription,
        description: validatedData.description,
        startDate: validatedData.startDate || null,
        endDate: validatedData.endDate || null,
        priority: validatedData.priority,
        status: validatedData.status,
        updatedAt: new Date(),
      })
      .where(eq(project.id, id))
      .returning();

    if (updatedProject.length === 0) {
      return errorResponse("Projeto não encontrado", 404);
    }

    return successResponse(updatedProject[0], "Projeto atualizado com sucesso");
  } catch (error) {
    const errorInfo =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { error };
    console.error("❌ [API_PROJECTS] Erro ao atualizar projeto:", errorInfo);
    return errorResponse("Erro interno do servidor", 500);
  }
}

// DELETE - Excluir projeto
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requirePermissionAuthUser("projects", "delete");
    if (!authResult.ok) return authResult.response;

    const parsedQuery = parseRequestQuery(request, DeleteProjectQuerySchema);
    if (!parsedQuery.ok) return parsedQuery.response;
    const { id } = parsedQuery.data;

    // Verificar se projeto existe
    const existingProject = await db
      .select()
      .from(project)
      .where(eq(project.id, id))
      .limit(1);

    if (existingProject.length === 0) {
      return errorResponse("Projeto não encontrado", 404);
    }

    // Executar exclusão em cascata usando transação
    await db.transaction(async (tx) => {
      // 1. Buscar todas as atividades do projeto
      // const activities = await tx.select({ id: projectActivity.id }).from(projectActivity).where(eq(projectActivity.projectId, id))
      // const activityIds = activities.map((a) => a.id)

      // 2. Buscar todas as tarefas do projeto
      const tasks = await tx
        .select({ id: projectTask.id })
        .from(projectTask)
        .where(eq(projectTask.projectId, id));
      const taskIds = tasks.map((t) => t.id);

      // 3. Excluir histórico das tarefas
      if (taskIds.length > 0) {
        await tx
          .delete(projectTaskHistory)
          .where(inArray(projectTaskHistory.taskId, taskIds));
      }

      // 4. Excluir associações usuário-tarefa
      if (taskIds.length > 0) {
        await tx
          .delete(projectTaskUser)
          .where(inArray(projectTaskUser.taskId, taskIds));
      }

      // 5. Excluir todas as tarefas
      await tx.delete(projectTask).where(eq(projectTask.projectId, id));

      // 6. Excluir todas as atividades
      await tx.delete(projectActivity).where(eq(projectActivity.projectId, id));

      // 7. Finalmente, excluir o projeto
      await tx.delete(project).where(eq(project.id, id));
    });

    return successResponse(null, "Projeto excluído com sucesso");
  } catch (error) {
    console.error("❌ [API_PROJECTS] Erro detalhado ao excluir projeto:", {
      error,
    });
    console.error("❌ [API_PROJECTS] Rastreamento de pilha:", {
      stack: error instanceof Error ? error.stack : "N/A",
    });
    console.error("❌ [API_PROJECTS] Tipo do erro:", { type: typeof error });
    console.error("❌ [API_PROJECTS] Mensagem do erro:", {
      message: error instanceof Error ? error.message : String(error),
    });

    return errorResponse("Erro interno do servidor", 500, {
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
