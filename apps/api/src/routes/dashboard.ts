import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/permissions.js";
import {
  getDashboardData,
  getDashboardSummary,
  getDashboardProblemsCauses,
  getDashboardProblemsSolutions,
  getDashboardProjects,
} from "../services/dashboard-service.js";

const router = Router();

// GET /api/dashboard
router.get("/", authMiddleware, requireAdmin(), async (_req, res) => {
  try {
    const data = await getDashboardData();
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ [API_DASHBOARD] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao obter dados dos produtos" });
  }
});

// GET /api/dashboard/summary
router.get("/summary", authMiddleware, requireAdmin(), async (_req, res) => {
  try {
    const data = await getDashboardSummary();
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ [API_DASHBOARD/SUMMARY] GET:", err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});

// GET /api/dashboard/problems-causes
router.get("/problems-causes", authMiddleware, requireAdmin(), async (_req, res) => {
  try {
    const data = await getDashboardProblemsCauses();
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ [API_DASHBOARD/PROBLEMS-CAUSES] GET:", err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});

// GET /api/dashboard/problems-solutions
router.get("/problems-solutions", authMiddleware, requireAdmin(), async (_req, res) => {
  try {
    const data = await getDashboardProblemsSolutions();
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ [API_DASHBOARD/PROBLEMS-SOLUTIONS] GET:", err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});

// GET /api/dashboard/projects
router.get("/projects", authMiddleware, requireAdmin(), async (_req, res) => {
  try {
    const data = await getDashboardProjects();
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ [API_DASHBOARD/PROJECTS] GET:", err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});

export default router;
