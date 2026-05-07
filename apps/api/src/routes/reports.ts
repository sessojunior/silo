import { Router } from "express";
import type { Request } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import {
  getAvailabilityReport,
  getExecutiveReport,
  getProblemsReport,
  getProjectsReport,
  parsePeriod,
} from "../services/report-service.js";

const router = Router();

router.use(authMiddleware);

router.get("/availability", requirePermission("reports", "view"), async (req: Request, res) => {
  try {
    const data = await getAvailabilityReport(
      parsePeriod(req.query as Record<string, string | undefined>),
    );
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ [REPORTS/AVAILABILITY]:", err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});

router.get("/problems", requirePermission("reports", "view"), async (req: Request, res) => {
  try {
    const { start, end } = parsePeriod(req.query as Record<string, string | undefined>);
    const productId = typeof req.query.productId === "string" ? req.query.productId : undefined;
    const problemCategory = typeof req.query.problemCategory === "string" ? req.query.problemCategory : undefined;
    const data = await getProblemsReport({ start, end }, productId, problemCategory);
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ [REPORTS/PROBLEMS]:", err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});

router.get("/executive", requirePermission("reports", "view"), async (req: Request, res) => {
  try {
    const { start, end } = parsePeriod(req.query as Record<string, string | undefined>);
    const productId = typeof req.query.productId === "string" ? req.query.productId : undefined;
    const groupId = typeof req.query.groupId === "string" ? req.query.groupId : undefined;
    const data = await getExecutiveReport({ start, end }, productId, groupId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ [REPORTS/EXECUTIVE]:", err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});

router.get("/projects", requirePermission("reports", "view"), async (req: Request, res) => {
  try {
    const data = await getProjectsReport(
      parsePeriod(req.query as Record<string, string | undefined>),
    );
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ [REPORTS/PROJECTS]:", err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});

export default router;