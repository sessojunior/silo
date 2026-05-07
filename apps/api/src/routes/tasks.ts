import { Router } from "express";
import type { Response } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { getTaskHistory, getTaskUsers, setTaskUsers } from "../services/task-service.js";

const router = Router();
router.use(authMiddleware);

function respondTaskServiceError(
  res: Response,
  result: { error?: string; status?: number },
  defaultMessage: string,
) {
  res.status(result.status || 400).json({ success: false, error: result.error || defaultMessage });
}

// GET /tasks/:taskId/history
router.get("/:taskId/history", requirePermission("projectTasks", "list"), async (req, res) => {
  try {
    const result = await getTaskHistory(String(req.params.taskId));
    if ("error" in result) {
      respondTaskServiceError(res, result, "Erro ao buscar histórico da tarefa.");
      return;
    }
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("❌ [TASKS_HISTORY] GET:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

// GET /tasks/:taskId/users
router.get("/:taskId/users", requirePermission("projectTasks", "list"), async (req, res) => {
  try {
    const users = await getTaskUsers(String(req.params.taskId));
    if ("error" in users) {
      respondTaskServiceError(res, users, "Erro ao buscar usuários da tarefa.");
      return;
    }
    res.json({ success: true, data: users });
  } catch (err) {
    console.error("❌ [TASKS_USERS] GET:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

// POST /tasks/:taskId/users
router.post("/:taskId/users", requirePermission("projectTasks", "update"), async (req, res) => {
  const { userIds, role } = req.body as { userIds?: unknown; role?: string };
  if (!Array.isArray(userIds)) {
    res.status(400).json({ success: false, error: "IDs de usuários são obrigatórios." });
    return;
  }
  try {
    const result = await setTaskUsers(String(req.params.taskId), userIds as string[], role);
    if ("error" in result) {
      respondTaskServiceError(res, result, "Erro ao associar usuários à tarefa.");
      return;
    }
    res.json({ success: true, data: { success: true }, message: "Usuários associados com sucesso" });
  } catch (err) {
    console.error("❌ [TASKS_USERS] POST:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

export default router;
