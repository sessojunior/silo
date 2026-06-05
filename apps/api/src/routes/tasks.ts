import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { respondServiceError as respondTaskServiceError } from "../lib/respond-service-error.js";
import { getTaskHistory, getTaskUsers, setTaskUsers } from "../services/task-service.js";

const router = Router();
router.use(authMiddleware);

// GET /tasks/:taskId/history
router.get("/:taskId/history", requirePermission("projectTasks", "view"), async (req, res) => {
  try {
    const result = await getTaskHistory(String(req.params.taskId));
    if (!result.ok) {
      respondTaskServiceError(res, result, "Erro ao buscar histórico da tarefa.");
      return;
    }
    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("❌ [TASKS_HISTORY] GET:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

// GET /tasks/:taskId/users
router.get("/:taskId/users", requirePermission("projectTasks", "view"), async (req, res) => {
  try {
    const users = await getTaskUsers(String(req.params.taskId));
    if (!users.ok) {
      respondTaskServiceError(res, users, "Erro ao buscar usuários da tarefa.");
      return;
    }
    res.json({ success: true, data: users.data });
  } catch (err) {
    console.error("❌ [TASKS_USERS] GET:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

// POST /tasks/:taskId/users
router.post("/:taskId/users", requirePermission("projectTasks", "manage"), async (req, res) => {
  const { userIds, role } = req.body as { userIds?: unknown; role?: string };
  if (!Array.isArray(userIds)) {
    res.status(400).json({ success: false, error: "IDs de usuários são obrigatórios." });
    return;
  }
  try {
    const result = await setTaskUsers(String(req.params.taskId), userIds as string[], role);
    if (!result.ok) {
      respondTaskServiceError(res, result, "Erro ao associar usuários à tarefa.");
      return;
    }
    res.json({ success: true, data: result.data, message: "Usuários associados com sucesso" });
  } catch (err) {
    console.error("❌ [TASKS_USERS] POST:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

export default router;
