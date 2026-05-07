import { Router } from "express";
import type { Response as ExpressResponse } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import * as contactService from "../services/contact-service.js";

const router = Router();

type ContactServiceErrorResult = {
  error: unknown;
  status?: number;
  field?: string;
};

const respondContactServiceError = (
  res: ExpressResponse,
  result: unknown,
  fallbackMessage: string,
): boolean => {
  if (typeof result !== "object" || result === null || !("error" in result)) {
    return false;
  }

  const errorResult = result as ContactServiceErrorResult;
  const payload: { success: false; error: string; field?: string } = {
    success: false,
    error: typeof errorResult.error === "string" ? errorResult.error : fallbackMessage,
  };

  if (typeof errorResult.field === "string") payload.field = errorResult.field;

  res.status(typeof errorResult.status === "number" ? errorResult.status : 400).json(payload);
  return true;
};

// GET /api/contacts
router.get("/", authMiddleware, requirePermission("contacts", "list"), async (req, res) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const result = await contactService.listContacts({ search, status });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("❌ [API_CONTACTS] GET:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

// POST /api/contacts — accepts JSON body (imageUrl for pre-uploaded image)
router.post("/", authMiddleware, requirePermission("contacts", "create"), async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const role = typeof body.role === "string" ? body.role.trim() : "";
    const team = typeof body.team === "string" ? body.team.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() || null : null;
    const active = typeof body.active === "boolean" ? body.active : true;

    if (name.length < 2) { res.status(400).json({ success: false, error: "Nome deve ter pelo menos 2 caracteres", field: "name" }); return; }
    if (role.length < 2) { res.status(400).json({ success: false, error: "Função deve ter pelo menos 2 caracteres", field: "role" }); return; }
    if (team.length < 2) { res.status(400).json({ success: false, error: "Equipe deve ter pelo menos 2 caracteres", field: "team" }); return; }
    if (!email.includes("@")) { res.status(400).json({ success: false, error: "Email inválido", field: "email" }); return; }

    const result = await contactService.createContact({ name, role, team, email, phone, imageUrl, active });
    if ("error" in result) { respondContactServiceError(res, result, "Erro ao criar contato."); return; }
    res.status(201).json({ success: true, data: result, message: "Contato criado com sucesso" });
  } catch (err) {
    console.error("❌ [API_CONTACTS] POST:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

// PUT /api/contacts
router.put("/", authMiddleware, requirePermission("contacts", "update"), async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) { res.status(400).json({ success: false, error: "ID é obrigatório" }); return; }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const role = typeof body.role === "string" ? body.role.trim() : "";
    const team = typeof body.team === "string" ? body.team.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() || null : null;
    const active = typeof body.active === "boolean" ? body.active : true;
    const removeImage = body.removeImage === true;

    if (name.length < 2) { res.status(400).json({ success: false, error: "Nome deve ter pelo menos 2 caracteres" }); return; }
    if (role.length < 2) { res.status(400).json({ success: false, error: "Função deve ter pelo menos 2 caracteres" }); return; }
    if (team.length < 2) { res.status(400).json({ success: false, error: "Equipe deve ter pelo menos 2 caracteres" }); return; }
    if (!email.includes("@")) { res.status(400).json({ success: false, error: "Email inválido" }); return; }

    const result = await contactService.updateContact({ id, name, role, team, email, phone, imageUrl, active, removeImage });
    if ("error" in result) { respondContactServiceError(res, result, "Erro ao atualizar contato."); return; }
    res.json({ success: true, message: "Contato atualizado com sucesso" });
  } catch (err) {
    console.error("❌ [API_CONTACTS] PUT:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

// DELETE /api/contacts — body: { id }
router.delete("/", authMiddleware, requirePermission("contacts", "delete"), async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) { res.status(400).json({ success: false, error: "ID é obrigatório" }); return; }
    const result = await contactService.deleteContact(id);
    if ("error" in result) { respondContactServiceError(res, result, "Erro ao excluir contato."); return; }
    res.json({ success: true, message: "Contato excluído com sucesso" });
  } catch (err) {
    console.error("❌ [API_CONTACTS] DELETE:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

export default router;
