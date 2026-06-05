import { Router } from "express";
import type { Request } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { validate } from "../middleware/validate.js";
import { respondServiceError as respondContactServiceError } from "../lib/respond-service-error.js";
import * as contactService from "../services/contact-service.js";
import {
  contactCreateSchema,
  contactDeleteSchema,
  contactListQuerySchema,
  contactUpdateSchema,
} from "@silo/engine/validation/contacts";

const router = Router();

type ContactCreateInput = import("zod").infer<typeof contactCreateSchema>;
type ContactDeleteInput = import("zod").infer<typeof contactDeleteSchema>;
type ContactListQueryInput = import("zod").infer<typeof contactListQuerySchema>;
type ContactUpdateInput = import("zod").infer<typeof contactUpdateSchema>;

// GET /api/contacts
router.get(
  "/",
  authMiddleware,
  requirePermission("contacts", "view"),
  validate(contactListQuerySchema, "query"),
  async (req: Request<Record<string, never>, unknown, never, ContactListQueryInput>, res) => {
  try {
    const { search, status } = req.query;
    const result = await contactService.listContacts({ search, status });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("❌ [API_CONTACTS] GET:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
  },
);

// POST /api/contacts — accepts JSON body (imageUrl for pre-uploaded image)
router.post(
  "/",
  authMiddleware,
  requirePermission("contacts", "manage"),
  validate(contactCreateSchema),
  async (req: Request<Record<string, never>, unknown, ContactCreateInput>, res) => {
  try {
    const body = req.body;

    const result = await contactService.createContact({
      name: body.name,
      role: body.role,
      team: body.team,
      email: body.email,
      phone: body.phone,
      imageUrl: body.imageUrl,
      active: body.active,
    });
    if (!result.ok) {
      respondContactServiceError(res, result, "Erro ao criar contato.");
      return;
    }
    res.status(201).json({ success: true, data: result.data, message: "Contato criado com sucesso" });
  } catch (err) {
    console.error("❌ [API_CONTACTS] POST:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
  },
);

// PUT /api/contacts
router.put(
  "/",
  authMiddleware,
  requirePermission("contacts", "manage"),
  validate(contactUpdateSchema),
  async (req: Request<Record<string, never>, unknown, ContactUpdateInput>, res) => {
  try {
    const body = req.body;

    const result = await contactService.updateContact({
      id: body.id,
      name: body.name,
      role: body.role,
      team: body.team,
      email: body.email,
      phone: body.phone,
      imageUrl: body.imageUrl,
      active: body.active,
      removeImage: body.removeImage,
    });
    if (respondContactServiceError(res, result, "Erro ao atualizar contato.")) { return; }
    res.json({ success: true, message: "Contato atualizado com sucesso" });
  } catch (err) {
    console.error("❌ [API_CONTACTS] PUT:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
  },
);

// DELETE /api/contacts — body: { id }
router.delete(
  "/",
  authMiddleware,
  requirePermission("contacts", "manage"),
  validate(contactDeleteSchema),
  async (req: Request<Record<string, never>, unknown, ContactDeleteInput>, res) => {
  try {
    const result = await contactService.deleteContact(req.body.id);
    if (respondContactServiceError(res, result, "Erro ao excluir contato.")) { return; }
    res.json({ success: true, message: "Contato excluído com sucesso" });
  } catch (err) {
    console.error("❌ [API_CONTACTS] DELETE:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
  },
);

export default router;
