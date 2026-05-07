import { db } from "@silo/database";
import { projectActivity, projectTask } from "@silo/database/schema";
import { and, asc, eq } from "drizzle-orm";

type ProjectTaskStatus = "todo" | "in_progress" | "blocked" | "review" | "done";

type ProjectTaskRow = typeof projectTask.$inferSelect;

const createTaskGroups = () => ({
  todo: [] as ProjectTaskRow[],
  in_progress: [] as ProjectTaskRow[],
  blocked: [] as ProjectTaskRow[],
  review: [] as ProjectTaskRow[],
  done: [] as ProjectTaskRow[],
});

const normalizeTaskStatus = (status: string): ProjectTaskStatus => {
  switch (status) {
    case "todo":
      return "todo";
    case "in_progress":
    case "progress":
      return "in_progress";
    case "blocked":
      return "blocked";
    case "review":
      return "review";
    case "done":
      return "done";
    default:
      return "todo";
  }
};

export async function listProjectActivityTasks(projectId: string, activityId: string) {
  const activity = await db
    .select({ id: projectActivity.id })
    .from(projectActivity)
    .where(and(eq(projectActivity.id, activityId), eq(projectActivity.projectId, projectId)))
    .limit(1);

  if (activity.length === 0) {
    return { error: "Atividade não encontrada.", status: 404 };
  }

  const tasks = await db
    .select()
    .from(projectTask)
    .where(and(eq(projectTask.projectId, projectId), eq(projectTask.projectActivityId, activityId)))
    .orderBy(asc(projectTask.sort), asc(projectTask.createdAt));

  const groupedTasks = createTaskGroups();

  for (const task of tasks) {
    const normalizedStatus = normalizeTaskStatus(task.status);
    groupedTasks[normalizedStatus].push(task);
  }

  for (const status of Object.keys(groupedTasks) as Array<keyof typeof groupedTasks>) {
    groupedTasks[status].sort((leftTask, rightTask) => {
      if (leftTask.sort !== rightTask.sort) {
        return leftTask.sort - rightTask.sort;
      }

      return leftTask.createdAt.getTime() - rightTask.createdAt.getTime();
    });
  }

  return { tasks: groupedTasks };
}