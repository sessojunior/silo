import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { validate } from "../middleware/validate.js";
import { respondServiceError as respondGroupServiceError } from "../lib/respond-service-error.js";
import * as groupService from "../services/group-service.js";
import { z } from "zod";
import {
  groupCreateSchema,
  groupDeleteQuerySchema,
  groupListQuerySchema,
  groupPermissionUpdateSchema,
  groupPermissionsQuerySchema,
  groupRemoveUserSchema,
  groupUpdateSchema,
} from "@silo/engine/validation/groups";

const router = Router();

// GET /api/groups
router.get(
  "/",
  authMiddleware,
  requirePermission("groups", "view"),
  validate(groupListQuerySchema, "query"),
  async (req, res) => {
  try {
    const { search, status } = req.query as z.infer<typeof groupListQuerySchema>;
    const result = await groupService.listGroups({ search, status });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("❌ [API_GROUPS] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao carregar grupos" });
  }
  },
);

// POST /api/groups
router.post("/", authMiddleware, requirePermission("groups", "manage"), validate(groupCreateSchema), async (req, res) => {
  try {
    const result = await groupService.createGroup(req.body);
    if (!result.ok) {
      respondGroupServiceError(res, result, "Erro ao criar grupo.");
      return;
    }
    res.status(201).json({ success: true, data: result.data, message: "Grupo criado com sucesso." });
  } catch (err) {
    console.error("❌ [API_GROUPS] POST:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

// PUT /api/groups
router.put("/", authMiddleware, requirePermission("groups", "manage"), validate(groupUpdateSchema), async (req, res) => {
  try {
    const result = await groupService.updateGroup(req.body);
    if (!result.ok) {
      respondGroupServiceError(res, result, "Erro ao atualizar grupo.");
      return;
    }
    res.json({ success: true, data: result.data, message: "Grupo atualizado com sucesso." });
  } catch (err) {
    console.error("❌ [API_GROUPS] PUT:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

// DELETE /api/groups?id=...
router.delete(
  "/",
  authMiddleware,
  requirePermission("groups", "manage"),
  validate(groupDeleteQuerySchema, "query"),
  async (req, res) => {
  try {
    const { id } = req.query as z.infer<typeof groupDeleteQuerySchema>;
    const result = await groupService.deleteGroup(id);
    if (respondGroupServiceError(res, result, "Erro ao excluir grupo.")) { return; }
    res.json({ success: true, message: "Grupo excluído com sucesso." });
  } catch (err) {
    console.error("❌ [API_GROUPS] DELETE:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
  },
);

// GET /api/groups/permissions?groupId=
router.get(
  "/permissions",
  authMiddleware,
  requirePermission("groups", "view"),
  validate(groupPermissionsQuerySchema, "query"),
  async (req, res) => {
  try {
    const { groupId } = req.query as z.infer<typeof groupPermissionsQuerySchema>;
    const result = await groupService.getGroupPermissions(groupId);
    if (!result.ok) {
      respondGroupServiceError(res, result, "Erro ao carregar permissões.");
      return;
    }

    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("❌ [API_GROUPS/PERMISSIONS] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao carregar permissões" });
  }
  },
);

// PUT /api/groups/permissions — toggle a single permission
router.put(
  "/permissions",
  authMiddleware,
  requirePermission("groups", "manage"),
  validate(groupPermissionUpdateSchema),
  async (req, res) => {
  try {
    const { groupId, resource, action, enabled } = req.body as z.infer<typeof groupPermissionUpdateSchema>;
    const result = await groupService.updateGroupPermission({ groupId, resource, action, enabled });
    if (!result.ok) {
      respondGroupServiceError(res, result, "Erro ao atualizar permissão.");
      return;
    }

    res.json({ success: true, data: result.data, message: result.message });
  } catch (err) {
    console.error("❌ [API_GROUPS/PERMISSIONS] PUT:", err);
    res.status(500).json({ success: false, error: "Erro ao atualizar permissão" });
  }
  },
);

// DELETE /api/groups/users?userId=&groupId= — remove user from group
router.delete(
  "/users",
  authMiddleware,
  requirePermission("groups", "manage"),
  validate(groupRemoveUserSchema, "query"),
  async (req, res) => {
  try {
    const { userId, groupId } = req.query as z.infer<typeof groupRemoveUserSchema>;
    await groupService.removeUserFromGroup(userId, groupId);
    res.json({ success: true, message: "Usuário removido do grupo com sucesso." });
  } catch (err) {
    console.error("❌ [API_GROUPS/USERS] DELETE:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
  },
);

export default router;
