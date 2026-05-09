import { db } from "@silo/database";
import { projectActivity, projectTask, projectTaskHistory } from "@silo/database/schema";
import { and, asc, desc, eq } from "drizzle-orm";

export const PROJECT_TASK_STATUSES = ["todo", "in_progress", "blocked", "review", "done"] as const;

export type ProjectTaskStatus = (typeof PROJECT_TASK_STATUSES)[number];

export type ProjectTaskPosition = {
  taskId: string;
  status: ProjectTaskStatus;
  sort: number;
};

type ProjectTaskRow = typeof projectTask.$inferSelect;
type ProjectTaskView = Omit<ProjectTaskRow, "status"> & { status: ProjectTaskStatus };
type ProjectTaskDatabase = {
  select: typeof db.select;
  update: typeof db.update;
  insert: typeof db.insert;
};

type ProjectTaskSuccess<T> = {
  ok: true;
  data: T;
};

type ProjectTaskServiceError = {
  ok: false;
  error: string;
  status: number;
  tasks?: ProjectTaskView[];
};

type ProjectTaskConflictError = ProjectTaskServiceError & {
  status: 409;
  tasks: ProjectTaskView[];
};

type ProjectTaskGroups = ReturnType<typeof createTaskGroups>;

type ReorderTasksResult =
  | ProjectTaskSuccess<{ tasks: ProjectTaskView[] }>
  | ProjectTaskServiceError
  | ProjectTaskConflictError;

type ProjectTaskPayload = {
  name: string;
  description: string;
  category?: string | null;
  estimatedDays?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  priority: string;
  status: string;
};

type ProjectTaskCreateInput = ProjectTaskPayload & {
  projectId: string;
  projectActivityId: string;
};

type ProjectTaskUpdateInput = ProjectTaskCreateInput & {
  id: string;
};

type ProjectTaskMutationResult =
  | ProjectTaskSuccess<{ task: ProjectTaskView }>
  | ProjectTaskServiceError;

type ProjectTaskDeleteResult =
  | ProjectTaskSuccess<null>
  | ProjectTaskServiceError;

const createTaskGroups = () => ({
  todo: [] as ProjectTaskView[],
  in_progress: [] as ProjectTaskView[],
  blocked: [] as ProjectTaskView[],
  review: [] as ProjectTaskView[],
  done: [] as ProjectTaskView[],
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

const normalizeTaskRow = (task: ProjectTaskRow): ProjectTaskView => ({
  ...task,
  status: normalizeTaskStatus(task.status),
});

const sortTasksByPosition = (leftTask: ProjectTaskView, rightTask: ProjectTaskView) => {
  if (leftTask.sort !== rightTask.sort) {
    return leftTask.sort - rightTask.sort;
  }

  return leftTask.createdAt.getTime() - rightTask.createdAt.getTime();
};

const normalizeTextOrNull = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const findProjectActivity = async (
  database: ProjectTaskDatabase,
  projectId: string,
  activityId: string,
) => {
  const activity = await database
    .select({ id: projectActivity.id })
    .from(projectActivity)
    .where(and(eq(projectActivity.id, activityId), eq(projectActivity.projectId, projectId)))
    .limit(1);

  return activity[0] ?? null;
};

const selectProjectActivityTasks = async (
  database: ProjectTaskDatabase,
  projectId: string,
  activityId: string,
) => {
  return database
    .select()
    .from(projectTask)
    .where(and(eq(projectTask.projectId, projectId), eq(projectTask.projectActivityId, activityId)))
    .orderBy(asc(projectTask.sort), asc(projectTask.createdAt));
};

const findProjectTask = async (
  database: ProjectTaskDatabase,
  projectId: string,
  activityId: string,
  taskId: string,
) => {
  const rows = await database
    .select()
    .from(projectTask)
    .where(
      and(
        eq(projectTask.id, taskId),
        eq(projectTask.projectId, projectId),
        eq(projectTask.projectActivityId, activityId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
};

const getNextTaskSort = async (
  database: ProjectTaskDatabase,
  projectId: string,
  activityId: string,
  status: ProjectTaskStatus,
) => {
  const rows = await database
    .select({ sort: projectTask.sort })
    .from(projectTask)
    .where(
      and(
        eq(projectTask.projectId, projectId),
        eq(projectTask.projectActivityId, activityId),
        eq(projectTask.status, status),
      ),
    )
    .orderBy(desc(projectTask.sort))
    .limit(1);

  return (rows[0]?.sort ?? -1) + 1;
};

const buildTaskValues = (input: ProjectTaskPayload, status: ProjectTaskStatus, sort: number) => ({
  name: input.name.trim(),
  description: input.description.trim(),
  category: normalizeTextOrNull(input.category),
  estimatedDays: typeof input.estimatedDays === "number" ? input.estimatedDays : null,
  startDate: normalizeTextOrNull(input.startDate),
  endDate: normalizeTextOrNull(input.endDate),
  priority: input.priority,
  status,
  sort,
});

const buildTaskHistoryPayload = (
  task: ProjectTaskRow,
  status: ProjectTaskStatus,
  sort: number,
  userId: string,
) => ({
  taskId: task.id,
  userId,
  action: "created" as const,
  fromStatus: null,
  toStatus: status,
  fromSort: null,
  toSort: sort,
  details: {
    initialData: {
      name: task.name,
      description: task.description,
      category: task.category,
      estimatedDays: task.estimatedDays,
      startDate: task.startDate,
      endDate: task.endDate,
      priority: task.priority,
      status,
    },
  },
});

const readTaskValues = (task: ProjectTaskRow) => ({
  name: task.name,
  description: task.description,
  category: task.category,
  estimatedDays: task.estimatedDays,
  startDate: task.startDate,
  endDate: task.endDate,
  priority: task.priority,
  status: normalizeTaskStatus(task.status),
});

const detectChangedFields = (
  before: ReturnType<typeof readTaskValues>,
  after: ReturnType<typeof readTaskValues>,
) => {
  const changedFields: string[] = [];

  if (before.name !== after.name) changedFields.push("name");
  if (before.description !== after.description) changedFields.push("description");
  if (before.category !== after.category) changedFields.push("category");
  if (before.estimatedDays !== after.estimatedDays) changedFields.push("estimatedDays");
  if (before.startDate !== after.startDate) changedFields.push("startDate");
  if (before.endDate !== after.endDate) changedFields.push("endDate");
  if (before.priority !== after.priority) changedFields.push("priority");
  if (before.status !== after.status) changedFields.push("status");

  return changedFields;
};

const createPositionMap = (tasks: ProjectTaskPosition[]) => {
  const taskMap = new Map<string, ProjectTaskPosition>();

  for (const task of tasks) {
    if (taskMap.has(task.taskId)) {
      return null;
    }

    taskMap.set(task.taskId, task);
  }

  return taskMap;
};

const createNormalizedTaskMap = (tasks: ProjectTaskRow[]) => {
  return new Map(tasks.map((task) => [task.id, normalizeTaskRow(task)] as const));
};

const snapshotsMatch = (
  expected: Map<string, ProjectTaskPosition>,
  current: Map<string, ProjectTaskView>,
) => {
  if (expected.size !== current.size) {
    return false;
  }

  for (const [taskId, expectedTask] of expected.entries()) {
    const currentTask = current.get(taskId);

    if (
      !currentTask ||
      currentTask.status !== expectedTask.status ||
      currentTask.sort !== expectedTask.sort
    ) {
      return false;
    }
  }

  return true;
};

const toNormalizedTaskResponse = (tasks: ProjectTaskRow[]) => {
  return tasks.map(normalizeTaskRow);
};

class KanbanOutdatedError extends Error {
  tasks: ProjectTaskView[];

  constructor(tasks: ProjectTaskView[]) {
    super("KANBAN_OUTDATED");
    this.name = "KanbanOutdatedError";
    this.tasks = tasks;
  }
}

export async function listProjectActivityTasks(projectId: string, activityId: string) {
  const activity = await findProjectActivity(db, projectId, activityId);

  if (!activity) {
    return { ok: false as const, error: "Atividade não encontrada.", status: 404 };
  }

  const tasks = await selectProjectActivityTasks(db, projectId, activityId);
  const groupedTasks: ProjectTaskGroups = createTaskGroups();

  for (const task of tasks) {
    const normalizedTask = normalizeTaskRow(task);
    groupedTasks[normalizedTask.status].push(normalizedTask);
  }

  for (const status of Object.keys(groupedTasks) as Array<keyof typeof groupedTasks>) {
    groupedTasks[status].sort(sortTasksByPosition);
  }

  return { ok: true as const, data: { tasks: groupedTasks } };
}

export async function createProjectActivityTask(
  projectId: string,
  activityId: string,
  userId: string,
  data: ProjectTaskCreateInput,
): Promise<ProjectTaskMutationResult> {
  const activity = await findProjectActivity(db, projectId, activityId);

  if (!activity) {
    return { ok: false as const, error: "Atividade não encontrada.", status: 404 };
  }

  if (data.projectId !== projectId || data.projectActivityId !== activityId) {
    return { ok: false as const, error: "Dados da tarefa inválidos.", status: 400 };
  }

  const normalizedStatus = normalizeTaskStatus(data.status);

  const task = await db.transaction(async (tx) => {
    const sort = await getNextTaskSort(tx, projectId, activityId, normalizedStatus);
    const [createdTask] = await tx
      .insert(projectTask)
      .values({
        projectId,
        projectActivityId: activityId,
        ...buildTaskValues(data, normalizedStatus, sort),
      })
      .returning();

    if (!createdTask) {
      throw new Error("Falha ao criar tarefa.");
    }

    await tx.insert(projectTaskHistory).values(buildTaskHistoryPayload(createdTask, normalizedStatus, sort, userId));

    return normalizeTaskRow(createdTask);
  });

  return { ok: true as const, data: { task } };
}

export async function updateProjectActivityTask(
  projectId: string,
  activityId: string,
  userId: string,
  data: ProjectTaskUpdateInput,
): Promise<ProjectTaskMutationResult> {
  const activity = await findProjectActivity(db, projectId, activityId);

  if (!activity) {
    return { ok: false as const, error: "Atividade não encontrada.", status: 404 };
  }

  if (data.projectId !== projectId || data.projectActivityId !== activityId) {
    return { ok: false as const, error: "Dados da tarefa inválidos.", status: 400 };
  }

  const normalizedStatus = normalizeTaskStatus(data.status);

  const task = await db.transaction(async (tx) => {
    const currentTask = await findProjectTask(tx, projectId, activityId, data.id);

    if (!currentTask) {
      throw new Error("TASK_NOT_FOUND");
    }

    const currentValues = readTaskValues(currentTask);
    const nextValues = {
      name: data.name.trim(),
      description: data.description.trim(),
      category: normalizeTextOrNull(data.category),
      estimatedDays: typeof data.estimatedDays === "number" ? data.estimatedDays : null,
      startDate: normalizeTextOrNull(data.startDate),
      endDate: normalizeTextOrNull(data.endDate),
      priority: data.priority,
      status: normalizedStatus,
    };

    const nextSort = currentValues.status === nextValues.status
      ? currentTask.sort
      : await getNextTaskSort(tx, projectId, activityId, normalizedStatus);

    const [updatedTask] = await tx
      .update(projectTask)
      .set({
        ...buildTaskValues(data, normalizedStatus, nextSort),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projectTask.id, data.id),
          eq(projectTask.projectId, projectId),
          eq(projectTask.projectActivityId, activityId),
        ),
      )
      .returning();

    if (!updatedTask) {
      throw new Error("TASK_NOT_FOUND");
    }

    const updatedValues = readTaskValues(updatedTask);
    const changedFields = detectChangedFields(currentValues, updatedValues);

    if (changedFields.length > 0) {
      await tx.insert(projectTaskHistory).values({
        taskId: updatedTask.id,
        userId,
        action: "updated",
        fromStatus: currentValues.status,
        toStatus: updatedValues.status,
        fromSort: currentTask.sort,
        toSort: updatedTask.sort,
        details: {
          changedFields,
          oldValues: currentValues,
          newValues: updatedValues,
        },
      });
    }

    return normalizeTaskRow(updatedTask);
  }).catch((error) => {
    if (error instanceof Error && error.message === "TASK_NOT_FOUND") {
      return null;
    }

    throw error;
  });

  if (!task) {
    return { ok: false as const, error: "Tarefa não encontrada.", status: 404 };
  }

  return { ok: true as const, data: { task } };
}

export async function deleteProjectActivityTask(
  projectId: string,
  activityId: string,
  taskId: string,
): Promise<ProjectTaskDeleteResult> {
  const activity = await findProjectActivity(db, projectId, activityId);

  if (!activity) {
    return { ok: false as const, error: "Atividade não encontrada.", status: 404 };
  }

  const result = await db.transaction(async (tx) => {
    const deletedRows = await tx
      .delete(projectTask)
      .where(
        and(
          eq(projectTask.id, taskId),
          eq(projectTask.projectId, projectId),
          eq(projectTask.projectActivityId, activityId),
        ),
      )
      .returning({ id: projectTask.id });

    if (deletedRows.length === 0) {
      return null;
    }

    return { ok: true as const };
  });

  if (!result) {
    return { ok: false as const, error: "Tarefa não encontrada.", status: 404 };
  }

  return { ok: true as const, data: null };
}

export async function reorderProjectActivityTasks(
  projectId: string,
  activityId: string,
  userId: string,
  tasksBeforeMove: ProjectTaskPosition[],
  tasksAfterMove: ProjectTaskPosition[],
): Promise<ReorderTasksResult> {
  const activity = await findProjectActivity(db, projectId, activityId);

  if (!activity) {
    return { ok: false as const, error: "Atividade não encontrada.", status: 404 };
  }

  if (tasksBeforeMove.length === 0 || tasksAfterMove.length === 0) {
    return { ok: false as const, error: "Dados de movimentação inválidos.", status: 400 };
  }

  if (tasksBeforeMove.length !== tasksAfterMove.length) {
    return { ok: false as const, error: "Dados de movimentação inválidos.", status: 400 };
  }

  const normalizedBeforeMove = tasksBeforeMove.map((task) => ({
    ...task,
    status: normalizeTaskStatus(task.status),
  }));
  const normalizedAfterMove = tasksAfterMove.map((task) => ({
    ...task,
    status: normalizeTaskStatus(task.status),
  }));

  const beforeMap = createPositionMap(normalizedBeforeMove);
  const afterMap = createPositionMap(normalizedAfterMove);

  if (!beforeMap || !afterMap) {
    return { ok: false as const, error: "Dados de movimentação inválidos.", status: 400 };
  }

  if (beforeMap.size !== afterMap.size) {
    return { ok: false as const, error: "Dados de movimentação inválidos.", status: 400 };
  }

  for (const taskId of beforeMap.keys()) {
    if (!afterMap.has(taskId)) {
      return { ok: false as const, error: "Dados de movimentação inválidos.", status: 400 };
    }
  }

  try {
    const updatedTasks = await db.transaction(async (tx) => {
      const currentTasks = await selectProjectActivityTasks(tx, projectId, activityId);
      const currentTaskMap = new Map(currentTasks.map((task) => [task.id, task] as const));
      const currentNormalizedTaskMap = createNormalizedTaskMap(currentTasks);

      if (!snapshotsMatch(beforeMap, currentNormalizedTaskMap)) {
        throw new KanbanOutdatedError(toNormalizedTaskResponse(currentTasks));
      }

      const now = new Date();

      for (const nextTask of normalizedAfterMove) {
        const currentTask = currentTaskMap.get(nextTask.taskId);
        const normalizedCurrentTask = currentNormalizedTaskMap.get(nextTask.taskId);

        if (!currentTask || !normalizedCurrentTask) {
          throw new KanbanOutdatedError(toNormalizedTaskResponse(currentTasks));
        }

        if (
          normalizedCurrentTask.status === nextTask.status &&
          normalizedCurrentTask.sort === nextTask.sort
        ) {
          continue;
        }

        const updatedRows = await tx
          .update(projectTask)
          .set({
            status: nextTask.status,
            sort: nextTask.sort,
            updatedAt: now,
          })
          .where(
            and(
              eq(projectTask.id, nextTask.taskId),
              eq(projectTask.projectId, projectId),
              eq(projectTask.projectActivityId, activityId),
              eq(projectTask.status, currentTask.status),
              eq(projectTask.sort, currentTask.sort),
            ),
          )
          .returning({ id: projectTask.id });

        if (updatedRows.length === 0) {
          const freshTasks = await selectProjectActivityTasks(tx, projectId, activityId);
          throw new KanbanOutdatedError(toNormalizedTaskResponse(freshTasks));
        }

        await tx.insert(projectTaskHistory).values({
          taskId: nextTask.taskId,
          userId,
          action: "status_change",
          fromStatus: normalizedCurrentTask.status,
          toStatus: nextTask.status,
          fromSort: normalizedCurrentTask.sort,
          toSort: nextTask.sort,
          details: { kanbanMove: true },
        });
      }

      const refreshedTasks = await selectProjectActivityTasks(tx, projectId, activityId);
      return toNormalizedTaskResponse(refreshedTasks);
    });

    return { ok: true as const, data: { tasks: updatedTasks } };
  } catch (error) {
    if (error instanceof KanbanOutdatedError) {
      return { ok: false as const, error: "KANBAN_OUTDATED", status: 409, tasks: error.tasks };
    }

    throw error;
  }
}