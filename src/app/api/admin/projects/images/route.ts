import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { requirePermissionAuthUser } from "@/lib/permissions";
import path from "path";
import { promises as fs } from "fs";
import { deleteUploadFile, isSafeFilename } from "@/lib/localUploads";

export const runtime = "nodejs";

export async function GET() {
  const authResult = await requirePermissionAuthUser("projects", "list");
  if (!authResult.ok) return authResult.response;

  try {
    const dir = path.join(process.cwd(), "uploads", "projects");
    let files: string[] = [];
    try {
      files = await fs.readdir(dir);
    } catch {
      files = [];
    }

    const stats = await Promise.all(
      files.map(async (filename) => {
        try {
          const stat = await fs.stat(path.join(dir, filename));
          return {
            filename,
            url: `/uploads/projects/${filename}`,
            size: stat.size,
            mtime: stat.mtimeMs,
          };
        } catch {
          return null;
        }
      }),
    );

    const items = stats
      .filter(
        (s): s is { filename: string; url: string; size: number; mtime: number } =>
          s !== null,
      )
      .sort((a, b) => b.mtime - a.mtime);

    return successResponse({ items });
  } catch (error) {
    console.error("❌ [API_PROJECT_IMAGES] Erro ao listar imagens:", { error });
    return errorResponse("Erro ao listar imagens.", 500);
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requirePermissionAuthUser("projects", "update");
  if (!authResult.ok) return authResult.response;

  try {
    const { filename } = await req.json();
    if (!filename || !isSafeFilename(filename)) {
      return errorResponse("Arquivo inválido.", 400, { field: "filename" });
    }

    const ok = await deleteUploadFile("projects", filename);
    if (!ok) {
      return errorResponse("Não foi possível excluir o arquivo.", 404);
    }
    return successResponse(null, "Imagem excluída com sucesso");
  } catch (error) {
    console.error("❌ [API_PROJECT_IMAGES] Erro ao excluir imagem:", { error });
    return errorResponse("Erro ao excluir imagem.", 500);
  }
}
