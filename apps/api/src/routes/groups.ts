import { Router } from "express";
import type { Response as ExpressResponse } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { validate } from "../middleware/validate.js";
import * as groupService from "../services/group-service.js";
import { z } from "zod";

const router = Router();

type GroupServiceErrorResult = {
  error: unknown;
  status?: number;
  field?: string;
};

const respondGroupServiceError = (
  res: ExpressResponse,
  result: unknown,
  fallbackMessage: string,
): boolean => {
  if (typeof result !== "object" || result === null || !("error" in result)) {
    return false;
  }

  const errorResult = result as GroupServiceErrorResult;
  const payload: { success: false; error: string; field?: string } = {
    success: false,
    error: typeof errorResult.error === "string" ? errorResult.error : fallbackMessage,
  };

  if (typeof errorResult.field === "string") payload.field = errorResult.field;

  res.status(typeof errorResult.status === "number" ? errorResult.status : 400).json(payload);
  return true;
};

const CreateGroupSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres"),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  role: z.string().optional().nullable(),
  active: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

const UpdateGroupSchema = CreateGroupSchema.extend({
  id: z.string().min(1, "ID é obrigatório"),
});

// GET /api/groups
router.get("/", authMiddleware, requirePermission("groups", "list"), async (req, res) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const result = await groupService.listGroups({ search, status });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("❌ [API_GROUPS] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao carregar grupos" });
  }
});

// POST /api/groups
router.post("/", authMiddleware, requirePermission("groups", "create"), validate(CreateGroupSchema), async (req, res) => {
  try {
    const result = await groupService.createGroup(req.body);
    if ("error" in result) { respondGroupServiceError(res, result, "Erro ao criar grupo."); return; }
    res.status(201).json({ success: true, data: result, message: "Grupo criado com sucesso." });
  } catch (err) {
    console.error("❌ [API_GROUPS] POST:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

// PUT /api/groups
router.put("/", authMiddleware, requirePermission("groups", "update"), validate(UpdateGroupSchema), async (req, res) => {
  try {
    const result = await groupService.updateGroup(req.body);
    if ("error" in result) { respondGroupServiceError(res, result, "Erro ao atualizar grupo."); return; }
    res.json({ success: true, data: result, message: "Grupo atualizado com sucesso." });
  } catch (err) {
    console.error("❌ [API_GROUPS] PUT:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

// DELETE /api/groups?id=...
router.delete("/", authMiddleware, requirePermission("groups", "delete"), async (req, res) => {
  try {
    const id = typeof req.query.id === "string" ? req.query.id : undefined;
    if (!id) { res.status(400).json({ success: false, error: "ID é obrigatório." }); return; }
    const result = await groupService.deleteGroup(id);
    if ("error" in result) { respondGroupServiceError(res, result, "Erro ao excluir grupo."); return; }
    res.json({ success: true, message: "Grupo excluído com sucesso." });
  } catch (err) {
    console.error("❌ [API_GROUPS] DELETE:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

// GET /api/groups/permissions?groupId=
router.get("/permissions", authMiddleware, requirePermission("groups", "list"), async (req, res) => {
  try {
    const groupId = typeof req.query.groupId === "string" ? req.query.groupId : undefined;
    if (!groupId) { res.status(400).json({ success: false, error: "groupId é obrigatório." }); return; }
    const result = await groupService.getGroupPermissions(groupId);
    if ("error" in result) { respondGroupServiceError(res, result, "Erro ao carregar permissões."); return; }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error("❌ [API_GROUPS/PERMISSIONS] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao carregar permissões" });
  }
});

// PUT /api/groups/permissions — toggle a single permission
router.put("/permissions", authMiddleware, requirePermission("groups", "update"), async (req, res) => {
  try {
    const { groupId, resource, action, enabled } = req.body as Record<string, unknown>;
    if (!groupId || !resource || !action || typeof enabled !== "boolean") {
      res.status(400).json({ success: false, error: "groupId, resource, action e enabled são obrigatórios." }); return;
    }
    const groupIdStr = String(groupId);
    const resourceStr = String(resource);
    const actionStr = String(action);
    const result = await groupService.updateGroupPermission({ groupId: groupIdStr, resource: resourceStr, action: actionStr, enabled });
    if ("error" in result) { respondGroupServiceError(res, result, "Erro ao atualizar permissão."); return; }

    res.json({ success: true, data: result.data, message: result.message });
  } catch (err) {
    console.error("❌ [API_GROUPS/PERMISSIONS] PUT:", err);
    res.status(500).json({ success: false, error: "Erro ao atualizar permissão" });
  }
});

// DELETE /api/groups/users?userId=&groupId= — remove user from group
router.delete("/users", authMiddleware, requirePermission("groups", "update"), async (req, res) => {
  try {
    const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
    const groupId = typeof req.query.groupId === "string" ? req.query.groupId : undefined;
    if (!userId || !groupId) { res.status(400).json({ success: false, error: "userId e groupId são obrigatórios." }); return; }
    await groupService.removeUserFromGroup(userId, groupId);
    res.json({ success: true, message: "Usuário removido do grupo com sucesso." });
  } catch (err) {
    console.error("❌ [API_GROUPS/USERS] DELETE:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

export default router;
