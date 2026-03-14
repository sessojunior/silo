import {
  successResponse,
  errorResponse,
  parseRequestJson,
} from "@/lib/api-response";
import { requirePermissionAuthUser } from "@/lib/permissions";
import { db } from "@/lib/db";
import { picturePage } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { picturePageSchema } from "@/lib/validation";

export const runtime = "nodejs";

// Listar páginas de figuras
export async function GET() {
  const authResult = await requirePermissionAuthUser("picturePages", "list");
  if (!authResult.ok) return authResult.response;

  try {
    const items = await db
      .select()
      .from(picturePage)
      .orderBy(asc(picturePage.name));
    return successResponse({ items });
  } catch (error) {
    console.error("❌ [API_PICTURE_PAGES] Erro ao buscar páginas:", error);
    return errorResponse("Erro ao buscar páginas.", 500);
  }
}

// Criar página de figuras
export async function POST(request: Request) {
  const authResult = await requirePermissionAuthUser("picturePages", "create");
  if (!authResult.ok) return authResult.response;

  const parsed = await parseRequestJson(request, picturePageSchema.omit({ id: true }));
  if (!parsed.ok) return parsed.response;

  try {
    const id = randomUUID();
    const slug = parsed.data.slug || parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    await db.insert(picturePage).values({
      id,
      slug,
      name: parsed.data.name,
      url: parsed.data.url,
      description: parsed.data.description,
    });
    return successResponse({ id }, "Página criada com sucesso", 201);
  } catch (error) {
    console.error("❌ [API_PICTURE_PAGES] Erro ao criar página:", error);
    return errorResponse("Erro ao criar página.", 500);
  }
}

// Atualizar ou criar página de figuras (upsert)
export async function PUT(request: Request) {
  const authResult = await requirePermissionAuthUser("picturePages", "update");
  if (!authResult.ok) return authResult.response;

  const parsed = await parseRequestJson(request, picturePageSchema);
  if (!parsed.ok) return parsed.response;

  try {
    await db
      .insert(picturePage)
      .values({
        id: parsed.data.id,
        slug: parsed.data.slug,
        name: parsed.data.name,
        url: parsed.data.url,
        description: parsed.data.description,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: picturePage.id,
        set: {
          slug: parsed.data.slug,
          name: parsed.data.name,
          url: parsed.data.url,
          description: parsed.data.description,
          updatedAt: new Date(),
        },
      });

    return successResponse(null, "Página salva com sucesso");
  } catch (error) {
    console.error("❌ [API_PICTURE_PAGES] Erro ao salvar página:", error);
    return errorResponse("Erro ao salvar página.", 500);
  }
}

// Excluir página de figuras
export async function DELETE(request: Request) {
  const authResult = await requirePermissionAuthUser("picturePages", "delete");
  if (!authResult.ok) return authResult.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return errorResponse("ID é obrigatório.", 400);
  }

  try {
    const result = await db.delete(picturePage).where(eq(picturePage.id, id));
    if (!result.rowCount) {
      return errorResponse("Página não encontrada.", 404);
    }
    return successResponse(null, "Página excluída com sucesso");
  } catch (error) {
    console.error("❌ [API_PICTURE_PAGES] Erro ao excluir página:", error);
    return errorResponse("Erro ao excluir página.", 500);
  }
}
