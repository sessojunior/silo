import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config } from "@/lib/config";
import type { Project, ProjectTask, TaskFormData } from "@/types/projects";
import TaskKanbanPage from "./page";

const pageMocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  projectId: "550e8400-e29b-41d4-a716-446655440001",
  activityId: "550e8400-e29b-41d4-a716-446655440002",
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({
    projectId: pageMocks.projectId,
    activityId: pageMocks.activityId,
  }),
  useRouter: () => ({ push: pageMocks.routerPush }),
  notFound: vi.fn(),
}));

vi.mock("@silo/engine/format/toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/components/ui/loading-spinner", () => ({
  default: function MockLoadingSpinner() {
    return <div data-testid="loading-spinner" />;
  },
}));

vi.mock("@/components/admin/projects/task-history-modal", () => ({
  default: function MockTaskHistoryModal() {
    return null;
  },
}));

interface KanbanTaskLike {
  id: string;
  project_id: string;
  project_activity_id: string;
  name: string;
  description: string;
  category: string;
  estimated_days: number;
  status: "todo" | "in_progress" | "blocked" | "review" | "done";
  sort: number;
  start_date: string;
  end_date: string;
  priority: "low" | "medium" | "high" | "urgent";
  assignedUsers?: string[];
  assignedUsersDetails?: Array<{
    id: string;
    name: string;
    role: string;
    email: string;
    image: string | null;
  }>;
}

vi.mock("@/components/admin/projects/kanban-board", () => ({
  default: function MockKanbanBoard({
    tasks,
    onTasksReorder,
    onCreateTask,
    onEditTask,
    onViewHistory,
  }: {
    tasks?: KanbanTaskLike[];
    onTasksReorder?: (tasksBeforeMove: KanbanTaskLike[], tasksAfterMove: KanbanTaskLike[]) => void;
    onCreateTask?: (status: KanbanTaskLike["status"]) => void;
    onEditTask?: (task: KanbanTaskLike) => void;
    onViewHistory?: (task: KanbanTaskLike) => void;
  }) {
    const currentTasks = tasks ?? [];

    return (
      <section data-testid="kanban-board">
        <div data-testid="task-order">
          {currentTasks.map((task) => task.name).join(" | ")}
        </div>
        <button type="button" onClick={() => onCreateTask?.("todo")}>
          Nova tarefa
        </button>
        <button
          type="button"
          onClick={() =>
            onTasksReorder?.(
              currentTasks,
              [...currentTasks].reverse().map((task, index) => ({
                ...task,
                sort: index,
              })),
            )
          }
        >
          Reordenar tarefas
        </button>
        <div>
          {currentTasks.map((task) => (
            <article key={task.id} data-testid={`task-${task.id}`}>
              <span>{task.name}</span>
              <button
                type="button"
                title="Editar tarefa"
                onClick={() => onEditTask?.(task)}
              >
                Editar
              </button>
              <button
                type="button"
                title="Ver histórico"
                onClick={() => onViewHistory?.(task)}
              >
                Histórico
              </button>
            </article>
          ))}
        </div>
      </section>
    );
  },
}));

vi.mock("@/components/admin/projects/task-form-offcanvas", () => ({
  default: function MockTaskFormOffcanvas({
    isOpen,
    task,
    onSubmit,
    onDelete,
    onClose,
  }: {
    isOpen: boolean;
    task: KanbanTaskLike | null;
    onSubmit: (taskData: TaskFormData) => Promise<void> | void;
    onDelete?: (task: KanbanTaskLike) => Promise<void> | void;
    onClose: () => void;
  }) {
    if (!isOpen) {
      return null;
    }

    const nextTaskData: TaskFormData = task
      ? {
          name: "Tarefa revisada",
          description: "Descrição revisada",
          category: "Planejamento",
          estimatedDays: 3,
          startDate: "2025-05-12",
          endDate: "2025-05-14",
          priority: "urgent",
          status: "done",
          sort: 1,
          assignedUsers: ["user-3"],
        }
      : {
          name: "Nova tarefa de integração",
          description: "Tarefa criada via teste",
          category: "Desenvolvimento",
          estimatedDays: 2,
          startDate: "2025-05-09",
          endDate: "2025-05-11",
          priority: "high",
          status: "todo",
          sort: 0,
          assignedUsers: ["user-1", "user-2"],
        };

    return (
      <section role="dialog" aria-label={task ? "Editar tarefa" : "Nova tarefa"}>
        <div>{task ? "Editar tarefa" : "Nova tarefa"}</div>
        <button
          type="button"
          onClick={() => {
            void onSubmit(nextTaskData);
          }}
        >
          Salvar tarefa
        </button>
        {task && onDelete ? (
          <button
            type="button"
            onClick={() => {
              void onDelete(task);
            }}
          >
            Excluir tarefa
          </button>
        ) : null}
        <button type="button" onClick={onClose}>
          Fechar
        </button>
      </section>
    );
  },
}));

vi.mock("@/components/admin/projects/project-form-offcanvas", () => ({
  default: function MockProjectFormOffcanvas() {
    return null;
  },
}));

interface TaskUserRecord {
  id: string;
  role: string;
  assignedAt: string;
  name: string;
  email: string;
  image: string | null;
}

type TaskRecord = ProjectTask & {
  assignedUsers?: string[];
  assignedUsersDetails?: TaskUserRecord[];
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function parseJsonBody(body: BodyInit | null | undefined): Record<string, unknown> {
  if (typeof body !== "string") {
    throw new Error("Expected JSON string body");
  }

  return JSON.parse(body) as Record<string, unknown>;
}

function buildTaskUser(userId: string): TaskUserRecord {
  return {
    id: userId,
    role: "assignee",
    assignedAt: "2025-05-01T00:00:00.000Z",
    name: `Usuário ${userId.slice(-1)}`,
    email: `${userId}@example.com`,
    image: null,
  };
}

function groupTasks(tasks: TaskRecord[]) {
  const grouped = {
    todo: [] as TaskRecord[],
    in_progress: [] as TaskRecord[],
    blocked: [] as TaskRecord[],
    review: [] as TaskRecord[],
    done: [] as TaskRecord[],
  };

  for (const task of tasks) {
    const status = task.status as keyof typeof grouped;
    grouped[status].push(task);
  }

  for (const status of Object.keys(grouped) as Array<keyof typeof grouped>) {
    grouped[status].sort((left, right) => left.sort - right.sort);
  }

  return grouped;
}

function applyTaskOrdering(
  tasks: TaskRecord[],
  nextPositions: Array<{ taskId: string; status: TaskRecord["status"]; sort: number }>,
) {
  const positionMap = new Map(nextPositions.map((position) => [position.taskId, position] as const));

  return tasks
    .map((task) => {
      const nextPosition = positionMap.get(task.id);
      if (!nextPosition) {
        return task;
      }

      return {
        ...task,
        status: nextPosition.status,
        sort: nextPosition.sort,
      };
    })
    .sort((left, right) => left.sort - right.sort);
}

function createTaskKanbanFetchMock(
  project: Project,
  activity: ProjectTask,
  initialTasks: TaskRecord[],
) {
  const projectsPathname = new URL(
    config.getApiUrl("/api/admin/projects"),
    "http://localhost",
  ).pathname;
  const activitiesPathname = new URL(
    config.getApiUrl(`/api/admin/projects/${project.id}/activities`),
    "http://localhost",
  ).pathname;
  const tasksPathname = new URL(
    config.getApiUrl(`/api/admin/projects/${project.id}/activities/${activity.projectActivityId}/tasks`),
    "http://localhost",
  ).pathname;
  const taskUsersPrefix = new URL(config.getApiUrl("/api/admin/tasks/"), "http://localhost").pathname;

  let tasks = initialTasks.map((task) => ({ ...task }));
  const taskUsersById = new Map<string, TaskUserRecord[]>();
  let nextTaskSequence = tasks.length + 1;

  if (tasks[0]) {
    taskUsersById.set(tasks[0].id, [buildTaskUser("user-1")]);
  }

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();

    if (
      requestUrl.pathname === projectsPathname &&
      (requestUrl.searchParams.get("id") === project.id || requestUrl.searchParams.get("projectId") === project.id) &&
      method === "GET"
    ) {
      return jsonResponse({ success: true, data: [project] });
    }

    if (requestUrl.pathname === activitiesPathname && method === "GET") {
      return jsonResponse({
        success: true,
        data: { activities: [activity] },
        activities: [activity],
      });
    }

    if (requestUrl.pathname === tasksPathname && method === "GET") {
      return jsonResponse({
        success: true,
        data: { tasks: groupTasks(tasks) },
      });
    }

    if (requestUrl.pathname === tasksPathname && method === "POST") {
      const body = parseJsonBody(init?.body);
      const nextStatus = String(body.status ?? "todo") as TaskRecord["status"];
      const nextTask: TaskRecord = {
        id: `550e8400-e29b-41d4-a716-4466554400${String(nextTaskSequence).padStart(2, "0")}`,
        projectId: project.id,
        projectActivityId: activity.projectActivityId,
        name: String(body.name),
        description: String(body.description),
        category:
          body.category === null || body.category === undefined
            ? null
            : String(body.category),
        estimatedDays:
          typeof body.estimatedDays === "number"
            ? body.estimatedDays
            : body.estimatedDays === null || body.estimatedDays === undefined
              ? null
              : Number(body.estimatedDays),
        startDate:
          body.startDate === null || body.startDate === undefined
            ? null
            : String(body.startDate),
        endDate:
          body.endDate === null || body.endDate === undefined
            ? null
            : String(body.endDate),
        priority: String(body.priority ?? "medium") as TaskRecord["priority"],
        status: nextStatus,
        sort: tasks.filter((task) => task.status === nextStatus).length,
        createdAt: "2025-05-03T00:00:00.000Z",
        updatedAt: "2025-05-03T00:00:00.000Z",
      };

      tasks = [...tasks, nextTask];
      nextTaskSequence += 1;

      return jsonResponse(
        {
          success: true,
          data: { task: nextTask },
          task: nextTask,
          message: "Tarefa criada com sucesso",
        },
        201,
      );
    }

    if (requestUrl.pathname === tasksPathname && method === "PUT") {
      const body = parseJsonBody(init?.body);
      const updatedId = String(body.id);
      const currentTask = tasks.find((task) => task.id === updatedId);

      if (!currentTask) {
        return jsonResponse({ success: false, error: "Tarefa não encontrada." }, 404);
      }

      const nextStatus = String(body.status ?? currentTask.status) as TaskRecord["status"];
      const updatedTask: TaskRecord = {
        ...currentTask,
        name: String(body.name),
        description: String(body.description),
        category:
          body.category === null || body.category === undefined
            ? null
            : String(body.category),
        estimatedDays:
          typeof body.estimatedDays === "number"
            ? body.estimatedDays
            : body.estimatedDays === null || body.estimatedDays === undefined
              ? null
              : Number(body.estimatedDays),
        startDate:
          body.startDate === null || body.startDate === undefined
            ? null
            : String(body.startDate),
        endDate:
          body.endDate === null || body.endDate === undefined
            ? null
            : String(body.endDate),
        priority: String(body.priority ?? currentTask.priority) as TaskRecord["priority"],
        status: nextStatus,
        updatedAt: "2025-05-04T00:00:00.000Z",
      };

      tasks = tasks.map((task) => (task.id === updatedId ? updatedTask : task));
      taskUsersById.set(updatedId, [buildTaskUser("user-3")]);

      return jsonResponse({
        success: true,
        data: { task: updatedTask },
        task: updatedTask,
        message: "Tarefa atualizada com sucesso",
      });
    }

    if (requestUrl.pathname === tasksPathname && method === "DELETE") {
      const body = parseJsonBody(init?.body);
      const deletedId = String(body.id);

      tasks = tasks.filter((task) => task.id !== deletedId);
      taskUsersById.delete(deletedId);

      return jsonResponse({ success: true, message: "Tarefa excluída com sucesso" });
    }

    if (requestUrl.pathname === tasksPathname && method === "PATCH") {
      const body = parseJsonBody(init?.body);
      const nextPositions = Array.isArray(body.tasksAfterMove)
        ? body.tasksAfterMove.map((position) => ({
            taskId: String((position as { taskId?: unknown }).taskId),
            status: String((position as { status?: unknown }).status) as TaskRecord["status"],
            sort: Number((position as { sort?: unknown }).sort),
          }))
        : [];

      tasks = applyTaskOrdering(tasks, nextPositions);

      return jsonResponse({
        success: true,
        data: { tasks },
        tasks,
        message: "Movimentação salva com sucesso",
      });
    }

    if (
      requestUrl.pathname.startsWith(taskUsersPrefix) &&
      requestUrl.pathname.endsWith("/users") &&
      method === "GET"
    ) {
      const taskId = requestUrl.pathname.split("/").at(-2) ?? "";
      return jsonResponse({ success: true, data: taskUsersById.get(taskId) ?? [] });
    }

    if (
      requestUrl.pathname.startsWith(taskUsersPrefix) &&
      requestUrl.pathname.endsWith("/users") &&
      method === "POST"
    ) {
      const taskId = requestUrl.pathname.split("/").at(-2) ?? "";
      const body = parseJsonBody(init?.body);
      const userIds = Array.isArray(body.userIds) ? body.userIds.map(String) : [];
      const users = userIds.map(buildTaskUser);
      taskUsersById.set(taskId, users);

      return jsonResponse({ success: true, data: users, message: "Usuários associados com sucesso" });
    }

    throw new Error(`Unexpected request: ${method} ${requestUrl.pathname}`);
  });

  return {
    fetchMock,
    getTasks: () => tasks,
    getTaskUsers: (taskId: string) => taskUsersById.get(taskId) ?? [],
  };
}

const project: Project = {
  id: pageMocks.projectId,
  name: "Projeto Alfa",
  shortDescription: "Resumo do projeto",
  description: "Descrição completa do projeto",
  startDate: "2025-05-01",
  endDate: "2025-05-31",
  priority: "medium",
  status: "active",
  createdAt: "2025-05-01T00:00:00.000Z",
  updatedAt: "2025-05-01T00:00:00.000Z",
};

const activity: ProjectTask = {
  id: pageMocks.activityId,
  projectId: pageMocks.projectId,
  projectActivityId: pageMocks.activityId,
  name: "Sprint 1",
  description: "Planejamento da sprint",
  category: "Planejamento",
  estimatedDays: 5,
  startDate: "2025-05-01",
  endDate: "2025-05-07",
  priority: "medium",
  status: "todo",
  sort: 0,
  createdAt: "2025-05-01T00:00:00.000Z",
  updatedAt: "2025-05-01T00:00:00.000Z",
};

const initialTaskOne: TaskRecord = {
  id: "550e8400-e29b-41d4-a716-446655440010",
  projectId: pageMocks.projectId,
  projectActivityId: pageMocks.activityId,
  name: "Implementar autenticação",
  description: "Criar o fluxo de login da aplicação",
  category: "Desenvolvimento",
  estimatedDays: 2,
  startDate: "2025-05-06",
  endDate: "2025-05-08",
  priority: "high",
  status: "todo",
  sort: 0,
  createdAt: "2025-05-01T00:00:00.000Z",
  updatedAt: "2025-05-01T00:00:00.000Z",
};

const initialTaskTwo: TaskRecord = {
  id: "550e8400-e29b-41d4-a716-446655440011",
  projectId: pageMocks.projectId,
  projectActivityId: pageMocks.activityId,
  name: "Validar sessão",
  description: "Garantir que o token seja renovado",
  category: "Desenvolvimento",
  estimatedDays: 1,
  startDate: "2025-05-06",
  endDate: "2025-05-07",
  priority: "medium",
  status: "todo",
  sort: 1,
  createdAt: "2025-05-01T00:00:00.000Z",
  updatedAt: "2025-05-01T00:00:00.000Z",
};

describe("TaskKanbanPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("reorders tasks through the kanban board contract", async () => {
    const { fetchMock } = createTaskKanbanFetchMock(project, activity, [
      initialTaskOne,
      initialTaskTwo,
    ]);

    vi.stubGlobal("fetch", fetchMock);

    render(<TaskKanbanPage />);

    await screen.findByTestId("kanban-board");
    expect(screen.getByTestId("task-order")).toHaveTextContent(
      "Implementar autenticação | Validar sessão",
    );

    fireEvent.click(screen.getByRole("button", { name: "Reordenar tarefas" }));

    await waitFor(() => {
      expect(screen.getByTestId("task-order")).toHaveTextContent(
        "Validar sessão | Implementar autenticação",
      );
    });

    const patchCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        new URL(String(url), "http://localhost").pathname.endsWith("/tasks") &&
        init?.method === "PATCH",
    );

    expect(patchCall).toBeDefined();
    const patchBody = parseJsonBody(patchCall?.[1]?.body);
    expect(patchBody).toMatchObject({
      tasksBeforeMove: [
        { taskId: initialTaskOne.id, status: "todo", sort: 0 },
        { taskId: initialTaskTwo.id, status: "todo", sort: 1 },
      ],
      tasksAfterMove: [
        { taskId: initialTaskTwo.id, status: "todo", sort: 0 },
        { taskId: initialTaskOne.id, status: "todo", sort: 1 },
      ],
    });
  });

  it("creates, edits and deletes tasks from the kanban page", async () => {
    const { fetchMock, getTasks } = createTaskKanbanFetchMock(project, activity, [
      initialTaskOne,
    ]);

    vi.stubGlobal("fetch", fetchMock);

    render(<TaskKanbanPage />);

    await screen.findByTestId("kanban-board");
    expect(screen.getByTestId("task-order")).toHaveTextContent(initialTaskOne.name);

    fireEvent.click(screen.getAllByTitle("Editar tarefa")[0]);

    const editDialog = await screen.findByRole("dialog", { name: "Editar tarefa" });
    fireEvent.click(within(editDialog).getByRole("button", { name: "Salvar tarefa" }));

    await waitFor(() => {
      expect(screen.getByTestId("task-order")).toHaveTextContent("Tarefa revisada");
    });

    const putCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        new URL(String(url), "http://localhost").pathname.endsWith("/tasks") &&
        init?.method === "PUT",
    );
    expect(putCall).toBeDefined();
    const putBody = parseJsonBody(putCall?.[1]?.body);
    expect(putBody).toMatchObject({
      id: initialTaskOne.id,
      projectId: project.id,
      projectActivityId: activity.projectActivityId,
      name: "Tarefa revisada",
      description: "Descrição revisada",
      category: "Planejamento",
      estimatedDays: 3,
      startDate: "2025-05-12",
      endDate: "2025-05-14",
      priority: "urgent",
      status: "done",
    });

    fireEvent.click(screen.getAllByTitle("Editar tarefa")[0]);

    const deleteDialog = await screen.findByRole("dialog", { name: "Editar tarefa" });
    fireEvent.click(within(deleteDialog).getByRole("button", { name: "Excluir tarefa" }));

    await waitFor(() => {
      expect(screen.getByTestId("task-order")).not.toHaveTextContent("Tarefa revisada");
    });

    const deleteCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        new URL(String(url), "http://localhost").pathname.endsWith("/tasks") &&
        init?.method === "DELETE",
    );
    expect(deleteCall).toBeDefined();
    const deleteBody = parseJsonBody(deleteCall?.[1]?.body);
    expect(deleteBody).toMatchObject({ id: initialTaskOne.id });
    expect(getTasks()).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Nova tarefa" }));

    const createDialog = await screen.findByRole("dialog", { name: "Nova tarefa" });
    fireEvent.click(within(createDialog).getByRole("button", { name: "Salvar tarefa" }));

    await waitFor(() => {
      expect(screen.getByTestId("task-order")).toHaveTextContent(
        "Nova tarefa de integração",
      );
    });
    expect(getTasks()).toHaveLength(1);

    const createPostCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        new URL(String(url), "http://localhost").pathname.endsWith("/tasks") &&
        init?.method === "POST",
    );
    expect(createPostCall).toBeDefined();
    const createPostBody = parseJsonBody(createPostCall?.[1]?.body);
    expect(createPostBody).toMatchObject({
      projectId: project.id,
      projectActivityId: activity.projectActivityId,
      name: "Nova tarefa de integração",
      description: "Tarefa criada via teste",
      category: "Desenvolvimento",
      estimatedDays: 2,
      startDate: "2025-05-09",
      endDate: "2025-05-11",
      priority: "high",
      status: "todo",
    });
  });
});
