import { db } from "@silo/database";
import {
  project,
  projectActivity,
  projectTask,
  projectTaskHistory,
  projectTaskUser,
} from "@silo/database/schema";
import { asc, eq, ilike, or, and, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function listProjects(opts: {
  search?: string;
  status?: string;
  priority?: string;
}) {
  const { search, status, priority } = opts;
  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(project.name, `%${search}%`),
        ilike(project.shortDescription, `%${search}%`),
        ilike(project.description, `%${search}%`),
      ),
    );
  }
  if (status && status !== "all") conditions.push(eq(project.status, status));
  if (priority && priority !== "all") conditions.push(eq(project.priority, priority));

  if (conditions.length === 0) return db.select().from(project).orderBy(asc(project.name));
  if (conditions.length === 1) return db.select().from(project).where(conditions[0]).orderBy(asc(project.name));
  return db.select().from(project).where(and(...conditions)).orderBy(asc(project.name));
}

export async function createProject(data: {
  name: string;
  shortDescription: string;
  description: string;
  startDate?: string | null;
  endDate?: string | null;
  priority: string;
  status: string;
}) {
  const rows = await db
    .insert(project)
    .values({
      id: randomUUID(),
      name: data.name,
      shortDescription: data.shortDescription,
      description: data.description,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      priority: data.priority,
      status: data.status,
    })
    .returning();
  return rows[0];
}

export async function updateProject(data: {
  id: string;
  name: string;
  shortDescription: string;
  description: string;
  startDate?: string | null;
  endDate?: string | null;
  priority: string;
  status: string;
}) {
  const rows = await db
    .update(project)
    .set({
      name: data.name,
      shortDescription: data.shortDescription,
      description: data.description,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      priority: data.priority,
      status: data.status,
      updatedAt: new Date(),
    })
    .where(eq(project.id, data.id))
    .returning();
  if (rows.length === 0) return { error: "Projeto não encontrado.", status: 404 };
  return rows[0];
}

export async function deleteProject(id: string) {
  const existing = await db.select().from(project).where(eq(project.id, id)).limit(1);
  if (existing.length === 0) return { error: "Projeto não encontrado.", status: 404 };

  await db.transaction(async (tx) => {
    const tasks = await tx.select({ id: projectTask.id }).from(projectTask).where(eq(projectTask.projectId, id));
    const taskIds = tasks.map((t) => t.id);

    if (taskIds.length > 0) {
      await tx.delete(projectTaskHistory).where(inArray(projectTaskHistory.taskId, taskIds));
      await tx.delete(projectTaskUser).where(inArray(projectTaskUser.taskId, taskIds));
    }
    await tx.delete(projectTask).where(eq(projectTask.projectId, id));
    await tx.delete(projectActivity).where(eq(projectActivity.projectId, id));
    await tx.delete(project).where(eq(project.id, id));
  });

  return { ok: true };
}

// ── Project Activities ──────────────────────────────────────────────────────

export async function listProjectActivities(projectId: string) {
  const existingProject = await db.select().from(project).where(eq(project.id, projectId)).limit(1);
  if (existingProject.length === 0) return { error: "Projeto não encontrado.", status: 404 };
  return db.select().from(projectActivity).where(eq(projectActivity.projectId, projectId)).orderBy(projectActivity.createdAt);
}

export async function createProjectActivity(projectId: string, data: {
  name: string;
  description: string;
  category?: string | null;
  estimatedDays?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  priority?: string;
  status?: string;
}) {
  const existingProject = await db.select().from(project).where(eq(project.id, projectId)).limit(1);
  if (existingProject.length === 0) return { error: "Projeto não encontrado.", status: 404 };

  const rows = await db
    .insert(projectActivity)
    .values({
      projectId,
      name: data.name,
      description: data.description,
      category: data.category || null,
      estimatedDays: typeof data.estimatedDays === "number" ? data.estimatedDays : null,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      priority: (data.priority || "medium") as "low" | "medium" | "high" | "urgent",
      status: (data.status || "todo") as "todo" | "progress" | "done" | "blocked",
    })
    .returning();
  return rows[0];
}

export async function updateProjectActivity(projectId: string, data: {
  id: string;
  name: string;
  description: string;
  category?: string | null;
  estimatedDays?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  priority?: string;
  status?: string;
}) {
  const rows = await db
    .update(projectActivity)
    .set({
      name: data.name,
      description: data.description,
      category: data.category || null,
      estimatedDays: typeof data.estimatedDays === "number" ? data.estimatedDays : null,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      priority: (data.priority || "medium") as "low" | "medium" | "high" | "urgent",
      status: (data.status || "todo") as "todo" | "progress" | "done" | "blocked",
      updatedAt: new Date(),
    })
    .where(and(eq(projectActivity.id, data.id), eq(projectActivity.projectId, projectId)))
    .returning();
  if (rows.length === 0) return { error: "Atividade não encontrada.", status: 404 };
  return rows[0];
}

export async function deleteProjectActivity(projectId: string, activityId: string) {
  const result = await db
    .delete(projectActivity)
    .where(and(eq(projectActivity.id, activityId), eq(projectActivity.projectId, projectId)));
  if (!result.rowCount) return { error: "Atividade não encontrada.", status: 404 };
  return { ok: true };
}
