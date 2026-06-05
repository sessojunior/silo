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
import {
  listProjectActivityTasks,
  PROJECT_TASK_STATUSES,
  createProjectActivityTask,
  updateProjectActivityTask,
  deleteProjectActivityTask,
  reorderProjectActivityTasks,
} from "../services/project-task-service.js";

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

const TaskOrderSchema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(PROJECT_TASK_STATUSES),
  sort: z.number().int().nonnegative(),
});

const ReorderTasksSchema = z.object({
  tasksBeforeMove: z.array(TaskOrderSchema).min(1),
  tasksAfterMove: z.array(TaskOrderSchema).min(1),
});

const TaskBaseSchema = z.object({
  projectId: z.string().uuid(),
  projectActivityId: z.string().uuid(),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  category: z.string().nullable().optional(),
  estimatedDays: z.number().int().nonnegative().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  status: z.enum(PROJECT_TASK_STATUSES),
});

const CreateTaskSchema = TaskBaseSchema;

const UpdateTaskSchema = TaskBaseSchema.extend({
  id: z.string().uuid(),
});

const DeleteTaskSchema = z.object({
  id: z.string().uuid(),
});

const getQueryStringValue = (
  value: unknown,
): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

// ── Projects CRUD ──────────────────────────────────────────────────────────

router.get("/", requirePermission("projects", "view"), async (req, res) => {
  try {
    const search = getQueryStringValue(req.query.search);
    const status = getQueryStringValue(req.query.status);
    const priority = getQueryStringValue(req.query.priority);
    const result = await listProjects({ search, status, priority });
    if ("error" in result) {
      respondProjectServiceError(res, result, "Erro ao listar projetos.");
      return;
    }
    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("❌ [PROJECTS] GET:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

router.post("/", requirePermission("projects", "manage"), validate(ProjectSchema), async (req, res) => {
  try {
    const result = await createProject(req.body);
    if (respondProjectServiceError(res, result, "Erro ao criar projeto.")) {
      return;
    }
    res.status(201).json({ success: true, data: result.data, message: "Projeto criado com sucesso" });
  } catch (err) {
    console.error("❌ [PROJECTS] POST:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

router.put("/", requirePermission("projects", "manage"), validate(UpdateProjectSchema), async (req, res) => {
  try {
    const result = await updateProject(req.body);
    if ("error" in result) { respondProjectServiceError(res, result, "Erro ao atualizar projeto."); return; }
    res.json({ success: true, data: result.data, message: "Projeto atualizado com sucesso" });
  } catch (err) {
    console.error("❌ [PROJECTS] PUT:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

router.delete("/", requirePermission("projects", "manage"), async (req, res) => {
  const id = getQueryStringValue(req.query.id);
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

router.get("/:projectId/activities", requirePermission("projectActivities", "view"), async (req, res) => {
  try {
    const result = await listProjectActivities(String(req.params.projectId));
    if ("error" in result) { respondProjectServiceError(res, result, "Erro ao listar atividades."); return; }
    res.json({ success: true, data: { activities: result.data }, activities: result.data });
  } catch (err) {
    console.error("❌ [PROJECTS_ACTIVITIES] GET:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

router.post("/:projectId/activities", requirePermission("projectActivities", "manage"), validate(ActivityBaseSchema), async (req, res) => {
  try {
    const result = await createProjectActivity(String(req.params.projectId), req.body);
    if (result && "error" in result) { respondProjectServiceError(res, result, "Erro ao criar atividade."); return; }
    res.status(201).json({ success: true, data: { activity: result.data }, activity: result.data, message: "Atividade criada com sucesso" });
  } catch (err) {
    console.error("❌ [PROJECTS_ACTIVITIES] POST:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

router.put("/:projectId/activities", requirePermission("projectActivities", "manage"), validate(UpdateActivitySchema), async (req, res) => {
  try {
    const result = await updateProjectActivity(String(req.params.projectId), req.body);
    if ("error" in result) { respondProjectServiceError(res, result, "Erro ao atualizar atividade."); return; }
    res.json({ success: true, data: { activity: result.data }, activity: result.data, message: "Atividade atualizada com sucesso" });
  } catch (err) {
    console.error("❌ [PROJECTS_ACTIVITIES] PUT:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

router.delete("/:projectId/activities", requirePermission("projectActivities", "manage"), async (req, res) => {
  const activityId = getQueryStringValue(req.query.activityId);
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
  requirePermission("projectTasks", "view"),
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

router.post(
  "/:projectId/activities/:activityId/tasks",
  requirePermission("projectTasks", "manage"),
  validate(CreateTaskSchema),
  async (req, res) => {
    try {
      const user = req.user!;
      const result = await createProjectActivityTask(
        String(req.params.projectId),
        String(req.params.activityId),
        user.id,
        req.body,
      );

      if ("error" in result) {
        respondProjectServiceError(res, result, "Erro ao criar tarefa.");
        return;
      }

      res.status(201).json({
        success: true,
        data: { task: result.task },
        task: result.task,
        message: "Tarefa criada com sucesso",
      });
    } catch (err) {
      console.error("❌ [PROJECTS_ACTIVITY_TASKS] POST:", err);
      res.status(500).json({ success: false, error: "Erro interno do servidor" });
    }
  },
);

router.put(
  "/:projectId/activities/:activityId/tasks",
  requirePermission("projectTasks", "manage"),
  validate(UpdateTaskSchema),
  async (req, res) => {
    try {
      const user = req.user!;
      const result = await updateProjectActivityTask(
        String(req.params.projectId),
        String(req.params.activityId),
        user.id,
        req.body,
      );

      if ("error" in result) {
        respondProjectServiceError(res, result, "Erro ao atualizar tarefa.");
        return;
      }

      res.json({
        success: true,
        data: { task: result.task },
        task: result.task,
        message: "Tarefa atualizada com sucesso",
      });
    } catch (err) {
      console.error("❌ [PROJECTS_ACTIVITY_TASKS] PUT:", err);
      res.status(500).json({ success: false, error: "Erro interno do servidor" });
    }
  },
);

router.delete(
  "/:projectId/activities/:activityId/tasks",
  requirePermission("projectTasks", "manage"),
  validate(DeleteTaskSchema),
  async (req, res) => {
    try {
      const result = await deleteProjectActivityTask(
        String(req.params.projectId),
        String(req.params.activityId),
        req.body.id,
      );

      if ("error" in result) {
        respondProjectServiceError(res, result, "Erro ao excluir tarefa.");
        return;
      }

      res.json({ success: true, message: "Tarefa excluída com sucesso" });
    } catch (err) {
      console.error("❌ [PROJECTS_ACTIVITY_TASKS] DELETE:", err);
      res.status(500).json({ success: false, error: "Erro interno do servidor" });
    }
  },
);

router.patch(
  "/:projectId/activities/:activityId/tasks",
  requirePermission("projectTasks", "manage"),
  validate(ReorderTasksSchema),
  async (req, res) => {
    try {
      const user = req.user!;
      const result = await reorderProjectActivityTasks(
        String(req.params.projectId),
        String(req.params.activityId),
        user.id,
        req.body.tasksBeforeMove,
        req.body.tasksAfterMove,
      );

      if ("error" in result) {
        if (result.status === 409) {
          const conflictTasks = result.tasks ?? [];

          res.status(409).json({
            success: false,
            error: result.error,
            data: { tasks: conflictTasks },
            tasks: conflictTasks,
          });
          return;
        }

        respondProjectServiceError(res, result, "Erro ao reordenar tarefas.");
        return;
      }

      res.json({
        success: true,
        data: { tasks: result.tasks },
        tasks: result.tasks,
        message: "Movimentação salva com sucesso",
      });
    } catch (err) {
      console.error("❌ [PROJECTS_ACTIVITY_TASKS] PATCH:", err);
      res.status(500).json({ success: false, error: "Erro interno do servidor" });
    }
  },
);

export default router;
