import {
  successResponse,
  errorResponse,
  parseRequestJson,
} from "@/lib/api-response";
import { requirePermissionAuthUser } from "@/lib/permissions";
import { db } from "@/lib/db";
import { pictureLink } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { pictureLinkSchema } from "@/lib/validation";

export const runtime = "nodejs";

// Criar ou atualizar link de figura
export async function PUT(request: Request) {
  const authResult = await requirePermissionAuthUser("picturePages", "update");
  if (!authResult.ok) return authResult.response;

  const parsed = await parseRequestJson(request, pictureLinkSchema);
  if (!parsed.ok) return parsed.response;

  try {
    await db
      .insert(pictureLink)
      .values({
        id: parsed.data.id,
        pageId: parsed.data.pageId,
        slug: parsed.data.slug,
        name: parsed.data.name,
        url: parsed.data.url,
        size: parsed.data.size,
      })
      .onConflictDoUpdate({
        target: pictureLink.id,
        set: {
          slug: parsed.data.slug,
          name: parsed.data.name,
          url: parsed.data.url,
          size: parsed.data.size,
        },
      });

    return successResponse(null, "Link salvo com sucesso");
  } catch (error) {
    console.error("❌ [API_PICTURE_LINKS] Erro ao salvar link:", error);
    return errorResponse("Erro ao salvar link.", 500);
  }
}

// Excluir link de figura
export async function DELETE(request: Request) {
  const authResult = await requirePermissionAuthUser("picturePages", "delete");
  if (!authResult.ok) return authResult.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return errorResponse("ID é obrigatório.", 400);
  }

  try {
    const result = await db.delete(pictureLink).where(eq(pictureLink.id, id));
    if (!result.rowCount) {
      return errorResponse("Link não encontrado.", 404);
    }
    return successResponse(null, "Link excluído com sucesso");
  } catch (error) {
    console.error("❌ [API_PICTURE_LINKS] Erro ao excluir link:", error);
    return errorResponse("Erro ao excluir link.", 500);
  }
}
