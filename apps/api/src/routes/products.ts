import { Router } from "express";
import type { Response as ExpressResponse } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../services/product-service.js";
import { productCreateSchema, productUpdateSchema } from "@silo/engine/validation/products";

const router = Router();

router.use(authMiddleware);

type ProductServiceErrorResult = {
  error: unknown;
  status?: number;
  field?: string;
};

const respondProductServiceError = (
  res: ExpressResponse,
  result: unknown,
  fallbackMessage: string,
): boolean => {
  if (typeof result !== "object" || result === null || !("error" in result)) {
    return false;
  }

  const errorResult = result as ProductServiceErrorResult;
  const payload: { success: false; error: string; field?: string } = {
    success: false,
    error: typeof errorResult.error === "string" ? errorResult.error : fallbackMessage,
  };

  if (typeof errorResult.field === "string") payload.field = errorResult.field;

  res.status(typeof errorResult.status === "number" ? errorResult.status : 400).json(payload);
  return true;
};


const respondValidationError = (
  res: ExpressResponse,
  error: z.ZodError,
  fallbackMessage: string,
): void => {
  const issue = error.issues[0];
  res.status(400).json({
    success: false,
    error: issue?.message || fallbackMessage,
    field: typeof issue?.path[0] === "string" ? issue.path[0] : undefined,
  });
};

// GET /products — list or get by slug
router.get("/", requirePermission("products", "list"), async (req, res) => {
  const { slug, name, page, limit } = req.query as Record<string, string>;
  try {
    const result = await listProducts({
      slug: slug?.trim(),
      name: name?.trim(),
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 40,
    });
    if (slug) {
      res.json({ success: true, data: { products: result } });
    } else {
      res.json({ success: true, data: { items: result } });
    }
  } catch (err) {
    console.error("❌ [PRODUCTS] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao buscar produtos." });
  }
});

// POST /products — create
router.post("/", requirePermission("products", "create"), async (req, res) => {
  const parsed = productCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    respondValidationError(res, parsed.error, "Dados inválidos.");
    return;
  }
  try {
    const result = await createProduct({
      name: parsed.data.name,
      slug: parsed.data.slug,
      available: parsed.data.available,
      priority: parsed.data.priority,
      turns: parsed.data.turns,
      description: parsed.data.description ?? null,
      urlProductFlow: parsed.data.url_product_flow ?? null,
    });
    if ("error" in result) { respondProductServiceError(res, result, "Erro ao criar produto."); return; }
    res.status(201).json({ success: true, message: "Produto criado com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS] POST:", err);
    res.status(500).json({ success: false, error: "Erro ao criar produto." });
  }
});

// PUT /products — update
router.put("/", requirePermission("products", "update"), async (req, res) => {
  const parsed = productUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    respondValidationError(res, parsed.error, "Dados inválidos.");
    return;
  }
  try {
    const result = await updateProduct({
      id: parsed.data.id,
      name: parsed.data.name,
      slug: parsed.data.slug,
      available: parsed.data.available,
      priority: parsed.data.priority,
      turns: parsed.data.turns,
      description: parsed.data.description ?? null,
      urlProductFlow: parsed.data.url_product_flow ?? null,
    });
    if ("error" in result) { respondProductServiceError(res, result, "Erro ao atualizar produto."); return; }
    res.json({ success: true, message: "Produto atualizado com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS] PUT:", err);
    res.status(500).json({ success: false, error: "Erro ao atualizar produto." });
  }
});

// DELETE /products?id=
router.delete("/", requirePermission("products", "delete"), async (req, res) => {
  const { id } = req.query as Record<string, string>;
  if (!id?.trim()) {
    res.status(400).json({ success: false, error: "ID do produto é obrigatório." });
    return;
  }
  try {
    const result = await deleteProduct(id.trim());
    if ("error" in result) { respondProductServiceError(res, result, "Erro ao excluir produto."); return; }
    res.json({ success: true, message: "Produto excluído com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS] DELETE:", err);
    res.status(500).json({ success: false, error: "Erro ao excluir produto." });
  }
});

export default router;
