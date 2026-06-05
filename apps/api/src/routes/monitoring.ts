/**
 * Monitoring router for apps/api
 * Handles /api/monitoring/picture-pages, /picture-links, /radar-groups, /radars, /seed-radars
 */
import { Router } from "express";
import type { Request } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import {
  picturePageSchema,
  pictureLinkSchema,
  radarGroupSchema,
  radarSchema,
} from "@silo/engine/validation/monitoring";
import * as monitoringService from "../services/monitoring-service.js";

const router = Router();
router.use(authMiddleware);

// ─── Picture Pages ────────────────────────────────────────────────────────────

router.get("/picture-pages", requirePermission("picturePages", "view"), async (_req, res) => {
  try {
    const items = await monitoringService.listPicturePages();
    res.json({ success: true, data: { items } });
  } catch (err) {
    console.error("❌ [MONITORING/PICTURE-PAGES] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao buscar páginas." });
  }
});

router.post("/picture-pages", requirePermission("picturePages", "manage"), async (req: Request, res) => {
  try {
    const result = picturePageSchema.omit({ id: true }).safeParse(req.body);
    if (!result.success) { res.status(400).json({ success: false, error: result.error.issues[0]?.message }); return; }
    const { id } = await monitoringService.createPicturePage(result.data);
    res.status(201).json({ success: true, data: { id }, message: "Página criada com sucesso" });
  } catch (err) {
    console.error("❌ [MONITORING/PICTURE-PAGES] POST:", err);
    res.status(500).json({ success: false, error: "Erro ao criar página." });
  }
});

router.put("/picture-pages", requirePermission("picturePages", "manage"), async (req: Request, res) => {
  try {
    const result = picturePageSchema.safeParse(req.body);
    if (!result.success) { res.status(400).json({ success: false, error: result.error.issues[0]?.message }); return; }
    await monitoringService.upsertPicturePage(result.data);
    res.json({ success: true, message: "Página salva com sucesso" });
  } catch (err) {
    console.error("❌ [MONITORING/PICTURE-PAGES] PUT:", err);
    res.status(500).json({ success: false, error: "Erro ao salvar página." });
  }
});

router.delete("/picture-pages", requirePermission("picturePages", "manage"), async (req: Request, res) => {
  try {
    const id = typeof req.query.id === "string" ? req.query.id : undefined;
    if (!id) { res.status(400).json({ success: false, error: "ID é obrigatório." }); return; }
    await monitoringService.deletePicturePage(id);
    res.json({ success: true, message: "Página excluída com sucesso" });
  } catch (err) {
    console.error("❌ [MONITORING/PICTURE-PAGES] DELETE:", err);
    res.status(500).json({ success: false, error: "Erro ao excluir página." });
  }
});

// ─── Picture Links ────────────────────────────────────────────────────────────

router.put("/picture-links", requirePermission("picturePages", "manage"), async (req: Request, res) => {
  try {
    const result = pictureLinkSchema.safeParse(req.body);
    if (!result.success) { res.status(400).json({ success: false, error: result.error.issues[0]?.message }); return; }
    await monitoringService.upsertPictureLink(result.data);
    res.json({ success: true, message: "Link salvo com sucesso" });
  } catch (err) {
    console.error("❌ [MONITORING/PICTURE-LINKS] PUT:", err);
    res.status(500).json({ success: false, error: "Erro ao salvar link." });
  }
});

router.delete("/picture-links", requirePermission("picturePages", "manage"), async (req: Request, res) => {
  try {
    const id = typeof req.query.id === "string" ? req.query.id : undefined;
    if (!id) { res.status(400).json({ success: false, error: "ID é obrigatório." }); return; }
    await monitoringService.deletePictureLink(id);
    res.json({ success: true, message: "Link excluído com sucesso" });
  } catch (err) {
    console.error("❌ [MONITORING/PICTURE-LINKS] DELETE:", err);
    res.status(500).json({ success: false, error: "Erro ao excluir link." });
  }
});

// ─── Radar Groups ─────────────────────────────────────────────────────────────

router.get("/radar-groups", requirePermission("radarGroups", "view"), async (_req, res) => {
  try {
    const groups = await monitoringService.listRadarGroups();
    res.json({ success: true, data: { items: groups } });
  } catch (err) {
    console.error("❌ [MONITORING/RADAR-GROUPS] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao buscar grupos de radares." });
  }
});

router.post("/radar-groups", requirePermission("radarGroups", "manage"), async (req: Request, res) => {
  try {
    const result = radarGroupSchema.safeParse(req.body);
    if (!result.success) { res.status(400).json({ success: false, error: result.error.issues[0]?.message }); return; }
    await monitoringService.createRadarGroup(result.data);
    res.status(201).json({ success: true, message: "Grupo criado com sucesso" });
  } catch (err) {
    console.error("❌ [MONITORING/RADAR-GROUPS] POST:", err);
    res.status(500).json({ success: false, error: "Erro ao criar grupo." });
  }
});

router.put("/radar-groups", requirePermission("radarGroups", "manage"), async (req: Request, res) => {
  try {
    const result = radarGroupSchema.safeParse(req.body);
    if (!result.success) { res.status(400).json({ success: false, error: result.error.issues[0]?.message }); return; }
    await monitoringService.updateRadarGroup(result.data);
    res.json({ success: true, message: "Grupo atualizado com sucesso" });
  } catch (err) {
    console.error("❌ [MONITORING/RADAR-GROUPS] PUT:", err);
    res.status(500).json({ success: false, error: "Erro ao atualizar grupo." });
  }
});

router.delete("/radar-groups", requirePermission("radarGroups", "manage"), async (req: Request, res) => {
  try {
    const id = typeof req.query.id === "string" ? req.query.id : undefined;
    if (!id) { res.status(400).json({ success: false, error: "ID é obrigatório." }); return; }
    await monitoringService.deleteRadarGroup(id);
    res.json({ success: true, message: "Grupo excluído com sucesso" });
  } catch (err) {
    if (err instanceof Error && err.message === "Este grupo possui radares vinculados e não pode ser excluído.") {
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    console.error("❌ [MONITORING/RADAR-GROUPS] DELETE:", err);
    res.status(500).json({ success: false, error: "Erro ao excluir grupo." });
  }
});

// ─── Radars ───────────────────────────────────────────────────────────────────

router.get("/radars", requirePermission("radars", "view"), async (_req, res) => {
  try {
    const items = await monitoringService.listRadars();
    res.json({ success: true, data: { items } });
  } catch (err) {
    console.error("❌ [MONITORING/RADARS] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao buscar radares." });
  }
});

router.put("/radars", requirePermission("radars", "manage"), async (req: Request, res) => {
  try {
    const result = radarSchema.safeParse(req.body);
    if (!result.success) { res.status(400).json({ success: false, error: result.error.issues[0]?.message }); return; }
    await monitoringService.upsertRadar(result.data);
    res.json({ success: true, message: "Radar salvo com sucesso" });
  } catch (err) {
    console.error("❌ [MONITORING/RADARS] PUT:", err);
    res.status(500).json({ success: false, error: "Erro ao salvar radar." });
  }
});

router.delete("/radars", requirePermission("radars", "manage"), async (req: Request, res) => {
  try {
    const id = typeof req.query.id === "string" ? req.query.id : undefined;
    if (!id) { res.status(400).json({ success: false, error: "ID é obrigatório." }); return; }
    await monitoringService.deleteRadar(id);
    res.json({ success: true, message: "Radar excluído com sucesso" });
  } catch (err) {
    console.error("❌ [MONITORING/RADARS] DELETE:", err);
    res.status(500).json({ success: false, error: "Erro ao excluir radar." });
  }
});

// ─── Seed Radars ──────────────────────────────────────────────────────────────

router.post("/seed-radars", requirePermission("radars", "manage"), async (_req, res) => {
  try {
    // Seed from packages/db will be added in S9; for now just respond success
    res.json({ success: true, message: "Seed de monitoramento executado com sucesso" });
  } catch (err) {
    console.error("❌ [MONITORING/SEED-RADARS]:", err);
    res.status(500).json({ success: false, error: "Erro ao executar seed." });
  }
});

// POST /api/monitoring/products — get monitoring products from Kafka
router.post("/products", authMiddleware, async (req, res) => {
  try {
    const body = req.body as { products?: { slug: string; name: string }[] };
    const activeProducts = Array.isArray(body.products) ? body.products : [];
    const { getMonitoringProductsFromKafkaRest } = await import("../dataflow/kafka-data-flow-source.js");
    const data = await getMonitoringProductsFromKafkaRest(activeProducts);
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ [API_MONITORING] POST /products:", err);
    res.status(500).json({ success: false, error: "Erro ao carregar dados de monitoramento" });
  }
});

export default router;
