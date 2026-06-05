import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { validate } from "../middleware/validate.js";
import { respondServiceError as respondProductServiceError } from "../lib/respond-service-error.js";
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../services/product-service.js";
import {
  productCreateSchema,
  productDeleteQuerySchema,
  productListQuerySchema,
  productUpdateSchema,
} from "@silo/engine/validation/products";

const router = Router();

router.use(authMiddleware);

type ProductCreateInput = z.infer<typeof productCreateSchema>;
type ProductDeleteQueryInput = z.infer<typeof productDeleteQuerySchema>;
type ProductListQueryInput = z.infer<typeof productListQuerySchema>;
type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

// GET /products — list or get by slug
router.get(
  "/",
  requirePermission("products", "view"),
  validate(productListQuerySchema, "query"),
  async (req: Request<Record<string, never>, unknown, never, ProductListQueryInput>, res) => {
  try {
    const { slug, name, page, limit } = req.query;
    const result = await listProducts({
      slug: slug?.trim(),
      name: name?.trim(),
      page: page ?? 1,
      limit: limit ?? 40,
    });
    if (slug) {
      res.json({ success: true, data: { products: result.data } });
    } else {
      res.json({ success: true, data: { items: result.data } });
    }
  } catch (err) {
    console.error("❌ [PRODUCTS] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao buscar produtos." });
  }
  },
);

// POST /products — create
router.post("/", requirePermission("products", "manage"), validate(productCreateSchema), async (req: Request<Record<string, never>, unknown, ProductCreateInput>, res) => {
  try {
    const payload = req.body;
    const result = await createProduct({
      name: payload.name,
      slug: payload.slug,
      available: payload.available,
      priority: payload.priority,
      turns: payload.turns,
      description: payload.description ?? null,
      urlProductFlow: payload.url_product_flow ?? null,
    });
    if (respondProductServiceError(res, result, "Erro ao criar produto.")) { return; }
    res.status(201).json({ success: true, message: "Produto criado com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS] POST:", err);
    res.status(500).json({ success: false, error: "Erro ao criar produto." });
  }
});

// PUT /products — update
router.put("/", requirePermission("products", "manage"), validate(productUpdateSchema), async (req: Request<Record<string, never>, unknown, ProductUpdateInput>, res) => {
  try {
    const payload = req.body;
    const result = await updateProduct({
      id: payload.id,
      name: payload.name,
      slug: payload.slug,
      available: payload.available,
      priority: payload.priority,
      turns: payload.turns,
      description: payload.description ?? null,
      urlProductFlow: payload.url_product_flow ?? null,
    });
    if (respondProductServiceError(res, result, "Erro ao atualizar produto.")) { return; }
    res.json({ success: true, message: "Produto atualizado com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS] PUT:", err);
    res.status(500).json({ success: false, error: "Erro ao atualizar produto." });
  }
});

// DELETE /products?id=
router.delete(
  "/",
  requirePermission("products", "manage"),
  validate(productDeleteQuerySchema, "query"),
  async (req: Request<Record<string, never>, unknown, never, ProductDeleteQueryInput>, res) => {
  try {
    const { id } = req.query;
    const result = await deleteProduct(id.trim());
    if (respondProductServiceError(res, result, "Erro ao excluir produto.")) { return; }
    res.json({ success: true, message: "Produto excluído com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS] DELETE:", err);
    res.status(500).json({ success: false, error: "Erro ao excluir produto." });
  }
  },
);

export default router;
