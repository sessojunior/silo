import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config } from "@/lib/config";
import type { ActivityFormData, Project, ProjectActivity } from "@/types/projects";
import ProjectDetailsPage from "./page";

const pageMocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ projectId: "550e8400-e29b-41d4-a716-446655440001" }),
  useRouter: () => ({ push: pageMocks.routerPush }),
}));

vi.mock("@silo/engine/format/toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/components/admin/projects/project-info-card", () => ({
  default: function MockProjectInfoCard({ project }: { project: Project }) {
    return <div data-testid="project-info-card">{project.name}</div>;
  },
}));

vi.mock("@/components/admin/projects/project-progress-card", () => ({
  default: function MockProjectProgressCard({ activities }: { activities: ProjectActivity[] }) {
    return <div data-testid="project-progress-card">{activities.length}</div>;
  },
}));

vi.mock("@/components/admin/projects/project-form-offcanvas", () => ({
  default: function MockProjectFormOffcanvas() {
    return null;
  },
}));

vi.mock("@/components/admin/projects/activity-mini-kanban", () => ({
  default: function MockActivityMiniKanban() {
    return null;
  },
}));

vi.mock("@/components/admin/projects/activity-form-offcanvas", () => ({
  default: function MockActivityFormOffcanvas({
    isOpen,
    activity,
    onSubmit,
    onClose,
  }: {
    isOpen: boolean;
    activity: ProjectActivity | null;
    onSubmit: (activityData: ActivityFormData) => Promise<void> | void;
    onClose: () => void;
  }) {
    if (!isOpen) {
      return null;
    }

    const nextActivityData: ActivityFormData = activity
      ? {
          name: "Planejamento da sprint revisado",
          description: "Escopo ajustado para a próxima sprint",
          category: "Planejamento",
          estimatedDays: 5,
          startDate: "2025-05-02",
          endDate: "2025-05-06",
          priority: "high",
          status: "progress",
        }
      : {
          name: "Nova atividade de integração",
          description: "Atividade criada via teste",
          category: "Desenvolvimento",
          estimatedDays: 2,
          startDate: "2025-05-07",
          endDate: "2025-05-09",
          priority: "medium",
          status: "todo",
        };

    return (
      <section
        role="dialog"
        aria-label={activity ? "Editar atividade" : "Nova atividade"}
      >
        <div>{activity ? "Editar atividade" : "Nova atividade"}</div>
        <button
          type="button"
          onClick={() => {
            void onSubmit(nextActivityData);
          }}
        >
          Salvar atividade
        </button>
        <button type="button" onClick={onClose}>
          Fechar
        </button>
      </section>
    );
  },
}));

vi.mock("@/components/ui/loading-spinner", () => ({
  default: function MockLoadingSpinner() {
    return <div data-testid="loading-spinner" />;
  },
}));

type JsonValue = Record<string, unknown>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function parseJsonBody(body: BodyInit | null | undefined): JsonValue {
  if (typeof body !== "string") {
    throw new Error("Expected JSON string body");
  }

  return JSON.parse(body) as JsonValue;
}

function createProjectDetailsFetchMock(
  project: Project,
  initialActivities: ProjectActivity[],
) {
  const projectsPathname = new URL(
    config.getApiUrl("/api/admin/projects"),
    "http://localhost",
  ).pathname;
  const activitiesPathname = new URL(
    config.getApiUrl(`/api/admin/projects/${project.id}/activities`),
    "http://localhost",
  ).pathname;

  let activities = initialActivities.map((activity) => ({ ...activity }));
  let nextActivitySequence = activities.length + 1;

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();

    if (
      requestUrl.pathname === projectsPathname &&
      requestUrl.searchParams.get("id") === project.id &&
      method === "GET"
    ) {
      return jsonResponse({ success: true, data: [project] });
    }

    if (requestUrl.pathname === activitiesPathname && method === "GET") {
      return jsonResponse({
        success: true,
        data: { activities },
        activities,
      });
    }

    if (requestUrl.pathname === activitiesPathname && method === "POST") {
      const body = parseJsonBody(init?.body);
      const nextActivity: ProjectActivity = {
        id: `550e8400-e29b-41d4-a716-4466554400${String(nextActivitySequence).padStart(2, "0")}`,
        projectId: project.id,
        name: String(body.name),
        description: body.description === null ? null : String(body.description),
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
        priority: String(body.priority ?? "medium") as ProjectActivity["priority"],
        status: String(body.status ?? "todo") as ProjectActivity["status"],
        createdAt: "2025-05-03T00:00:00.000Z",
        updatedAt: "2025-05-03T00:00:00.000Z",
      };

      activities = [nextActivity, ...activities];
      nextActivitySequence += 1;

      return jsonResponse(
        {
          success: true,
          data: { activity: nextActivity },
          activity: nextActivity,
          message: "Atividade criada com sucesso",
        },
        201,
      );
    }

    if (requestUrl.pathname === activitiesPathname && method === "PUT") {
      const body = parseJsonBody(init?.body);
      const updatedId = String(body.id);

      const currentActivity = activities.find((activity) => activity.id === updatedId);
      if (!currentActivity) {
        return jsonResponse(
          {
            success: false,
            error: "Atividade não encontrada.",
          },
          404,
        );
      }

      const updatedActivity: ProjectActivity = {
        ...currentActivity,
        name: String(body.name),
        description: body.description === null ? null : String(body.description),
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
        priority: String(body.priority ?? currentActivity.priority) as ProjectActivity["priority"],
        status: String(body.status ?? currentActivity.status) as ProjectActivity["status"],
        updatedAt: "2025-05-04T00:00:00.000Z",
      };

      activities = activities.map((activity) =>
        activity.id === updatedId ? updatedActivity : activity,
      );

      return jsonResponse({
        success: true,
        data: { activity: updatedActivity },
        activity: updatedActivity,
        message: "Atividade atualizada com sucesso",
      });
    }

    if (
      requestUrl.pathname.startsWith(`${activitiesPathname}/`) &&
      requestUrl.pathname.endsWith("/tasks") &&
      method === "GET"
    ) {
      return jsonResponse({
        success: true,
        data: {
          tasks: {
            todo: [],
            in_progress: [],
            blocked: [],
            review: [],
            done: [],
          },
        },
      });
    }

    throw new Error(`Unexpected request: ${method} ${requestUrl.pathname}`);
  });

  return {
    fetchMock,
    getActivities: () => activities,
  };
}

const projectId = "550e8400-e29b-41d4-a716-446655440001";
const activityId = "550e8400-e29b-41d4-a716-446655440010";

const baseProject: Project = {
  id: projectId,
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

const baseActivity: ProjectActivity = {
  id: activityId,
  projectId,
  name: "Planejamento da sprint",
  description: "Definir o escopo da próxima sprint",
  category: "Planejamento",
  estimatedDays: 3,
  startDate: "2025-05-02",
  endDate: "2025-05-04",
  priority: "medium",
  status: "todo",
  createdAt: "2025-05-01T00:00:00.000Z",
  updatedAt: "2025-05-01T00:00:00.000Z",
};

describe("ProjectDetailsPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("creates and updates activities from the project details screen", async () => {
    const { fetchMock, getActivities } = createProjectDetailsFetchMock(baseProject, [
      baseActivity,
    ]);

    vi.stubGlobal("fetch", fetchMock);

    render(<ProjectDetailsPage />);

    await screen.findByTestId("project-info-card");
    await screen.findByText(baseActivity.name);

    fireEvent.click(screen.getByTitle("Editar atividade"));

    const editDialog = await screen.findByRole("dialog", { name: "Editar atividade" });
    fireEvent.click(within(editDialog).getByRole("button", { name: "Salvar atividade" }));

    await screen.findByText("Planejamento da sprint revisado");

    expect(getActivities()).toHaveLength(1);

    const putCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        new URL(String(url), "http://localhost").pathname.endsWith("/activities") &&
        init?.method === "PUT",
    );

    expect(putCall).toBeDefined();
    const putBody = parseJsonBody(putCall?.[1]?.body);
    expect(putBody).toMatchObject({
      id: activityId,
      name: "Planejamento da sprint revisado",
      description: "Escopo ajustado para a próxima sprint",
      category: "Planejamento",
      estimatedDays: 5,
      startDate: "2025-05-02",
      endDate: "2025-05-06",
      priority: "high",
    });

    fireEvent.click(screen.getByRole("button", { name: /nova atividade/i }));

    const createDialog = await screen.findByRole("dialog", { name: "Nova atividade" });
    fireEvent.click(within(createDialog).getByRole("button", { name: "Salvar atividade" }));

    await screen.findByText("Nova atividade de integração");

    expect(getActivities()).toHaveLength(2);

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        new URL(String(url), "http://localhost").pathname.endsWith("/activities") &&
        init?.method === "POST",
    );

    expect(postCall).toBeDefined();
    const postBody = parseJsonBody(postCall?.[1]?.body);
    expect(postBody).toMatchObject({
      name: "Nova atividade de integração",
      description: "Atividade criada via teste",
      category: "Desenvolvimento",
      estimatedDays: 2,
      startDate: "2025-05-07",
      endDate: "2025-05-09",
      priority: "medium",
      status: "todo",
    });
  });
});
