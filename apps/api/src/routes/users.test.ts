import express from "express";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authMiddleware: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  requirePermission: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
  requireAdmin: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  resendPasswordSetup: vi.fn(),
}));

vi.mock("../middleware/auth.js", () => ({
  authMiddleware: mocks.authMiddleware,
}));

vi.mock("../middleware/permissions.js", () => ({
  requirePermission: mocks.requirePermission,
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("../services/user-service.js", () => ({
  listUsers: mocks.listUsers,
  createUser: mocks.createUser,
  updateUser: mocks.updateUser,
  deleteUser: mocks.deleteUser,
  resendPasswordSetup: mocks.resendPasswordSetup,
}));

import usersRouter from "./users.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/users", usersRouter);
  return app;
}

describe("users route", () => {
  it("lists users and trims query values", async () => {
    mocks.listUsers.mockResolvedValue({
      items: [{ id: "user-1", name: "Usuário Alfa" }],
      total: 1,
    });

    const response = await request(createApp())
      .get("/api/users")
      .query({
        search: "  radar  ",
        status: " active ",
        groupId: "  group-1  ",
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        items: [{ id: "user-1", name: "Usuário Alfa" }],
        total: 1,
      },
    });
    expect(mocks.listUsers).toHaveBeenCalledWith({
      search: "radar",
      status: "active",
      groupId: "group-1",
    });
  });

  it("creates a user with the web payload shape", async () => {
    mocks.createUser.mockResolvedValue({
      ok: true,
      data: { id: "user-2" },
    });

    const response = await request(createApp())
      .post("/api/users")
      .send({
        name: "Novo Usuário",
        email: "NOVO.USUARIO@INPE.BR",
        password: "Senha123",
        isActive: true,
        emailVerified: false,
        groupId: "group-1",
        groups: [{ groupId: "group-1" }],
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      data: { id: "user-2" },
      message: "Usuário criado com sucesso.",
    });
    expect(mocks.createUser).toHaveBeenCalledWith(
      {
        name: "Novo Usuário",
        email: "novo.usuario@inpe.br",
        password: "Senha123",
        isActive: true,
        groupId: "group-1",
        groups: [{ groupId: "group-1" }],
      },
      expect.any(Object),
    );
  });

  it("updates a user and keeps the id contract", async () => {
    mocks.updateUser.mockResolvedValue({
      ok: true,
      data: { id: "user-1" },
    });

    const response = await request(createApp())
      .put("/api/users")
      .send({
        id: "user-1",
        name: "Usuário Alfa Atualizado",
        email: "ALFA@INPE.BR",
        emailVerified: true,
        isActive: false,
        groupId: "group-2",
        groups: [{ groupId: "group-2" }],
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { id: "user-1" },
      message: "Usuário atualizado com sucesso.",
    });
    expect(mocks.updateUser).toHaveBeenCalledWith({
      id: "user-1",
      name: "Usuário Alfa Atualizado",
      email: "alfa@inpe.br",
      emailVerified: true,
      isActive: false,
      groupId: "group-2",
      groups: [{ groupId: "group-2" }],
    });
  });

  it("deletes a user by the id query parameter", async () => {
    mocks.deleteUser.mockResolvedValue({
      ok: true,
      data: null,
    });

    const response = await request(createApp())
      .delete("/api/users")
      .query({ id: "user-1" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Usuário excluído com sucesso.",
    });
    expect(mocks.deleteUser).toHaveBeenCalledWith("user-1");
  });

  it("rejects delete requests without id", async () => {
    const response = await request(createApp()).delete("/api/users");

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      field: "id",
    });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("retries password setup for a user", async () => {
    mocks.resendPasswordSetup.mockResolvedValue({
      ok: true,
      data: null,
    });

    const response = await request(createApp())
      .post("/api/users/user-1/resend-password-setup");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Código OTP para definição de senha reenviado.",
    });
    expect(mocks.resendPasswordSetup).toHaveBeenCalledWith("user-1");
  });
});