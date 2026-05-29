import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authMiddleware: vi.fn((_req, _res, next) => next()),
  requirePermission: vi.fn(() => (_req, _res, next) => next()),
  listContacts: vi.fn(),
  createContact: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
}));

vi.mock("../middleware/auth.js", () => ({
  authMiddleware: mocks.authMiddleware,
}));

vi.mock("../middleware/permissions.js", () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock("../services/contact-service.js", () => ({
  listContacts: mocks.listContacts,
  createContact: mocks.createContact,
  updateContact: mocks.updateContact,
  deleteContact: mocks.deleteContact,
}));

import contactsRouter from "./contacts.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/contacts", contactsRouter);
  return app;
}

describe("contacts route", () => {
  it("lists contacts and trims query values", async () => {
    mocks.listContacts.mockResolvedValue({
      items: [{ id: "contact-1", name: "Contato Alfa" }],
      total: 1,
    });

    const response = await request(createApp())
      .get("/api/contacts")
      .query({
        search: "  radar  ",
        status: "active",
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { items: [{ id: "contact-1", name: "Contato Alfa" }], total: 1 },
    });
    expect(mocks.listContacts).toHaveBeenCalledWith({
      search: "radar",
      status: "active",
    });
  });

  it("creates a contact with the web payload shape", async () => {
    mocks.createContact.mockResolvedValue({
      ok: true,
      data: { id: "contact-2" },
    });

    const response = await request(createApp())
      .post("/api/contacts")
      .send({
        name: "Contato Beta",
        role: "Pesquisador Sênior",
        team: "Meteorologia",
        email: "Contato.Beta@Example.com",
        phone: "(12) 3208-6000",
        imageUrl: "/uploads/avatars/contact-beta.png",
        active: true,
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      data: { id: "contact-2" },
      message: "Contato criado com sucesso",
    });
    expect(mocks.createContact).toHaveBeenCalledWith({
      name: "Contato Beta",
      role: "Pesquisador Sênior",
      team: "Meteorologia",
      email: "contato.beta@example.com",
      phone: "(12) 3208-6000",
      imageUrl: "/uploads/avatars/contact-beta.png",
      active: true,
    });
  });

  it("updates a contact with the expected id contract", async () => {
    mocks.updateContact.mockResolvedValue({
      ok: true,
      data: null,
    });

    const response = await request(createApp())
      .put("/api/contacts")
      .send({
        id: "contact-1",
        name: "Contato Alfa Atualizado",
        role: "Pesquisador",
        team: "Operações",
        email: "alfa@inpe.br",
        phone: "",
        imageUrl: "",
        active: false,
        removeImage: true,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Contato atualizado com sucesso",
    });
    expect(mocks.updateContact).toHaveBeenCalledWith({
      id: "contact-1",
      name: "Contato Alfa Atualizado",
      role: "Pesquisador",
      team: "Operações",
      email: "alfa@inpe.br",
      phone: null,
      imageUrl: null,
      active: false,
      removeImage: true,
    });
  });

  it("deletes a contact by id in the JSON body", async () => {
    mocks.deleteContact.mockResolvedValue({
      ok: true,
      data: null,
    });

    const response = await request(createApp())
      .delete("/api/contacts")
      .send({ id: "contact-1" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Contato excluído com sucesso",
    });
    expect(mocks.deleteContact).toHaveBeenCalledWith("contact-1");
  });

  it("rejects delete requests without id", async () => {
    const response = await request(createApp()).delete("/api/contacts").send({});

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      field: "id",
    });
    expect(mocks.deleteContact).not.toHaveBeenCalled();
  });
});