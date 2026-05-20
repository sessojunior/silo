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

const getQueryStringValue = (
  value: unknown,
): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

router.get("/availability", requirePermission("reports", "view"), async (req: Request, res) => {
  try {
    const period = {
      start: getQueryStringValue(req.query.start),
      end: getQueryStringValue(req.query.end),
    };
    const data = await getAvailabilityReport(
      parsePeriod(period),
    );
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ [REPORTS/AVAILABILITY]:", err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});

router.get("/problems", requirePermission("reports", "view"), async (req: Request, res) => {
  try {
    const { start, end } = parsePeriod({
      start: getQueryStringValue(req.query.start),
      end: getQueryStringValue(req.query.end),
    });
    const productId = getQueryStringValue(req.query.productId);
    const problemCategory = getQueryStringValue(req.query.problemCategory);
    const data = await getProblemsReport({ start, end }, productId, problemCategory);
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ [REPORTS/PROBLEMS]:", err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});

router.get("/executive", requirePermission("reports", "view"), async (req: Request, res) => {
  try {
    const { start, end } = parsePeriod({
      start: getQueryStringValue(req.query.start),
      end: getQueryStringValue(req.query.end),
    });
    const productId = getQueryStringValue(req.query.productId);
    const groupId = getQueryStringValue(req.query.groupId);
    const data = await getExecutiveReport({ start, end }, productId, groupId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ [REPORTS/EXECUTIVE]:", err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});

router.get("/projects", requirePermission("reports", "view"), async (req: Request, res) => {
  try {
    const period = {
      start: getQueryStringValue(req.query.start),
      end: getQueryStringValue(req.query.end),
    };
    const data = await getProjectsReport(
      parsePeriod(period),
    );
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ [REPORTS/PROJECTS]:", err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});

export default router;