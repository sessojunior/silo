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
import { generatePdf } from "../services/pdf-report-generator.js";

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

// POST /api/reports/availability/pdf — exporta relatório de disponibilidade em PDF
router.post("/availability/pdf", requirePermission("reports", "view"), async (req: Request, res) => {
  try {
    const period = {
      start: getQueryStringValue(req.body?.start),
      end: getQueryStringValue(req.body?.end),
    };
    const parsed = parsePeriod(period);
    const data = await getAvailabilityReport(parsed);
    const pdf = await generatePdf({
      type: "availability",
      data: data as unknown as Record<string, unknown>,
      periodLabel: `${parsed.start} a ${parsed.end}`,
    });
    console.log(`✅ [REPORTS/AVAILABILITY/PDF] Gerado: ${pdf.filename}`);
    res.json({ success: true, data: { url: pdf.url, filename: pdf.filename } });
  } catch (err) {
    console.error("❌ [REPORTS/AVAILABILITY/PDF]:", err);
    res.status(500).json({ success: false, error: "Erro ao gerar PDF" });
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

// POST /api/reports/problems/pdf — exporta relatório de problemas em PDF
router.post("/problems/pdf", requirePermission("reports", "view"), async (req: Request, res) => {
  try {
    const { start, end } = parsePeriod({
      start: getQueryStringValue(req.body?.start),
      end: getQueryStringValue(req.body?.end),
    });
    const productId = getQueryStringValue(req.body?.productId);
    const problemCategory = getQueryStringValue(req.body?.problemCategory);
    const data = await getProblemsReport({ start, end }, productId, problemCategory);
    const pdf = await generatePdf({
      type: "problems",
      data: data as unknown as Record<string, unknown>,
      periodLabel: `${start} a ${end}`,
    });
    console.log(`✅ [REPORTS/PROBLEMS/PDF] Gerado: ${pdf.filename}`);
    res.json({ success: true, data: { url: pdf.url, filename: pdf.filename } });
  } catch (err) {
    console.error("❌ [REPORTS/PROBLEMS/PDF]:", err);
    res.status(500).json({ success: false, error: "Erro ao gerar PDF" });
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

// POST /api/reports/executive/pdf — exporta relatório executivo em PDF
router.post("/executive/pdf", requirePermission("reports", "view"), async (req: Request, res) => {
  try {
    const { start, end } = parsePeriod({
      start: getQueryStringValue(req.body?.start),
      end: getQueryStringValue(req.body?.end),
    });
    const productId = getQueryStringValue(req.body?.productId);
    const groupId = getQueryStringValue(req.body?.groupId);
    const data = await getExecutiveReport({ start, end }, productId, groupId);
    const pdf = await generatePdf({
      type: "executive",
      data: data as unknown as Record<string, unknown>,
      periodLabel: `${start} a ${end}`,
    });
    console.log(`✅ [REPORTS/EXECUTIVE/PDF] Gerado: ${pdf.filename}`);
    res.json({ success: true, data: { url: pdf.url, filename: pdf.filename } });
  } catch (err) {
    console.error("❌ [REPORTS/EXECUTIVE/PDF]:", err);
    res.status(500).json({ success: false, error: "Erro ao gerar PDF" });
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

// POST /api/reports/projects/pdf — exporta relatório de projetos em PDF
router.post("/projects/pdf", requirePermission("reports", "view"), async (req: Request, res) => {
  try {
    const period = {
      start: getQueryStringValue(req.body?.start),
      end: getQueryStringValue(req.body?.end),
    };
    const parsed = parsePeriod(period);
    const data = await getProjectsReport(parsed);
    const pdf = await generatePdf({
      type: "projects",
      data: data as unknown as Record<string, unknown>,
      periodLabel: `${parsed.start} a ${parsed.end}`,
    });
    console.log(`✅ [REPORTS/PROJECTS/PDF] Gerado: ${pdf.filename}`);
    res.json({ success: true, data: { url: pdf.url, filename: pdf.filename } });
  } catch (err) {
    console.error("❌ [REPORTS/PROJECTS/PDF]:", err);
    res.status(500).json({ success: false, error: "Erro ao gerar PDF" });
  }
});

/**
 * GET /api/reports/files — lista relatórios PDF gerados anteriormente
 */
router.get("/files", requirePermission("reports", "view"), async (_req: Request, res) => {
  try {
    const { listUploadFiles } = await import("../infra/uploads.js");
    const files = await listUploadFiles("reports");
    // Filtra apenas PDFs
    const pdfs = files.filter((f) => f.filename.endsWith(".pdf"));
    res.json({ success: true, data: pdfs });
  } catch (err) {
    console.error("❌ [REPORTS/FILES]:", err);
    res.status(500).json({ success: false, error: "Erro ao listar relatórios" });
  }
});

export default router;