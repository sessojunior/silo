import express from "express";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authMiddleware: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  requirePermission: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
  getTaskUsers: vi.fn(),
  setTaskUsers: vi.fn(),
}));

vi.mock("../middleware/auth.js", () => ({
  authMiddleware: mocks.authMiddleware,
}));

vi.mock("../middleware/permissions.js", () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock("../services/task-service.js", () => ({
  getTaskHistory: vi.fn(),
  getTaskUsers: mocks.getTaskUsers,
  setTaskUsers: mocks.setTaskUsers,
}));

import tasksRouter from "./tasks.js";

const taskUuid = "550e8400-e29b-41d4-a716-446655440020";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/tasks", tasksRouter);
  return app;
}

describe("tasks route", () => {
  it("lists the users assigned to a task", async () => {
    mocks.getTaskUsers.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "user-1",
          role: "assignee",
          assignedAt: "2025-05-01T00:00:00.000Z",
          name: "Usuário Um",
          email: "user1@example.com",
          image: null,
        },
      ],
    });

    const response = await request(createApp()).get(`/api/admin/tasks/${taskUuid}/users`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: [
        {
          id: "user-1",
          role: "assignee",
          assignedAt: "2025-05-01T00:00:00.000Z",
          name: "Usuário Um",
          email: "user1@example.com",
          image: null,
        },
      ],
    });
    expect(mocks.getTaskUsers).toHaveBeenCalledWith(taskUuid);
  });

  it("associates users to a task with the expected payload", async () => {
    mocks.setTaskUsers.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "user-1",
          role: "assignee",
          assignedAt: "2025-05-01T00:00:00.000Z",
          name: "Usuário Um",
          email: "user1@example.com",
          image: null,
        },
      ],
    });

    const response = await request(createApp())
      .post(`/api/admin/tasks/${taskUuid}/users`)
      .send({ userIds: ["user-1", "user-2"], role: "assignee" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: [
        {
          id: "user-1",
          role: "assignee",
          assignedAt: "2025-05-01T00:00:00.000Z",
          name: "Usuário Um",
          email: "user1@example.com",
          image: null,
        },
      ],
      message: "Usuários associados com sucesso",
    });
    expect(mocks.setTaskUsers).toHaveBeenCalledWith(taskUuid, ["user-1", "user-2"], "assignee");
  });

  it("rejects task user association without user ids", async () => {
    const response = await request(createApp()).post(`/api/admin/tasks/${taskUuid}/users`).send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: "IDs de usuários são obrigatórios.",
    });
    expect(mocks.setTaskUsers).not.toHaveBeenCalled();
  });
});
