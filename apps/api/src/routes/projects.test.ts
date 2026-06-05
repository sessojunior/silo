import express from "express";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authMiddleware: vi.fn((req: Request & { user?: { id: string } }, _res: Response, next: NextFunction) => {
    Object.assign(req, { user: { id: "user-1" } });
    next();
  }),
  requirePermission: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
  listProjects: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  listProjectActivities: vi.fn(),
  createProjectActivity: vi.fn(),
  updateProjectActivity: vi.fn(),
  deleteProjectActivity: vi.fn(),
  listProjectActivityTasks: vi.fn(),
  createProjectActivityTask: vi.fn(),
  updateProjectActivityTask: vi.fn(),
  deleteProjectActivityTask: vi.fn(),
  reorderProjectActivityTasks: vi.fn(),
}));

vi.mock("../middleware/auth.js", () => ({
  authMiddleware: mocks.authMiddleware,
}));

vi.mock("../middleware/permissions.js", () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock("../services/project-service.js", () => ({
  listProjects: mocks.listProjects,
  createProject: mocks.createProject,
  updateProject: mocks.updateProject,
  deleteProject: mocks.deleteProject,
  listProjectActivities: mocks.listProjectActivities,
  createProjectActivity: mocks.createProjectActivity,
  updateProjectActivity: mocks.updateProjectActivity,
  deleteProjectActivity: mocks.deleteProjectActivity,
}));

vi.mock("../services/project-task-service.js", () => ({
  listProjectActivityTasks: mocks.listProjectActivityTasks,
  createProjectActivityTask: mocks.createProjectActivityTask,
  updateProjectActivityTask: mocks.updateProjectActivityTask,
  deleteProjectActivityTask: mocks.deleteProjectActivityTask,
  reorderProjectActivityTasks: mocks.reorderProjectActivityTasks,
  PROJECT_TASK_STATUSES: ["todo", "in_progress", "blocked", "review", "done"],
}));

import projectsRouter from "./projects.js";

const projectUuid = "550e8400-e29b-41d4-a716-446655440000";
const activityUuid = "550e8400-e29b-41d4-a716-446655440010";

const baseActivity = {
  id: activityUuid,
  name: "Planejamento da sprint",
  description: "Definir o escopo da próxima sprint",
  category: "Planejamento",
  estimatedDays: 3,
  startDate: "2025-05-01",
  endDate: "2025-05-03",
  priority: "medium",
  status: "todo",
  projectId: projectUuid,
  createdAt: "2025-05-01T00:00:00.000Z",
  updatedAt: "2025-05-01T00:00:00.000Z",
};

const taskUuid = "550e8400-e29b-41d4-a716-446655440020";

const baseTask = {
  id: taskUuid,
  projectId: projectUuid,
  projectActivityId: activityUuid,
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

const groupedTaskPayload = {
  todo: [baseTask],
  in_progress: [],
  blocked: [],
  review: [],
  done: [],
};

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/projects", projectsRouter);
  return app;
}

describe("projects route", () => {
  it("lists projects and unwraps the service payload", async () => {
    mocks.listProjects.mockResolvedValue({
      ok: true,
      data: [{ id: "project-1", name: "Projeto Alfa" }],
    });

    const response = await request(createApp())
      .get("/api/projects")
      .query({
        search: "radar",
        status: "active",
        priority: "high",
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: [{ id: "project-1", name: "Projeto Alfa" }],
    });
    expect(mocks.listProjects).toHaveBeenCalledWith({
      search: "radar",
      status: "active",
      priority: "high",
    });
  });

  it("creates a project with the expected payload", async () => {
    mocks.createProject.mockResolvedValue({
      ok: true,
      data: { id: "project-2" },
    });

    const response = await request(createApp())
      .post("/api/projects")
      .send({
        name: "Projeto Beta",
        shortDescription: "Resumo do projeto",
        description: "Descrição completa do projeto",
        startDate: "2025-05-01",
        endDate: "2025-05-31",
        priority: "urgent",
        status: "paused",
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      data: { id: "project-2" },
      message: "Projeto criado com sucesso",
    });
    expect(mocks.createProject).toHaveBeenCalledWith({
      name: "Projeto Beta",
      shortDescription: "Resumo do projeto",
      description: "Descrição completa do projeto",
      startDate: "2025-05-01",
      endDate: "2025-05-31",
      priority: "urgent",
      status: "paused",
    });
  });

  it("updates a project and keeps the id contract", async () => {
    mocks.updateProject.mockResolvedValue({
      ok: true,
      data: {
        id: projectUuid,
        name: "Projeto Alfa Atualizado",
        shortDescription: "Resumo atualizado",
        description: "Descrição atualizada",
        startDate: "2025-05-01",
        endDate: "2025-05-20",
        priority: "high",
        status: "active",
      },
    });

    const response = await request(createApp())
      .put("/api/projects")
      .send({
        id: projectUuid,
        name: "Projeto Alfa Atualizado",
        shortDescription: "Resumo atualizado",
        description: "Descrição atualizada",
        startDate: "2025-05-01",
        endDate: "2025-05-20",
        priority: "high",
        status: "active",
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        id: projectUuid,
        name: "Projeto Alfa Atualizado",
        shortDescription: "Resumo atualizado",
        description: "Descrição atualizada",
        startDate: "2025-05-01",
        endDate: "2025-05-20",
        priority: "high",
        status: "active",
      },
      message: "Projeto atualizado com sucesso",
    });
    expect(mocks.updateProject).toHaveBeenCalledWith({
      id: projectUuid,
      name: "Projeto Alfa Atualizado",
      shortDescription: "Resumo atualizado",
      description: "Descrição atualizada",
      startDate: "2025-05-01",
      endDate: "2025-05-20",
      priority: "high",
      status: "active",
    });
  });

  it("deletes a project by the id query parameter", async () => {
    mocks.deleteProject.mockResolvedValue({
      ok: true,
      data: null,
    });

    const response = await request(createApp())
      .delete("/api/projects")
      .query({ id: "project-1" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Projeto excluído com sucesso",
    });
    expect(mocks.deleteProject).toHaveBeenCalledWith("project-1");
  });

  it("rejects delete requests without id", async () => {
    const response = await request(createApp()).delete("/api/projects");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: "ID do projeto é obrigatório.",
    });
    expect(mocks.deleteProject).not.toHaveBeenCalled();
  });
});

describe("project activities route", () => {
  it("lists project activities and unwraps the service payload", async () => {
    mocks.listProjectActivities.mockResolvedValue({
      ok: true,
      data: [baseActivity],
    });

    const response = await request(createApp()).get(
      `/api/projects/${projectUuid}/activities`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { activities: [baseActivity] },
      activities: [baseActivity],
    });
    expect(mocks.listProjectActivities).toHaveBeenCalledWith(projectUuid);
  });

  it("creates a project activity with the expected payload", async () => {
    mocks.createProjectActivity.mockResolvedValue({
      ok: true,
      data: baseActivity,
    });

    const response = await request(createApp())
      .post(`/api/projects/${projectUuid}/activities`)
      .send({
        name: baseActivity.name,
        description: baseActivity.description,
        category: baseActivity.category,
        estimatedDays: baseActivity.estimatedDays,
        startDate: baseActivity.startDate,
        endDate: baseActivity.endDate,
        priority: baseActivity.priority,
        status: baseActivity.status,
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      data: { activity: baseActivity },
      activity: baseActivity,
      message: "Atividade criada com sucesso",
    });
    expect(mocks.createProjectActivity).toHaveBeenCalledWith(projectUuid, {
      name: baseActivity.name,
      description: baseActivity.description,
      category: baseActivity.category,
      estimatedDays: baseActivity.estimatedDays,
      startDate: baseActivity.startDate,
      endDate: baseActivity.endDate,
      priority: baseActivity.priority,
      status: baseActivity.status,
    });
  });

  it("updates a project activity and keeps the id contract", async () => {
    const updatedActivity = {
      ...baseActivity,
      name: "Planejamento da sprint revisado",
      description: "Escopo ajustado para a próxima sprint",
      status: "progress",
      updatedAt: "2025-05-02T00:00:00.000Z",
    };

    mocks.updateProjectActivity.mockResolvedValue({
      ok: true,
      data: updatedActivity,
    });

    const response = await request(createApp())
      .put(`/api/projects/${projectUuid}/activities`)
      .send({
        id: activityUuid,
        name: updatedActivity.name,
        description: updatedActivity.description,
        category: updatedActivity.category,
        estimatedDays: updatedActivity.estimatedDays,
        startDate: updatedActivity.startDate,
        endDate: updatedActivity.endDate,
        priority: updatedActivity.priority,
        status: updatedActivity.status,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { activity: updatedActivity },
      activity: updatedActivity,
      message: "Atividade atualizada com sucesso",
    });
    expect(mocks.updateProjectActivity).toHaveBeenCalledWith(projectUuid, {
      id: activityUuid,
      name: updatedActivity.name,
      description: updatedActivity.description,
      category: updatedActivity.category,
      estimatedDays: updatedActivity.estimatedDays,
      startDate: updatedActivity.startDate,
      endDate: updatedActivity.endDate,
      priority: updatedActivity.priority,
      status: updatedActivity.status,
    });
  });

  it("deletes a project activity by the activityId query parameter", async () => {
    mocks.deleteProjectActivity.mockResolvedValue({
      ok: true,
      data: null,
    });

    const response = await request(createApp())
      .delete(`/api/projects/${projectUuid}/activities`)
      .query({ activityId: activityUuid });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Atividade excluída com sucesso",
    });
    expect(mocks.deleteProjectActivity).toHaveBeenCalledWith(
      projectUuid,
      activityUuid,
    );
  });

  it("rejects delete requests without activityId", async () => {
    const response = await request(createApp()).delete(
      `/api/projects/${projectUuid}/activities`,
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: "ID da atividade é obrigatório.",
    });
    expect(mocks.deleteProjectActivity).not.toHaveBeenCalled();
  });
});

describe("project activity tasks route", () => {
  it("lists tasks grouped by status", async () => {
    mocks.listProjectActivityTasks.mockResolvedValue({
      tasks: groupedTaskPayload,
    });

    const response = await request(createApp()).get(
      `/api/projects/${projectUuid}/activities/${activityUuid}/tasks`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { tasks: groupedTaskPayload },
    });
    expect(mocks.listProjectActivityTasks).toHaveBeenCalledWith(
      projectUuid,
      activityUuid,
    );
  });

  it("creates a task with the expected payload", async () => {
    mocks.createProjectActivityTask.mockResolvedValue({
      task: baseTask,
    });

    const response = await request(createApp())
      .post(`/api/projects/${projectUuid}/activities/${activityUuid}/tasks`)
      .send({
        projectId: projectUuid,
        projectActivityId: activityUuid,
        name: baseTask.name,
        description: baseTask.description,
        category: baseTask.category,
        estimatedDays: baseTask.estimatedDays,
        startDate: baseTask.startDate,
        endDate: baseTask.endDate,
        priority: baseTask.priority,
        status: baseTask.status,
        assignedUsers: ["user-1"],
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      data: { task: baseTask },
      task: baseTask,
      message: "Tarefa criada com sucesso",
    });
    expect(mocks.createProjectActivityTask).toHaveBeenCalledWith(
      projectUuid,
      activityUuid,
      "user-1",
      {
        projectId: projectUuid,
        projectActivityId: activityUuid,
        name: baseTask.name,
        description: baseTask.description,
        category: baseTask.category,
        estimatedDays: baseTask.estimatedDays,
        startDate: baseTask.startDate,
        endDate: baseTask.endDate,
        status: baseTask.status,
      },
    );
  });

  it("updates a task and keeps the id contract", async () => {
    const updatedTask = {
      ...baseTask,
      name: "Implementar autenticação revisada",
      description: "Fluxo de login ajustado",
      status: "in_progress",
      updatedAt: "2025-05-02T00:00:00.000Z",
    };

    mocks.updateProjectActivityTask.mockResolvedValue({
      task: updatedTask,
    });

    const response = await request(createApp())
      .put(`/api/projects/${projectUuid}/activities/${activityUuid}/tasks`)
      .send({
        id: taskUuid,
        projectId: projectUuid,
        projectActivityId: activityUuid,
        name: updatedTask.name,
        description: updatedTask.description,
        category: updatedTask.category,
        estimatedDays: updatedTask.estimatedDays,
        startDate: updatedTask.startDate,
        endDate: updatedTask.endDate,
        priority: updatedTask.priority,
        status: updatedTask.status,
        assignedUsers: ["user-2"],
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { task: updatedTask },
      task: updatedTask,
      message: "Tarefa atualizada com sucesso",
    });
    expect(mocks.updateProjectActivityTask).toHaveBeenCalledWith(
      projectUuid,
      activityUuid,
      "user-1",
      {
        id: taskUuid,
        projectId: projectUuid,
        projectActivityId: activityUuid,
        name: updatedTask.name,
        description: updatedTask.description,
        category: updatedTask.category,
        estimatedDays: updatedTask.estimatedDays,
        startDate: updatedTask.startDate,
        endDate: updatedTask.endDate,
        status: updatedTask.status,
      },
    );
  });

  it("deletes a task by id", async () => {
    mocks.deleteProjectActivityTask.mockResolvedValue({
      ok: true,
    });

    const response = await request(createApp())
      .delete(`/api/projects/${projectUuid}/activities/${activityUuid}/tasks`)
      .send({ id: taskUuid });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Tarefa excluída com sucesso",
    });
    expect(mocks.deleteProjectActivityTask).toHaveBeenCalledWith(
      projectUuid,
      activityUuid,
      taskUuid,
    );
  });

  it("reorders tasks and returns the synchronized list", async () => {
    const reorderedTasks = [
      { ...baseTask, sort: 1 },
      { ...baseTask, id: "550e8400-e29b-41d4-a716-446655440021", sort: 0 },
    ];

    mocks.reorderProjectActivityTasks.mockResolvedValue({
      tasks: reorderedTasks,
    });

    const response = await request(createApp())
      .patch(`/api/projects/${projectUuid}/activities/${activityUuid}/tasks`)
      .send({
        tasksBeforeMove: [
          { taskId: taskUuid, status: "todo", sort: 0 },
          { taskId: "550e8400-e29b-41d4-a716-446655440021", status: "todo", sort: 1 },
        ],
        tasksAfterMove: [
          { taskId: "550e8400-e29b-41d4-a716-446655440021", status: "todo", sort: 0 },
          { taskId: taskUuid, status: "todo", sort: 1 },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { tasks: reorderedTasks },
      tasks: reorderedTasks,
      message: "Movimentação salva com sucesso",
    });
    expect(mocks.reorderProjectActivityTasks).toHaveBeenCalledWith(
      projectUuid,
      activityUuid,
      "user-1",
      [
        { taskId: taskUuid, status: "todo", sort: 0 },
        { taskId: "550e8400-e29b-41d4-a716-446655440021", status: "todo", sort: 1 },
      ],
      [
        { taskId: "550e8400-e29b-41d4-a716-446655440021", status: "todo", sort: 0 },
        { taskId: taskUuid, status: "todo", sort: 1 },
      ],
    );
  });
});