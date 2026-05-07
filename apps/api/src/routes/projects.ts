import { Router } from "express";
import type { Response as ExpressResponse } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { validate } from "../middleware/validate.js";
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  listProjectActivities,
  createProjectActivity,
  updateProjectActivity,
  deleteProjectActivity,
} from "../services/project-service.js";
import { listProjectActivityTasks } from "../services/project-task-service.js";

const router = Router();
router.use(authMiddleware);

type ProjectServiceErrorResult = {
  error: unknown;
  status?: number;
};

const respondProjectServiceError = (
  res: ExpressResponse,
  result: unknown,
  fallbackMessage: string,
): boolean => {
  if (typeof result !== "object" || result === null || !("error" in result)) {
    return false;
  }

  const errorResult = result as ProjectServiceErrorResult;
  res.status(typeof errorResult.status === "number" ? errorResult.status : 400).json({
    success: false,
    error: typeof errorResult.error === "string" ? errorResult.error : fallbackMessage,
  });
  return true;
};

const ProjectSchema = z.object({
  name: z.string().min(1).max(255),
  shortDescription: z.string().min(1).max(500),
  description: z.string().min(1),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z.enum(["active", "completed", "paused", "cancelled"]).default("active"),
});

const UpdateProjectSchema = ProjectSchema.extend({
  id: z.string().uuid(),
});

const ActivityBaseSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  category: z.string().nullable().optional(),
  estimatedDays: z.number().nonnegative().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  status: z.enum(["todo", "progress", "done", "blocked"]).optional(),
});

const UpdateActivitySchema = ActivityBaseSchema.extend({ id: z.string().uuid() });

// ── Projects CRUD ──────────────────────────────────────────────────────────

router.get("/", requirePermission("projects", "list"), async (req, res) => {
  try {
    const { search, status, priority } = req.query as Record<string, string>;
    const projects = await listProjects({ search, status, priority });
    res.json({ success: true, data: projects });
  } catch (err) {
    console.error("❌ [PROJECTS] GET:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

router.post("/", requirePermission("projects", "create"), validate(ProjectSchema), async (req, res) => {
  try {
    const project = await createProject(req.body);
    res.status(201).json({ success: true, data: project, message: "Projeto criado com sucesso" });
  } catch (err) {
    console.error("❌ [PROJECTS] POST:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

router.put("/", requirePermission("projects", "update"), validate(UpdateProjectSchema), async (req, res) => {
  try {
    const result = await updateProject(req.body);
    if ("error" in result) { respondProjectServiceError(res, result, "Erro ao atualizar projeto."); return; }
    res.json({ success: true, data: result, message: "Projeto atualizado com sucesso" });
  } catch (err) {
    console.error("❌ [PROJECTS] PUT:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

router.delete("/", requirePermission("projects", "delete"), async (req, res) => {
  const { id } = req.query as Record<string, string>;
  if (!id) {
    res.status(400).json({ success: false, error: "ID do projeto é obrigatório." });
    return;
  }
  try {
    const result = await deleteProject(id);
    if ("error" in result) { respondProjectServiceError(res, result, "Erro ao excluir projeto."); return; }
    res.json({ success: true, message: "Projeto excluído com sucesso" });
  } catch (err) {
    console.error("❌ [PROJECTS] DELETE:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

// ── Project Activities ────────────────────────────────────────────────────

router.get("/:projectId/activities", requirePermission("projectActivities", "list"), async (req, res) => {
  try {
    const result = await listProjectActivities(String(req.params.projectId));
    if ("error" in result) { respondProjectServiceError(res, result, "Erro ao listar atividades."); return; }
    res.json({ success: true, data: { activities: result } });
  } catch (err) {
    console.error("❌ [PROJECTS_ACTIVITIES] GET:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

router.post("/:projectId/activities", requirePermission("projectActivities", "create"), validate(ActivityBaseSchema), async (req, res) => {
  try {
    const result = await createProjectActivity(String(req.params.projectId), req.body);
    if (result && "error" in result) { respondProjectServiceError(res, result, "Erro ao criar atividade."); return; }
    res.status(201).json({ success: true, data: result, message: "Atividade criada com sucesso" });
  } catch (err) {
    console.error("❌ [PROJECTS_ACTIVITIES] POST:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

router.put("/:projectId/activities", requirePermission("projectActivities", "update"), validate(UpdateActivitySchema), async (req, res) => {
  try {
    const result = await updateProjectActivity(String(req.params.projectId), req.body);
    if ("error" in result) { respondProjectServiceError(res, result, "Erro ao atualizar atividade."); return; }
    res.json({ success: true, data: result, message: "Atividade atualizada com sucesso" });
  } catch (err) {
    console.error("❌ [PROJECTS_ACTIVITIES] PUT:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

router.delete("/:projectId/activities", requirePermission("projectActivities", "delete"), async (req, res) => {
  const { activityId } = req.query as Record<string, string>;
  if (!activityId) {
    res.status(400).json({ success: false, error: "ID da atividade é obrigatório." });
    return;
  }
  try {
    const result = await deleteProjectActivity(String(req.params.projectId), activityId);
    if ("error" in result) { respondProjectServiceError(res, result, "Erro ao excluir atividade."); return; }
    res.json({ success: true, message: "Atividade excluída com sucesso" });
  } catch (err) {
    console.error("❌ [PROJECTS_ACTIVITIES] DELETE:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

router.get(
  "/:projectId/activities/:activityId/tasks",
  requirePermission("projectTasks", "list"),
  async (req, res) => {
    try {
      const result = await listProjectActivityTasks(
        String(req.params.projectId),
        String(req.params.activityId),
      );

      if ("error" in result) {
        respondProjectServiceError(res, result, "Erro ao listar tarefas da atividade.");
        return;
      }

      res.json({ success: true, data: result });
    } catch (err) {
      console.error("❌ [PROJECTS_ACTIVITY_TASKS] GET:", err);
      res.status(500).json({ success: false, error: "Erro interno do servidor" });
    }
  },
);

export default router;
