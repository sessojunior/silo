import { Router } from "express";
import { promises as fs } from "fs";
import { authMiddleware } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/permissions.js";
import { deleteUploadFile, getContentTypeFromFilename, getUploadFilePath, isSafeFilename, isUploadKind, storeBufferAsWebp } from "../infra/uploads.js";

const router = Router();

// Normalize singular → plural aliases used by the web client
const kindAliases: Record<string, string> = { avatar: "avatars", contact: "contacts", problem: "problems", solution: "solutions" };
const normalizeKind = (k: string): string => kindAliases[k] ?? k;

const maxFileSizeBytes = 4 * 1024 * 1024;

// POST /api/upload/:kind
router.post("/:kind", authMiddleware, async (req, res) => {
  try {
    const kind = normalizeKind(String(req.params.kind));
    if (!isUploadKind(kind)) { res.status(400).json({ success: false, error: `Tipo de upload inválido: ${kind}` }); return; }

    // Parse multipart using built-in Node.js (without multer for simplicity)
    // We'll use a simple approach: expect raw body if content-type is multipart
    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) {
      res.status(400).json({ success: false, error: "Requisição deve ser multipart/form-data" });
      return;
    }

    // Use busboy to parse multipart
    const Busboy = (await import("busboy")).default;
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: maxFileSizeBytes } });

    let fileBuffer: Buffer | null = null;
    let originalName = "upload";
    let fileSizeLimitExceeded = false;

    await new Promise<void>((resolve, reject) => {
      busboy.on("file", (_fieldname, file, info) => {
        originalName = info.filename || "upload";
        const chunks: Buffer[] = [];
        file.on("data", (chunk: Buffer) => chunks.push(chunk));
        file.on("limit", () => { fileSizeLimitExceeded = true; file.resume(); });
        file.on("end", () => { if (!fileSizeLimitExceeded) fileBuffer = Buffer.concat(chunks); });
      });
      busboy.on("finish", resolve);
      busboy.on("error", reject);
      req.pipe(busboy);
    });

    if (fileSizeLimitExceeded) { res.status(400).json({ success: false, error: "Arquivo muito grande. Máximo 4MB." }); return; }
    if (!fileBuffer) { res.status(400).json({ success: false, error: "Nenhum arquivo enviado." }); return; }

    const stored = await storeBufferAsWebp(
      kind,
      originalName,
      fileBuffer,
      kind === "avatars"
        ? { mode: "square", size: 200, quality: 85 }
        : kind === "contacts"
          ? { mode: "square", size: 200, quality: 85 }
          : { mode: "inside", maxWidth: 1200, maxHeight: 1200, quality: 85 },
    );

    if (typeof stored !== "string") {
      res.status(400).json({ success: false, error: stored.error });
      return;
    }

    const url = `/uploads/${kind}/${stored}`;
    res.status(201).json({ success: true, data: { url, filename: stored } });
  } catch (err) {
    console.error("❌ [API_UPLOAD] POST:", err);
    res.status(500).json({ success: false, error: "Erro ao processar upload" });
  }
});

// GET /api/uploads/:kind/:filename — serve uploaded file
router.get("/serve/:kind/:filename", authMiddleware, async (req, res) => {
  try {
    const kind = normalizeKind(String(req.params.kind));
    const filename = String(req.params.filename);
    if (!isUploadKind(kind) || !isSafeFilename(filename)) {
      res.status(404).json({ success: false, error: "Arquivo não encontrado." });
      return;
    }
    const filePath = getUploadFilePath(kind, filename);
    try {
      await fs.access(filePath);
    } catch {
      res.status(404).json({ success: false, error: "Arquivo não encontrado." });
      return;
    }
    const contentType = getContentTypeFromFilename(filename);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    const stream = (await import("fs")).createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    console.error("❌ [API_UPLOAD] GET serve:", err);
    res.status(500).json({ success: false, error: "Erro ao ler arquivo." });
  }
});

// DELETE /api/uploads/serve/:kind/:filename — delete uploaded file (admin)
router.delete("/serve/:kind/:filename", authMiddleware, requireAdmin(), async (req, res) => {
  try {
    const kind = normalizeKind(String(req.params.kind));
    const filename = String(req.params.filename);
    if (!isUploadKind(kind) || !isSafeFilename(filename)) {
      res.status(404).json({ success: false, error: "Arquivo não encontrado." });
      return;
    }
    const deleted = await deleteUploadFile(kind, filename);
    if (!deleted) {
      res.status(404).json({ success: false, error: "Arquivo não encontrado." });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error("❌ [API_UPLOAD] DELETE serve:", err);
    res.status(500).json({ success: false, error: "Erro ao deletar arquivo." });
  }
});

export default router;
