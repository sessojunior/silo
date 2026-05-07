import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import * as helpService from "../services/help-service.js";
import { deleteUploadFile, isSafeFilename, listUploadFiles } from "../infra/uploads.js";

const router = Router();

// GET /api/help
router.get("/", authMiddleware, requirePermission("help", "list"), async (_req, res) => {
  try {
    const helpDoc = await helpService.getHelp();
    res.json({ success: true, data: helpDoc });
  } catch (err) {
    console.error("❌ [API_HELP] GET:", err);
    res.status(500).json({ success: false, error: "Erro ao carregar documentação" });
  }
});

// PUT /api/help
router.put("/", authMiddleware, requirePermission("help", "update"), async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const description = typeof body.description === "string" ? body.description : "";
    await helpService.updateHelp(description);
    res.json({ success: true, message: "Documentação atualizada com sucesso" });
  } catch (err) {
    console.error("❌ [API_HELP] PUT:", err);
    res.status(500).json({ success: false, error: "Erro ao salvar documentação" });
  }
});

// GET /api/help/images
router.get("/images", authMiddleware, requirePermission("help", "list"), async (_req, res) => {
  try {
    const items = await listUploadFiles("help");
    res.json({ success: true, data: { items } });
  } catch (err) {
    console.error("❌ [API_HELP] GET /images:", err);
    res.status(500).json({ success: false, error: "Erro ao listar imagens" });
  }
});

// DELETE /api/help/images?filename=
router.delete("/images", authMiddleware, requirePermission("help", "delete"), async (req, res) => {
  try {
    const filename = req.query.filename as string | undefined;
    if (!filename || !isSafeFilename(filename)) {
      res.status(400).json({ success: false, error: "Nome de arquivo inválido" });
      return;
    }
    await deleteUploadFile("help", filename);
    res.json({ success: true, message: "Imagem excluída com sucesso" });
  } catch (err) {
    console.error("❌ [API_HELP] DELETE /images:", err);
    res.status(500).json({ success: false, error: "Erro ao excluir imagem" });
  }
});

export default router;
