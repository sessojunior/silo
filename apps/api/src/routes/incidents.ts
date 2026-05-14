import { Router } from "express";
import type { Response as ExpressResponse } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/permissions.js";
import { respondServiceError as respondIncidentServiceError } from "../lib/respond-service-error.js";
import {
  listIncidents,
  createIncident,
  getIncidentUsage,
  listIncidentImages,
  createIncidentImage,
  deleteIncidentImage,
  updateIncident,
  deleteIncident,
} from "../services/incident-service.js";

const router = Router();
router.use(authMiddleware);

const respondIncidentBadRequest = (res: ExpressResponse, message: string): void => {
  res.status(400).json({ success: false, error: message });
};

// GET /incidents
router.get("/", requireAdmin(), async (_req, res) => {
  try {
    const incidents = await listIncidents();
    res.json({ success: true, data: incidents });
  } catch (err) {
    console.error("❌ [INCIDENTS] GET:", err);
    res.status(500).json({ success: false, error: "Erro interno ao listar incidentes" });
  }
});

// POST /incidents
router.post("/", requireAdmin(), async (req, res) => {
  const { name, color } = req.body as { name?: string; color?: string };
  if (!name || name.trim().length < 2) {
    respondIncidentBadRequest(res, "Nome do incidente é obrigatório e deve ter pelo menos 2 caracteres.");
    return;
  }
  try {
    const result = await createIncident({ name, color });
    if (!result.ok) {
      respondIncidentServiceError(res, result, "Erro interno ao criar incidente");
      return;
    }
    const { data } = result;
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ [INCIDENTS] POST:", err);
    res.status(500).json({ success: false, error: "Erro interno ao criar incidente" });
  }
});

// PUT /incidents
router.put("/", requireAdmin(), async (req, res) => {
  const { id, name, color } = req.body as { id?: string; name?: string; color?: string };
  if (!id || !name || name.trim().length < 2) {
    respondIncidentBadRequest(res, "ID e nome do incidente são obrigatórios.");
    return;
  }
  try {
    const result = await updateIncident({ id, name, color });
    if (!result.ok) {
      respondIncidentServiceError(res, result, "Erro interno ao atualizar incidente");
      return;
    }
    res.json({ success: true, message: "Incidente atualizado com sucesso" });
  } catch (err) {
    console.error("❌ [INCIDENTS] PUT:", err);
    res.status(500).json({ success: false, error: "Erro interno ao atualizar incidente" });
  }
});

// DELETE /incidents?id=
router.delete("/", requireAdmin(), async (req, res) => {
  const { id } = req.query as Record<string, string>;
  if (!id) {
    respondIncidentBadRequest(res, "ID do incidente é obrigatório.");
    return;
  }
  try {
    const result = await deleteIncident(id);
    if (!result.ok) {
      respondIncidentServiceError(res, result, "Erro interno ao excluir incidente");
      return;
    }
    res.json({ success: true, data: { success: true } });
  } catch (err) {
    console.error("❌ [INCIDENTS] DELETE:", err);
    if (err instanceof Error && err.message.includes("foreign key")) {
      respondIncidentBadRequest(res, "Este incidente está sendo usado em outros registros e não pode ser excluído.");
      return;
    }
    res.status(500).json({ success: false, error: "Erro interno ao excluir incidente" });
  }
});

// GET /incidents/usage?incidentId=
router.get("/usage", requireAdmin(), async (req, res) => {
  try {
    const incidentId = typeof req.query.incidentId === "string" ? req.query.incidentId : undefined;
    if (!incidentId) { respondIncidentBadRequest(res, "ID do incidente é obrigatório."); return; }
    const result = await getIncidentUsage(incidentId);

    res.json({
      success: true,
      data: {
        inUse: result.data.inUse,
        usageCount: result.data.usageCount,
        usageDetails: result.data.usageDetails,
      },
    });
  } catch (err) {
    console.error("❌ [INCIDENTS] usage GET:", err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});

// GET /api/incidents/images
router.get("/images", requireAdmin(), async (_req, res) => {
  try {
    const result = await listIncidentImages();
    res.json({ success: true, data: { items: result.items } });
  } catch (err) {
    console.error("❌ [API_INCIDENTS] GET /images:", err);
    res.status(500).json({ success: false, error: "Erro ao listar imagens" });
  }
});

// POST /api/incidents/images
router.post("/images", requireAdmin(), async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const base64 = typeof body.image === "string" ? body.image : null;
    const filename = typeof body.filename === "string" ? body.filename : null;
    if (!base64 || !filename) {
      respondIncidentBadRequest(res, "Dados inválidos");
      return;
    }
    const result = await createIncidentImage({ image: base64, filename });
    if (!result.ok) {
      respondIncidentServiceError(res, result, "Erro ao salvar imagem");
      return;
    }
    res.json({ success: true, data: { filename: result.data.filename, url: result.data.url } });
  } catch (err) {
    console.error("❌ [API_INCIDENTS] POST /images:", err);
    res.status(500).json({ success: false, error: "Erro ao salvar imagem" });
  }
});

// DELETE /api/incidents/images?filename=
router.delete("/images", requireAdmin(), async (req, res) => {
  try {
    const filename = req.query.filename as string | undefined;
    if (!filename) {
      respondIncidentBadRequest(res, "Nome de arquivo inválido");
      return;
    }
    const result = await deleteIncidentImage(filename);
    if (!result.ok) {
      respondIncidentServiceError(res, result, "Erro ao excluir imagem");
      return;
    }
    res.json({ success: true, message: "Imagem excluída com sucesso" });
  } catch (err) {
    console.error("❌ [API_INCIDENTS] DELETE /images:", err);
    res.status(500).json({ success: false, error: "Erro ao excluir imagem" });
  }
});

export default router;
