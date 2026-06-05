import express from "express";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authMiddleware: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  requirePermission: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
  listGroups: vi.fn(),
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
  getGroupPermissions: vi.fn(),
  updateGroupPermission: vi.fn(),
  removeUserFromGroup: vi.fn(),
}));

vi.mock("../middleware/auth.js", () => ({
  authMiddleware: mocks.authMiddleware,
}));

vi.mock("../middleware/permissions.js", () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock("../services/group-service.js", () => ({
  listGroups: mocks.listGroups,
  createGroup: mocks.createGroup,
  updateGroup: mocks.updateGroup,
  deleteGroup: mocks.deleteGroup,
  getGroupPermissions: mocks.getGroupPermissions,
  updateGroupPermission: mocks.updateGroupPermission,
  removeUserFromGroup: mocks.removeUserFromGroup,
}));

import groupsRouter from "./groups.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/groups", groupsRouter);
  return app;
}

describe("groups route", () => {
  it("lists groups and trims query values", async () => {
    mocks.listGroups.mockResolvedValue({
      items: [{ id: "group-1", name: "Grupo Alfa" }],
      total: 1,
    });

    const response = await request(createApp())
      .get("/api/groups")
      .query({
        search: "  radar  ",
        status: " active ",
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        items: [{ id: "group-1", name: "Grupo Alfa" }],
        total: 1,
      },
    });
    expect(mocks.listGroups).toHaveBeenCalledWith({
      search: "radar",
      status: "active",
    });
  });

  it("creates a group with the web payload shape", async () => {
    mocks.createGroup.mockResolvedValue({
      ok: true,
      data: { id: "group-2" },
    });

    const response = await request(createApp())
      .post("/api/groups")
      .send({
        name: "Grupo Beta",
        description: "Grupo de teste",
        icon: "icon-[lucide--users]",
        color: "#2563EB",
        active: true,
        isDefault: false,
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      data: { id: "group-2" },
      message: "Grupo criado com sucesso.",
    });
    expect(mocks.createGroup).toHaveBeenCalledWith({
      name: "Grupo Beta",
      description: "Grupo de teste",
      icon: "icon-[lucide--users]",
      color: "#2563EB",
      active: true,
      isDefault: false,
    });
  });

  it("updates a group and keeps the id contract", async () => {
    mocks.updateGroup.mockResolvedValue({
      ok: true,
      data: { id: "group-1" },
    });

    const response = await request(createApp())
      .put("/api/groups")
      .send({
        id: "group-1",
        name: "Grupo Alfa Atualizado",
        description: null,
        icon: "icon-[lucide--shield-check]",
        color: "#7C3AED",
        active: false,
        isDefault: true,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { id: "group-1" },
      message: "Grupo atualizado com sucesso.",
    });
    expect(mocks.updateGroup).toHaveBeenCalledWith({
      id: "group-1",
      name: "Grupo Alfa Atualizado",
      description: null,
      icon: "icon-[lucide--shield-check]",
      color: "#7C3AED",
      active: false,
      isDefault: true,
    });
  });

  it("deletes a group by the id query parameter", async () => {
    mocks.deleteGroup.mockResolvedValue({
      ok: true,
      data: null,
    });

    const response = await request(createApp())
      .delete("/api/groups")
      .query({ id: "group-1" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Grupo excluído com sucesso.",
    });
    expect(mocks.deleteGroup).toHaveBeenCalledWith("group-1");
  });

  it("rejects delete requests without id", async () => {
    const response = await request(createApp()).delete("/api/groups");

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      field: "id",
    });
    expect(mocks.deleteGroup).not.toHaveBeenCalled();
  });
});