import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config } from "@/lib/config";
import type { Project, ProjectFormData } from "@/types/projects";
import ProjectsPage from "./page";

interface OffcanvasMockProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}

interface ProjectFormOffcanvasMockProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  onSubmit: (data: ProjectFormData) => Promise<void>;
  onDelete?: (project: Project) => void;
}

interface ProjectDeleteDialogMockProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  onConfirm: (projectId: string) => Promise<void>;
}

vi.mock("@silo/engine/format/toast", () => ({
  toast: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/components/admin/projects/project-form-offcanvas", () => ({
  default: function MockProjectFormOffcanvas({
    isOpen,
    onClose,
    project,
    onSubmit,
    onDelete,
  }: ProjectFormOffcanvasMockProps) {
    if (!isOpen) {
      return null;
    }

    const submitPayload: ProjectFormData = project
      ? {
          name: "Projeto Alfa Ajustado",
          shortDescription: "Resumo ajustado",
          description: "Descrição ajustada",
          startDate: "2025-05-02",
          endDate: "2025-05-30",
          priority: "urgent",
          status: "paused",
        }
      : {
          name: "Projeto Beta",
          shortDescription: "Resumo beta",
          description: "Descrição beta",
          startDate: "2025-05-01",
          endDate: "2025-05-31",
          priority: "high",
          status: "active",
        };

    return (
      <section role="dialog" aria-label={project ? "Editar projeto" : "Novo projeto"}>
        <div>{project?.name ?? "Novo projeto"}</div>
        <button
          type="button"
          onClick={async () => {
            await onSubmit(submitPayload);
            onClose();
          }}
        >
          {project ? "Salvar projeto" : "Enviar projeto"}
        </button>
        {project && onDelete ? (
          <button
            type="button"
            onClick={() => {
              onDelete(project);
              onClose();
            }}
          >
            Excluir projeto
          </button>
        ) : null}
      </section>
    );
  },
}));

vi.mock("@/components/admin/projects/project-delete-dialog", () => ({
  default: function MockProjectDeleteDialog({
    isOpen,
    onClose,
    project,
    onConfirm,
  }: ProjectDeleteDialogMockProps) {
    if (!isOpen || !project) {
      return null;
    }

    return (
      <section role="dialog" aria-label="Excluir projeto">
        <div>{project.name}</div>
        <button
          type="button"
          onClick={async () => {
            await onConfirm(project.id);
            onClose();
          }}
        >
          Confirmar exclusão
        </button>
      </section>
    );
  },
}));

vi.mock("@/components/ui/offcanvas", () => ({
  default: function MockOffcanvas({ open, title, children, onClose }: OffcanvasMockProps) {
    if (!open) {
      return null;
    }

    const accessibleName = typeof title === "string" ? title : undefined;

    return (
      <section role="dialog" aria-label={accessibleName}>
        <div>{title}</div>
        <div>{children}</div>
        <button type="button" onClick={onClose}>
          Close
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

vi.mock("@/components/admin/projects/project-stats-cards", () => ({
  default: function MockProjectStatsCards() {
    return <div data-testid="project-stats-cards" />;
  },
}));

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

function createProjectsFetchMock() {
  const projectsPathname = new URL(
    config.getApiUrl("/api/admin/projects"),
    "http://localhost",
  ).pathname;

  const projects = [
    {
      id: "project-1",
      name: "Projeto Alfa",
      shortDescription: "Resumo inicial",
      description: "Descrição inicial",
      startDate: "2025-05-01",
      endDate: "2025-05-10",
      priority: "medium" as const,
      status: "active" as const,
      createdAt: "2025-05-01T00:00:00.000Z",
      updatedAt: "2025-05-01T00:00:00.000Z",
    },
  ];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();

    if (requestUrl.pathname !== projectsPathname) {
      throw new Error(`Unexpected request: ${method} ${requestUrl.pathname}`);
    }

    if (method === "GET") {
      return jsonResponse({ success: true, data: projects });
    }

    if (method === "POST") {
      const body = parseJsonBody(init?.body);
      expect(body).toMatchObject({
        name: "Projeto Beta",
        shortDescription: "Resumo beta",
        description: "Descrição beta",
        startDate: "2025-05-01",
        endDate: "2025-05-31",
        priority: "high",
        status: "active",
      });

      const newProject = {
        id: "project-2",
        name: "Projeto Beta",
        shortDescription: "Resumo beta",
        description: "Descrição beta",
        startDate: "2025-05-01",
        endDate: "2025-05-31",
        priority: "high" as const,
        status: "active" as const,
        createdAt: "2025-05-02T00:00:00.000Z",
        updatedAt: "2025-05-02T00:00:00.000Z",
      };

      projects.unshift(newProject);
      return jsonResponse({ success: true, data: newProject });
    }

    if (method === "PUT") {
      const body = parseJsonBody(init?.body);
      expect(body).toMatchObject({
        id: "project-1",
        name: "Projeto Alfa Ajustado",
        shortDescription: "Resumo ajustado",
        description: "Descrição ajustada",
        startDate: "2025-05-02",
        endDate: "2025-05-30",
        priority: "urgent",
        status: "paused",
      });

      const updatedProject = {
        ...projects[0],
        name: "Projeto Alfa Ajustado",
        shortDescription: "Resumo ajustado",
        description: "Descrição ajustada",
        startDate: "2025-05-02",
        endDate: "2025-05-30",
        priority: "urgent" as const,
        status: "paused" as const,
        updatedAt: "2025-05-03T00:00:00.000Z",
      };

      projects[0] = updatedProject;
      return jsonResponse({ success: true, data: updatedProject });
    }

    if (method === "DELETE") {
      expect(requestUrl.searchParams.get("id")).toBe("project-1");
      projects.splice(
        projects.findIndex((project) => project.id === "project-1"),
        1,
      );
      return jsonResponse({ success: true, message: "Projeto excluído com sucesso." });
    }

    throw new Error(`Unexpected method: ${method}`);
  });

  return { fetchMock, getProjects: () => projects };
}

describe("ProjectsPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the project list through the raw array API contract", async () => {
    const { fetchMock } = createProjectsFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<ProjectsPage />);

    await screen.findByText("Projeto Alfa");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("creates a project through the JSON API contract", async () => {
    const { fetchMock } = createProjectsFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<ProjectsPage />);

    await screen.findByText("Projeto Alfa");
    fireEvent.click(screen.getByRole("button", { name: /novo projeto/i }));
    fireEvent.click(await screen.findByRole("button", { name: /enviar projeto/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    await screen.findByText("Projeto Beta");
  });

  it("updates and deletes a project through the JSON API contract", async () => {
    const { fetchMock } = createProjectsFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<ProjectsPage />);

    await screen.findByText("Projeto Alfa");

    fireEvent.click(screen.getByTitle("Editar projeto"));
    fireEvent.click(await screen.findByRole("button", { name: /salvar projeto/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        config.getApiUrl("/api/admin/projects"),
        expect.objectContaining({ method: "PUT" }),
      );
    });

    await screen.findByText("Projeto Alfa Ajustado");

    fireEvent.click(screen.getByTitle("Editar projeto"));
    fireEvent.click(await screen.findByRole("button", { name: /excluir projeto/i }));
    fireEvent.click(await screen.findByRole("button", { name: /confirmar exclusão/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        config.getApiUrl("/api/admin/projects?id=project-1"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    await waitFor(() => {
      expect(screen.queryByText("Projeto Alfa Ajustado")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Projeto Alfa")).not.toBeInTheDocument();
  });
});