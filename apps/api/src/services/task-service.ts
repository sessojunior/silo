import { db } from "@silo/database";
import * as schema from "@silo/database/schema";
import { eq, desc } from "drizzle-orm";

async function findTaskById(taskId: string) {
  const task = await db.select().from(schema.projectTask).where(eq(schema.projectTask.id, taskId)).limit(1);
  return task[0] ?? null;
}

export async function getTaskHistory(taskId: string) {
  const task = await findTaskById(taskId);
  if (!task) return { error: "Tarefa não encontrada.", status: 404 };

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
    .innerJoin(schema.authUser, eq(schema.projectTaskHistory.userId, schema.authUser.id))
    .where(eq(schema.projectTaskHistory.taskId, taskId))
    .orderBy(desc(schema.projectTaskHistory.createdAt));

  return { task, history };
}

export async function getTaskUsers(taskId: string) {
  const task = await findTaskById(taskId);
  if (!task) return { error: "Tarefa não encontrada.", status: 404 };

  return db
    .select({
      id: schema.projectTaskUser.userId,
      role: schema.projectTaskUser.role,
      assignedAt: schema.projectTaskUser.assignedAt,
      name: schema.authUser.name,
      email: schema.authUser.email,
      image: schema.authUser.image,
    })
    .from(schema.projectTaskUser)
    .innerJoin(schema.authUser, eq(schema.projectTaskUser.userId, schema.authUser.id))
    .where(eq(schema.projectTaskUser.taskId, taskId));
}

export async function setTaskUsers(taskId: string, userIds: string[], role: string = "assignee") {
  const task = await findTaskById(taskId);
  if (!task) return { error: "Tarefa não encontrada.", status: 404 };

  await db.delete(schema.projectTaskUser).where(eq(schema.projectTaskUser.taskId, taskId));
  if (userIds.length > 0) {
    await db.insert(schema.projectTaskUser).values(
      userIds.map((userId) => ({ taskId, userId, role, assignedAt: new Date() })),
    );
  }
  return { ok: true };
}
