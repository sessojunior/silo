import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { SHIFT_CODES } from "@silo/engine/domain/scheduling";

const mocks = vi.hoisted(() => ({
  authMiddleware: vi.fn((_req, _res, next) => next()),
  requirePermission: vi.fn(() => (_req, _res, next) => next()),
  listProducts: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
}));

vi.mock("../middleware/auth.js", () => ({
  authMiddleware: mocks.authMiddleware,
}));

vi.mock("../middleware/permissions.js", () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock("../services/product-service.js", () => ({
  listProducts: mocks.listProducts,
  createProduct: mocks.createProduct,
  updateProduct: mocks.updateProduct,
  deleteProduct: mocks.deleteProduct,
}));

import productsRouter from "./products.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/products", productsRouter);
  return app;
}

describe("products route", () => {
  it("lists products and trims query values", async () => {
    mocks.listProducts.mockResolvedValue({
      data: [{ id: "product-1", name: "Produto Alfa" }],
    });

    const response = await request(createApp())
      .get("/api/products")
      .query({
        name: "  radar  ",
        page: "2",
        limit: "5",
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { items: [{ id: "product-1", name: "Produto Alfa" }] },
    });
    expect(mocks.listProducts).toHaveBeenCalledWith({
      slug: undefined,
      name: "radar",
      page: 2,
      limit: 5,
    });
  });

  it("returns products when slug is present", async () => {
    mocks.listProducts.mockResolvedValue({
      data: [{ id: "product-1", name: "Produto Alfa" }],
    });

    const response = await request(createApp())
      .get("/api/products")
      .query({ slug: "produto-alfa" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { products: [{ id: "product-1", name: "Produto Alfa" }] },
    });
  });

  it("creates a product with the web payload shape", async () => {
    mocks.createProduct.mockResolvedValue({
      ok: true,
      data: { id: "product-2" },
    });

    const response = await request(createApp())
      .post("/api/products")
      .send({
        name: "Produto Beta",
        slug: "produto-beta",
        available: true,
        turns: [...SHIFT_CODES],
        priority: "urgent",
        description: "Produto de teste",
        url_product_flow: "https://example.com/product-flow",
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      message: "Produto criado com sucesso",
    });
    expect(mocks.createProduct).toHaveBeenCalledWith({
      name: "Produto Beta",
      slug: "produto-beta",
      available: true,
      priority: "urgent",
      turns: [...SHIFT_CODES],
      description: "Produto de teste",
      urlProductFlow: "https://example.com/product-flow",
    });
  });

  it("updates a product and keeps the id contract", async () => {
    mocks.updateProduct.mockResolvedValue({
      ok: true,
      data: { id: "product-1" },
    });

    const response = await request(createApp())
      .put("/api/products")
      .send({
        id: "product-1",
        name: "Produto Alfa Atualizado",
        slug: "produto-alfa",
        available: false,
        turns: [...SHIFT_CODES],
        priority: "normal",
        description: null,
        url_product_flow: null,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Produto atualizado com sucesso",
    });
    expect(mocks.updateProduct).toHaveBeenCalledWith({
      id: "product-1",
      name: "Produto Alfa Atualizado",
      slug: "produto-alfa",
      available: false,
      priority: "normal",
      turns: [...SHIFT_CODES],
      description: null,
      urlProductFlow: null,
    });
  });

  it("deletes a product by the id query parameter", async () => {
    mocks.deleteProduct.mockResolvedValue({
      ok: true,
      data: { id: "product-1" },
    });

    const response = await request(createApp())
      .delete("/api/products")
      .query({ id: "product-1" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Produto excluído com sucesso",
    });
    expect(mocks.deleteProduct).toHaveBeenCalledWith("product-1");
  });

  it("rejects delete requests without id", async () => {
    const response = await request(createApp())
      .delete("/api/products")
      .query({ productId: "product-1" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      field: "id",
    });
    expect(response.body.error).toContain("expected string");
    expect(mocks.deleteProduct).not.toHaveBeenCalled();
  });
});