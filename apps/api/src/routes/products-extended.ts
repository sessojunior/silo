/**
 * Extended product routes for apps/api
 * Handles all product sub-resources: activities, contacts, dependencies,
 * problems, solutions, manual, images, history, data-flow, etc.
 */
import { Router } from "express";
import type { Request } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { z } from "zod";
import path from "path";
import { promises as fs } from "fs";
import { respondServiceError as respondProductServiceError } from "../lib/respond-service-error.js";
import { deleteUploadFile, isSafeFilename, isUploadKind } from "../infra/uploads.js";
import {
  createProductDependency,
  createProductProblemImage,
  createProductProblem,
  createProductProblemCategory,
  createProductSolution,
  createProductSolutionImage,
  deleteProductDependency,
  deleteProductProblemImage,
  deleteProductProblem,
  deleteProductProblemCategory,
  deleteProductSolution,
  deleteProductSolutionImage,
  countProductSolutions,
  upsertProductActivity,
  updateProductActivity,
  getProductManual,
  listProductActivityHistory,
  listProductActivityPendingEmailRecipients,
  listProductDataFlowPipelines,
  getProductSolutionsSummary,
  listProductDependencies,
  listProductAvailabilityExceptions,
  deleteProductContactAssociation,
  listProductProblems,
  listProductContacts,
  listProductProblemImages,
  listProductProblemCategories,
  listProductSolutionImages,
  listProductSolutions,
  reorderProductDependencies,
  getProductActivityAvailability,
  deleteProductAvailabilityException,
  sendProductActivityPendingEmail,
  replaceProductContacts,
  upsertProductManual,
  upsertProductAvailabilityException,
  updateProductDependency,
  updateProductProblem,
  updateProductProblemCategory,
  updateProductSolution,
  PRODUCT_AVAILABILITY_EXCEPTION_TYPES,
} from "../services/product-service.js";

const router = Router();
router.use(authMiddleware);

const AvailabilityQuerySchema = z.object({
  productId: z.string().trim().min(1, "Produto é obrigatório."),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  turn: z.coerce.number().int().min(0).max(23),
  activityId: z.string().trim().min(1).optional(),
});

// ─── Activities ───────────────────────────────────────────────────────────────

router.get("/activities/availability", requirePermission("productActivities", "update"), async (req: Request, res) => {
  const parsed = AvailabilityQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || "Parâmetros inválidos." });
    return;
  }

  try {
    const result = await getProductActivityAvailability(parsed.data);
    if (!result.ok) {
      respondProductServiceError(res, result, "Erro ao verificar disponibilidade.");
      return;
    }

    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("❌ [PRODUCTS/ACTIVITIES/AVAILABILITY] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao verificar disponibilidade." });
  }
});

router.post("/activities", requirePermission("productActivities", "create"), async (req: Request, res) => {
  try {
    const user = req.user!;
    const { productId, date, turn, status, description, intervention, problemCategoryId } = req.body || {};
    if (!productId || date === undefined || turn === undefined || !status) {
      res.status(400).json({ success: false, error: "Parâmetros obrigatórios ausentes." }); return;
    }
    const result = await upsertProductActivity({
      userId: user.id,
      productId,
      date,
      turn,
      status,
      description: description || null,
      intervention: intervention || null,
      problemCategoryId: problemCategoryId || null,
    });
    if (!result.ok) {
      respondProductServiceError(res, result, "Erro ao salvar atividade.");
      return;
    }
    const { activity, action } = result.data;
    res.json({ success: true, data: activity, message: action === "created" ? "Atividade criada com sucesso" : "Atividade atualizada com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS/ACTIVITIES] POST:", err);
    res.status(500).json({ success: false, error: "Erro ao salvar atividade." });
  }
});

router.put("/activities", requirePermission("productActivities", "update"), async (req: Request, res) => {
  try {
    const user = req.user!;
    const { id, status, description, intervention, problemCategoryId } = req.body || {};
    if (!id || !status) { res.status(400).json({ success: false, error: "Parâmetros obrigatórios ausentes." }); return; }
    const result = await updateProductActivity({
      userId: user.id,
      id,
      status,
      description: description || null,
      intervention: intervention || null,
      problemCategoryId: problemCategoryId || null,
    });
    if (!result.ok) {
      respondProductServiceError(res, result, "Erro ao atualizar atividade.");
      return;
    }
    res.json({ success: true, data: result.data.activity, message: "Atividade atualizada com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS/ACTIVITIES] PUT:", err);
    res.status(500).json({ success: false, error: "Erro ao atualizar atividade." });
  }
});

// ─── Activities Pending Email ─────────────────────────────────────────────────

const TurnSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return value;
    return Number(trimmed);
  }
  return value;
}, z.number().int().min(0).max(23));

const PendingEmailSchema = z.object({
  productId: z.string().trim().min(1, "Produto é obrigatório."),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  turn: TurnSchema,
  status: z.string().trim().min(1, "Status é obrigatório."),
  incidentName: z.string().trim().max(120).nullish(),
  recipientUserIds: z.array(z.string().trim().min(1)).min(1, "Selecione pelo menos um destinatário.").max(50),
  message: z.string().trim().min(1, "Mensagem é obrigatória.").max(20000),
});

const AvailabilityExceptionSchema = z.object({
  productId: z.string().trim().min(1, "Produto é obrigatório."),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  type: z.enum(PRODUCT_AVAILABILITY_EXCEPTION_TYPES),
  description: z
    .string()
    .trim()
    .max(255, "A descrição deve ter no máximo 255 caracteres.")
    .nullish(),
});

const AvailabilityExceptionQuerySchema = z.object({
  productId: z.string().trim().min(1, "Produto é obrigatório."),
  from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial inválida.").optional(),
  to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida.").optional(),
});

const AvailabilityExceptionDeleteSchema = z.object({
  id: z.string().trim().min(1, "Exceção é obrigatória."),
});

router.get("/activities/pending-email", requirePermission("productActivities", "update"), async (_req, res) => {
  try {
    const result = await listProductActivityPendingEmailRecipients();
    res.json({ success: true, data: { items: result.data.items, total: result.data.total } });
  } catch (err) {
    console.error("❌ [PRODUCTS/ACTIVITIES/PENDING-EMAIL] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao carregar destinatários." });
  }
});

router.post("/activities/pending-email", requirePermission("productActivities", "update"), async (req: Request, res) => {
  try {
    const parsed = PendingEmailSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message }); return; }
    const data = parsed.data;
    const result = await sendProductActivityPendingEmail({
      productId: data.productId,
      date: data.date,
      turn: data.turn,
      status: data.status,
      incidentName: data.incidentName,
      recipientUserIds: Array.from(new Set(data.recipientUserIds)),
      message: data.message,
    });

    if (!result.ok) {
      respondProductServiceError(res, result, "Erro ao enviar pendências.");
      return;
    }
    res.json({ success: true, data: { sent: result.data.sent }, message: result.data.sent === 1 ? "Pendência enviada com sucesso." : "Pendências enviadas com sucesso." });
  } catch (err) {
    console.error("❌ [PRODUCTS/ACTIVITIES/PENDING-EMAIL] POST:", err);
    res.status(500).json({ success: false, error: "Erro ao enviar pendências." });
  }
});

router.get("/availability-exceptions", requirePermission("productActivities", "update"), async (req: Request, res) => {
  const parsed = AvailabilityExceptionQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || "Parâmetros inválidos." });
    return;
  }

  try {
    const result = await listProductAvailabilityExceptions(parsed.data);
    if (!result.ok) {
      respondProductServiceError(res, result, "Erro ao carregar exceções de disponibilidade.");
      return;
    }

    res.json({ success: true, data: { items: result.data.items, total: result.data.items.length } });
  } catch (err) {
    console.error("❌ [PRODUCTS/AVAILABILITY-EXCEPTIONS] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao carregar exceções de disponibilidade." });
  }
});

router.post("/availability-exceptions", requirePermission("productActivities", "update"), async (req: Request, res) => {
  try {
    const parsed = AvailabilityExceptionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || "Parâmetros inválidos." });
      return;
    }

    const result = await upsertProductAvailabilityException({
      productId: parsed.data.productId,
      date: parsed.data.date,
      type: parsed.data.type,
      description: parsed.data.description ?? null,
    });

    if (!result.ok) {
      respondProductServiceError(res, result, "Erro ao salvar exceção de disponibilidade.");
      return;
    }
    const { exception, action } = result.data;
    res.json({ success: true, data: exception, message: action === "created" ? "Exceção criada com sucesso." : "Exceção atualizada com sucesso." });
  } catch (err) {
    console.error("❌ [PRODUCTS/AVAILABILITY-EXCEPTIONS] POST:", err);
    res.status(500).json({ success: false, error: "Erro ao salvar exceção de disponibilidade." });
  }
});

router.delete("/availability-exceptions", requirePermission("productActivities", "update"), async (req: Request, res) => {
  try {
    const parsed = AvailabilityExceptionDeleteSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || "Parâmetros inválidos." });
      return;
    }

    const result = await deleteProductAvailabilityException(parsed.data.id);
    if (respondProductServiceError(res, result, "Erro ao remover exceção de disponibilidade.")) {
      return;
    }

    res.json({ success: true, message: "Exceção removida com sucesso." });
  } catch (err) {
    console.error("❌ [PRODUCTS/AVAILABILITY-EXCEPTIONS] DELETE:", err);
    res.status(500).json({ success: false, error: "Erro ao remover exceção de disponibilidade." });
  }
});

// ─── Contacts ─────────────────────────────────────────────────────────────────

router.get("/contacts", requirePermission("contacts", "list"), async (req: Request, res) => {
  try {
    const productId = typeof req.query.productId === "string" ? req.query.productId : undefined;
    if (!productId) { res.status(400).json({ success: false, error: "ProductId é obrigatório" }); return; }
    const result = await listProductContacts(productId);
    res.json({ success: true, data: { contacts: result.data.contacts, total: result.data.contacts.length } });
  } catch (err) {
    console.error("❌ [PRODUCTS/CONTACTS] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao buscar contatos." });
  }
});

router.post("/contacts", requirePermission("contacts", "create"), async (req: Request, res) => {
  try {
    const { productId, contactIds } = req.body;
    if (!productId || !contactIds || !Array.isArray(contactIds)) { res.status(400).json({ success: false, error: "ProductId e contactIds são obrigatórios" }); return; }
    await replaceProductContacts({ productId, contactIds });
    res.json({ success: true, message: `${contactIds.length} contatos associados com sucesso` });
  } catch (err) {
    console.error("❌ [PRODUCTS/CONTACTS] POST:", err);
    res.status(500).json({ success: false, error: "Erro ao associar contatos." });
  }
});

router.delete("/contacts", requirePermission("contacts", "delete"), async (req: Request, res) => {
  try {
    const { associationId } = req.body;
    if (!associationId) { res.status(400).json({ success: false, error: "AssociationId é obrigatório" }); return; }
    const result = await deleteProductContactAssociation(associationId);
    if (respondProductServiceError(res, result, "Erro ao remover associação.")) { return; }
    res.json({ success: true, message: "Associação removida com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS/CONTACTS] DELETE:", err);
    res.status(500).json({ success: false, error: "Erro ao remover associação." });
  }
});

router.get("/dependencies", requirePermission("productDependencies", "list"), async (req: Request, res) => {
  try {
    const productId = typeof req.query.productId === "string" ? req.query.productId : undefined;
    if (!productId) { res.status(400).json({ success: false, error: "ProductId é obrigatório" }); return; }
    const dependencies = await listProductDependencies(productId);
    res.json({ success: true, data: { dependencies: dependencies.data } });
  } catch (err) {
    console.error("❌ [PRODUCTS/DEPENDENCIES] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao buscar dependências." });
  }
});

router.post("/dependencies", requirePermission("productDependencies", "create"), async (req: Request, res) => {
  try {
    const { productId, name, icon, description, parentId } = req.body;
    if (!productId || !name) { res.status(400).json({ success: false, error: "ProductId e nome são obrigatórios" }); return; }
    const result = await createProductDependency({ productId, name, icon, description, parentId });
    if (!result.ok) {
      respondProductServiceError(res, result, "Erro ao criar dependência.");
      return;
    }
    const { dependency: dep } = result.data;
    res.status(201).json({ success: true, data: { dependency: dep }, message: "Dependência criada com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS/DEPENDENCIES] POST:", err);
    res.status(500).json({ success: false, error: "Erro ao criar dependência." });
  }
});

router.put("/dependencies", requirePermission("productDependencies", "update"), async (req: Request, res) => {
  try {
    const { id, name, icon, description, parentId, newPosition } = req.body;
    if (!id || !name) { res.status(400).json({ success: false, error: "ID e nome são obrigatórios" }); return; }
    const result = await updateProductDependency({ id, name, icon, description, parentId, newPosition });
    if (!result.ok) {
      respondProductServiceError(res, result, "Erro ao atualizar dependência.");
      return;
    }
    const { dependency: updated } = result.data;
    res.json({ success: true, data: { dependency: updated }, message: "Dependência atualizada com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS/DEPENDENCIES] PUT:", err);
    res.status(500).json({ success: false, error: "Erro ao atualizar dependência." });
  }
});

router.delete("/dependencies", requirePermission("productDependencies", "delete"), async (req: Request, res) => {
  try {
    const { id } = req.body;
    if (!id) { res.status(400).json({ success: false, error: "ID é obrigatório" }); return; }
    const result = await deleteProductDependency(id);
    if (respondProductServiceError(res, result, "Erro ao excluir dependência.")) { return; }
    res.json({ success: true, message: "Dependência excluída com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS/DEPENDENCIES] DELETE:", err);
    res.status(500).json({ success: false, error: "Erro ao excluir dependência." });
  }
});

router.put("/dependencies/reorder", requirePermission("productDependencies", "reorder"), async (req: Request, res) => {
  try {
    const { productId, items } = req.body as { productId: string; items: Array<{ id: string; parentId: string | null; treePath: string; treeDepth: number; sortKey: string }> };
    if (!productId || !Array.isArray(items)) { res.status(400).json({ success: false, error: "ProductId e items são obrigatórios" }); return; }
    const result = await reorderProductDependencies(productId, items);
    if (respondProductServiceError(res, result, "Erro ao reordenar dependências.")) { return; }
    res.json({ success: true, message: "Dependências reordenadas com sucesso!" });
  } catch (err) {
    console.error("❌ [PRODUCTS/DEPENDENCIES/REORDER] PUT:", err);
    res.status(500).json({ success: false, error: "Erro ao reordenar dependências." });
  }
});

// ─── Manual ───────────────────────────────────────────────────────────────────

router.get("/manual", requirePermission("productManual", "view"), async (req: Request, res) => {
  try {
    const productSlug = typeof req.query.productSlug === "string" ? req.query.productSlug : undefined;
    const productId = typeof req.query.productId === "string" ? req.query.productId : undefined;
    const result = await getProductManual({ productSlug, productId });
    if (!result.ok) {
      respondProductServiceError(res, result, "Erro ao buscar manual.");
      return;
    }
    const { manual } = result.data;
    res.json({ success: true, data: manual });
  } catch (err) {
    console.error("❌ [PRODUCTS/MANUAL] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao buscar manual." });
  }
});

router.put("/manual", requirePermission("productManual", "update"), async (req: Request, res) => {
  try {
    const { productId, description } = req.body;
    if (!productId || !description) { res.status(400).json({ success: false, error: "ProductId e description são obrigatórios" }); return; }
    const result = await upsertProductManual({ productId, description });
    if (!result.ok) {
      respondProductServiceError(res, result, "Erro ao salvar manual.");
      return;
    }
    const { manual } = result.data;
    res.json({ success: true, data: manual, message: "Manual salvo com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS/MANUAL] PUT:", err);
    res.status(500).json({ success: false, error: "Erro ao salvar manual." });
  }
});

// ─── Manual Images ────────────────────────────────────────────────────────────

router.get("/manual/images", requirePermission("productManual", "view"), async (_req, res) => {
  try {
    const dir = path.join(process.cwd(), "uploads", "manual");
    let files: string[] = [];
    try { files = await fs.readdir(dir); } catch { files = []; }
    const stats = await Promise.all(files.map(async (filename) => {
      try {
        const stat = await fs.stat(path.join(dir, filename));
        return { filename, url: `/uploads/manual/${filename}`, size: stat.size, mtime: stat.mtimeMs };
      } catch { return null; }
    }));
    const items = (stats.filter((s) => s !== null) as Array<{ filename: string; url: string; size: number; mtime: number }>).sort((a, b) => b.mtime - a.mtime);
    res.json({ success: true, data: { items } });
  } catch (err) {
    console.error("❌ [PRODUCTS/MANUAL/IMAGES] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao listar imagens." });
  }
});

router.delete("/manual/images", requirePermission("productManual", "update"), async (req: Request, res) => {
  try {
    const { filename } = req.body;
    if (!filename || !isSafeFilename(filename)) { res.status(400).json({ success: false, error: "Arquivo inválido." }); return; }
    const ok = await deleteUploadFile("manual", filename);
    if (!ok) { res.status(404).json({ success: false, error: "Não foi possível excluir o arquivo." }); return; }
    res.json({ success: true, message: "Imagem excluída com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS/MANUAL/IMAGES] DELETE:", err);
    res.status(500).json({ success: false, error: "Erro ao excluir imagem." });
  }
});

// ─── Problems ─────────────────────────────────────────────────────────────────

router.get("/problems", requirePermission("productProblems", "list"), async (req: Request, res) => {
  try {
    const slug = typeof req.query.slug === "string" ? req.query.slug : undefined;
    const page = parseInt(typeof req.query.page === "string" ? req.query.page : "1");
    const limit = parseInt(typeof req.query.limit === "string" ? req.query.limit : "20");
    if (!slug) { res.status(400).json({ success: false, error: "Parâmetro slug é obrigatório." }); return; }
    const result = await listProductProblems({ slug, page, limit });
    if (!result.ok) {
      respondProductServiceError(res, result, "Erro ao buscar problemas.");
      return;
    }
    res.json({ success: true, data: { items: result.data.items } });
  } catch (err) {
    console.error("❌ [PRODUCTS/PROBLEMS] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao buscar problemas." });
  }
});

router.post("/problems", requirePermission("productProblems", "create"), async (req: Request, res) => {
  try {
    const user = req.user!;
    const { productId, title, description, problemCategoryId } = req.body;
    if (!productId || !problemCategoryId || typeof title !== "string" || typeof description !== "string") { res.status(400).json({ success: false, error: "Todos os campos são obrigatórios." }); return; }
    if (title.trim().length < 5) { res.status(400).json({ success: false, error: "O título deve ter pelo menos 5 caracteres." }); return; }
    if (description.trim().length < 20) { res.status(400).json({ success: false, error: "A descrição deve ter pelo menos 20 caracteres." }); return; }
    const result = await createProductProblem({ productId, userId: user.id, title, description, problemCategoryId });
    if (respondProductServiceError(res, result, "Erro ao cadastrar problema.")) { return; }
    res.status(201).json({ success: true, message: "Problema cadastrado com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS/PROBLEMS] POST:", err);
    res.status(500).json({ success: false, error: "Erro ao cadastrar problema." });
  }
});

router.put("/problems", requirePermission("productProblems", "update"), async (req: Request, res) => {
  try {
    const { id, title, description, problemCategoryId } = req.body;
    if (!id || typeof title !== "string" || typeof description !== "string" || !problemCategoryId) { res.status(400).json({ success: false, error: "Todos os campos são obrigatórios." }); return; }
    if (title.trim().length < 5) { res.status(400).json({ success: false, error: "O título deve ter pelo menos 5 caracteres." }); return; }
    if (description.trim().length < 20) { res.status(400).json({ success: false, error: "A descrição deve ter pelo menos 20 caracteres." }); return; }
    const result = await updateProductProblem({ id, title, description, problemCategoryId });
    if (respondProductServiceError(res, result, "Erro ao atualizar problema.")) { return; }
    res.json({ success: true, message: "Problema atualizado com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS/PROBLEMS] PUT:", err);
    res.status(500).json({ success: false, error: "Erro ao atualizar problema." });
  }
});

router.delete("/problems", requirePermission("productProblems", "delete"), async (req: Request, res) => {
  try {
    const { id } = req.body;
    if (!id) { res.status(400).json({ success: false, error: "ID obrigatório." }); return; }
    const result = await deleteProductProblem(id);
    if (respondProductServiceError(res, result, "Erro ao excluir problema.")) { return; }
    res.json({ success: true, message: "Problema excluído com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS/PROBLEMS] DELETE:", err);
    res.status(500).json({ success: false, error: "Erro ao excluir problema." });
  }
});

// ─── Problems Categories ──────────────────────────────────────────────────────

router.get("/problems/categories", requirePermission("productProblems", "list"), async (req: Request, res) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : "";
    const result = await listProductProblemCategories(search);
    res.json({ success: true, data: result.data.items });
  } catch (err) {
    console.error("❌ [PRODUCTS/PROBLEMS/CATEGORIES] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao listar categorias." });
  }
});

router.post("/problems/categories", requirePermission("productProblems", "create"), async (req: Request, res) => {
  try {
    const { name, color } = req.body;
    if (!name || name.trim().length < 2) { res.status(400).json({ success: false, error: "Nome é obrigatório e deve ter pelo menos 2 caracteres." }); return; }
    const result = await createProductProblemCategory({ name, color });
    if (!result.ok) {
      respondProductServiceError(res, result, "Erro ao criar categoria.");
      return;
    }
    res.status(201).json({ success: true, data: result.data.category, message: "Categoria criada com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS/PROBLEMS/CATEGORIES] POST:", err);
    res.status(500).json({ success: false, error: "Erro ao criar categoria." });
  }
});

router.put("/problems/categories", requirePermission("productProblems", "update"), async (req: Request, res) => {
  try {
    const { id, name, color } = req.body;
    if (!id) { res.status(400).json({ success: false, error: "ID obrigatório." }); return; }
    if (!name || name.trim().length < 2) { res.status(400).json({ success: false, error: "Nome é obrigatório e deve ter pelo menos 2 caracteres." }); return; }
    const result = await updateProductProblemCategory({ id, name, color });
    if (respondProductServiceError(res, result, "Erro ao atualizar categoria.")) { return; }
    res.json({ success: true, message: "Categoria atualizada com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS/PROBLEMS/CATEGORIES] PUT:", err);
    res.status(500).json({ success: false, error: "Erro ao atualizar categoria." });
  }
});

router.delete("/problems/categories", requirePermission("productProblems", "delete"), async (req: Request, res) => {
  try {
    const id = typeof req.query.id === "string" ? req.query.id : undefined;
    if (!id) { res.status(400).json({ success: false, error: "ID obrigatório." }); return; }
    const result = await deleteProductProblemCategory(id);
    if (respondProductServiceError(res, result, "Erro ao excluir categoria.")) { return; }
    res.json({ success: true, message: "Categoria excluída com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS/PROBLEMS/CATEGORIES] DELETE:", err);
    res.status(500).json({ success: false, error: "Erro ao excluir categoria." });
  }
});

// ─── Problem Images ───────────────────────────────────────────────────────────

router.get("/images", requirePermission("productProblems", "list"), async (req: Request, res) => {
  try {
    const problemId = typeof req.query.problemId === "string" ? req.query.problemId : undefined;
    if (!problemId) { res.status(400).json({ success: false, error: "Parâmetro problemId é obrigatório." }); return; }
    const result = await listProductProblemImages(problemId);
    res.json({ success: true, data: { items: result.data.items } });
  } catch (err) {
    console.error("❌ [PRODUCTS/IMAGES] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao buscar imagens." });
  }
});

router.post("/images", requirePermission("productProblems", "update"), async (req: Request, res) => {
  try {
    const { productProblemId, imageUrl } = req.body;
    const description = typeof req.body.description === "string" ? req.body.description : "";
    if (!imageUrl || !productProblemId) { res.status(400).json({ success: false, error: "Arquivo e productProblemId são obrigatórios." }); return; }
    const result = await createProductProblemImage({ productProblemId, image: imageUrl, description });
    res.status(201).json({ success: true, data: { image: result.data.image.image }, message: "Imagem enviada com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS/IMAGES] POST:", err);
    res.status(500).json({ success: false, error: "Erro ao fazer upload." });
  }
});

router.delete("/images", requirePermission("productProblems", "update"), async (req: Request, res) => {
  try {
    const { id } = req.body;
    if (!id) { res.status(400).json({ success: false, error: "ID da imagem é obrigatório." }); return; }
    const result = await deleteProductProblemImage(id);
    if (!result.ok) {
      respondProductServiceError(res, result, "Erro ao excluir imagem.");
      return;
    }
    const img = result.data.image;
    try {
      const imgPath = img.image;
      const uploadsPrefix = "/uploads/";
      if (imgPath.startsWith(uploadsPrefix)) {
        const rest = imgPath.slice(uploadsPrefix.length);
        const [kind, ...parts] = rest.split("/");
        const filename = parts.join("/");
        if (kind && filename && isUploadKind(kind) && isSafeFilename(filename)) {
          await deleteUploadFile(kind, filename);
        }
      }
    } catch { /* don't fail if file delete fails */ }
    res.json({ success: true, message: "Imagem excluída com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS/IMAGES] DELETE:", err);
    res.status(500).json({ success: false, error: "Erro ao excluir imagem." });
  }
});

// ─── Solutions ────────────────────────────────────────────────────────────────

router.get("/solutions", requirePermission("productSolutions", "list"), async (req: Request, res) => {
  try {
    const problemId = typeof req.query.problemId === "string" ? req.query.problemId : undefined;
    if (!problemId) { res.status(400).json({ success: false, error: "Parâmetro problemId é obrigatório." }); return; }
    const result = await listProductSolutions(problemId);
    res.json({ success: true, data: { items: result.data.items } });
  } catch (err) {
    console.error("❌ [PRODUCTS/SOLUTIONS] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao buscar soluções." });
  }
});

router.post("/solutions", requirePermission("productSolutions", "create"), async (req: Request, res) => {
  try {
    const user = req.user!;
    // Support both JSON body and formData-like body
    const description = (req.body.description as string)?.trim() || "";
    const problemId = req.body.problemId as string | null;
    const replyId = req.body.replyId as string | null;
    const imageUrl = req.body.imageUrl as string | null;
    if (!problemId || description.length < 2) { res.status(400).json({ success: false, error: "Descrição e problema são obrigatórios (mín. 2 caracteres)." }); return; }
    await createProductSolution({ userId: user.id, problemId, description, replyId: replyId || null, imageUrl: imageUrl || null });
    res.status(201).json({ success: true, message: "Solução criada com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS/SOLUTIONS] POST:", err);
    res.status(500).json({ success: false, error: "Erro ao criar solução." });
  }
});

router.put("/solutions", requirePermission("productSolutions", "update"), async (req: Request, res) => {
  try {
    const user = req.user!;
    const id = req.body.id as string | null;
    const description = (req.body.description as string)?.trim() || "";
    const imageUrl = req.body.imageUrl as string | null;
    const removeImage = req.body.removeImage === true || req.body.removeImage === "true";
    if (!id || description.length < 2) { res.status(400).json({ success: false, error: "ID e descrição são obrigatórios (mín. 2 caracteres)." }); return; }
    const result = await updateProductSolution({ userId: user.id, id, description, imageUrl, removeImage });
    if (respondProductServiceError(res, result, "Erro ao atualizar solução.")) { return; }
    res.json({ success: true, message: "Solução atualizada com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS/SOLUTIONS] PUT:", err);
    res.status(500).json({ success: false, error: "Erro ao atualizar solução." });
  }
});

router.delete("/solutions", requirePermission("productSolutions", "delete"), async (req: Request, res) => {
  try {
    const user = req.user!;
    const { id } = req.body;
    if (!id) { res.status(400).json({ success: false, error: "ID obrigatório." }); return; }
    const result = await deleteProductSolution({ userId: user.id, id });
    if (respondProductServiceError(res, result, "Erro ao excluir solução.")) { return; }
    res.json({ success: true, message: "Solução excluída com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS/SOLUTIONS] DELETE:", err);
    res.status(500).json({ success: false, error: "Erro ao excluir solução." });
  }
});

router.post("/solutions/count", requirePermission("productSolutions", "list"), async (req: Request, res) => {
  try {
    const { problemIds } = req.body;
    if (!problemIds || !Array.isArray(problemIds) || problemIds.length === 0) { res.status(400).json({ success: false, error: "Array problemIds é obrigatório e não pode estar vazio." }); return; }
    const counts = await countProductSolutions(problemIds as string[]);
    res.json({ success: true, data: counts.data });
  } catch (err) {
    console.error("❌ [PRODUCTS/SOLUTIONS/COUNT] POST:", err);
    res.status(500).json({ success: false, error: "Erro ao buscar contagens." });
  }
});

router.get("/solutions/summary", requirePermission("productSolutions", "list"), async (req: Request, res) => {
  try {
    const productSlug = typeof req.query.productSlug === "string" ? req.query.productSlug : undefined;
    if (!productSlug) { res.status(400).json({ success: false, error: "Parâmetro productSlug é obrigatório." }); return; }
    const result = await getProductSolutionsSummary(productSlug);
    res.json({ success: true, data: { totalSolutions: result.data.totalSolutions, lastUpdated: result.data.lastUpdated } });
  } catch (err) {
    console.error("❌ [PRODUCTS/SOLUTIONS/SUMMARY] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao buscar summary." });
  }
});

// ─── Solution Images ──────────────────────────────────────────────────────────

router.get("/solutions/images", requirePermission("productSolutions", "list"), async (req: Request, res) => {
  try {
    const solutionId = typeof req.query.solutionId === "string" ? req.query.solutionId : undefined;
    if (!solutionId) { res.status(400).json({ success: false, error: "Parâmetro solutionId é obrigatório." }); return; }
    const result = await listProductSolutionImages(solutionId);
    res.json({ success: true, data: { items: result.data.items } });
  } catch (err) {
    console.error("❌ [PRODUCTS/SOLUTIONS/IMAGES] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao buscar imagens." });
  }
});

router.post("/solutions/images", requirePermission("productSolutions", "update"), async (req: Request, res) => {
  try {
    const productSolutionId = req.body.productSolutionId as string | null;
    const imageUrl = req.body.imageUrl as string | null;
    const description = (req.body.description as string | null) || "";
    if (!imageUrl || !productSolutionId) { res.status(400).json({ success: false, error: "Arquivo e productSolutionId são obrigatórios." }); return; }
    const result = await createProductSolutionImage({ productSolutionId, image: imageUrl, description });
    if (!result.ok) {
      respondProductServiceError(res, result, "Erro ao fazer upload.");
      return;
    }
    const { image } = result.data;
    res.status(201).json({ success: true, data: { image: image.image }, message: "Imagem enviada com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS/SOLUTIONS/IMAGES] POST:", err);
    res.status(500).json({ success: false, error: "Erro ao fazer upload." });
  }
});

router.delete("/solutions/images", requirePermission("productSolutions", "update"), async (req: Request, res) => {
  try {
    const { id } = req.body;
    if (!id) { res.status(400).json({ success: false, error: "ID da imagem é obrigatório." }); return; }
    const result = await deleteProductSolutionImage(id);
    if (!result.ok) {
      respondProductServiceError(res, result, "Erro ao excluir imagem.");
      return;
    }
    const { image: img } = result.data;
    try {
      const imgPath = img.image;
      const uploadsPrefix = "/uploads/";
      if (imgPath.startsWith(uploadsPrefix)) {
        const rest = imgPath.slice(uploadsPrefix.length);
        const [kind, ...parts] = rest.split("/");
        const filename = parts.join("/");
        if (kind && filename && isUploadKind(kind) && isSafeFilename(filename)) {
          await deleteUploadFile(kind, filename);
        }
      }
    } catch { /* silent */ }
    res.json({ success: true, message: "Imagem excluída com sucesso" });
  } catch (err) {
    console.error("❌ [PRODUCTS/SOLUTIONS/IMAGES] DELETE:", err);
    res.status(500).json({ success: false, error: "Erro ao excluir imagem." });
  }
});

// ─── Product History ──────────────────────────────────────────────────────────

router.get("/:productId/history", requirePermission("productActivities", "list"), async (req: Request, res) => {
  try {
    const productId = req.params.productId as string;
    const result = await listProductActivityHistory({
      productId,
      date: typeof req.query.date === "string" ? req.query.date : null,
      turn: typeof req.query.turn === "string" ? req.query.turn : null,
    });
    if (!result.ok) {
      respondProductServiceError(res, result, "Erro ao buscar histórico.");
      return;
    }
    res.json({ success: true, data: { history: result.data.history } });
  } catch (err) {
    console.error("❌ [PRODUCTS/:productId/HISTORY] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao buscar histórico." });
  }
});

// ─── Product Data Flow ────────────────────────────────────────────────────────

router.get("/:productId/data-flow", requirePermission("products", "list"), async (req: Request, res) => {
  try {
    const result = await listProductDataFlowPipelines({
      productSlug: String(req.params.productId ?? ""),
      date: typeof req.query.date === "string" ? req.query.date : null,
      turn: typeof req.query.turn === "string" ? req.query.turn : null,
    });
    if (!result.ok) {
      respondProductServiceError(res, result, "Erro ao buscar data-flow.");
      return;
    }
    res.json({ success: true, data: { pipelines: result.data.pipelines } });
  } catch (err) {
    console.error("❌ [PRODUCTS/:productId/DATA-FLOW] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao buscar data flow." });
  }
});

export default router;
