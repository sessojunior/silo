import { db } from "@/lib/db";
import { radarGroup } from "@/lib/db/schema";
import { radarGroupSchema } from "@/lib/validation";
import { parseRequestJson, successResponse, errorResponse } from "@/lib/api-response";
import { requirePermissionAuthUser } from "@/lib/permissions";
import { eq } from "drizzle-orm";

export async function GET() {
  const authResult = await requirePermissionAuthUser("radarGroups", "list");
  if (!authResult.ok) return authResult.response;

  try {
    const groups = await db.query.radarGroup.findMany({
      orderBy: (groups, { asc }) => [asc(groups.sortOrder), asc(groups.name)],
    });
    return successResponse(groups);
  } catch {
    return errorResponse("Erro ao buscar grupos de radares", 500);
  }
}

export async function POST(request: Request) {
  const authResult = await requirePermissionAuthUser("radarGroups", "create");
  if (!authResult.ok) return authResult.response;

  const parsed = await parseRequestJson(request, radarGroupSchema);
  if (!parsed.ok) return parsed.response;

  try {
    await db.insert(radarGroup).values({
      id: parsed.data.id,
      slug: parsed.data.slug,
      name: parsed.data.name,
      sortOrder: parsed.data.sortOrder,
    });
    return successResponse(null, "Grupo criado com sucesso");
  } catch {
    return errorResponse("Erro ao criar grupo", 500);
  }
}

export async function PUT(request: Request) {
  const authResult = await requirePermissionAuthUser("radarGroups", "update");
  if (!authResult.ok) return authResult.response;

  const parsed = await parseRequestJson(request, radarGroupSchema);
  if (!parsed.ok) return parsed.response;

  try {
    await db.update(radarGroup)
      .set({
        slug: parsed.data.slug,
        name: parsed.data.name,
        sortOrder: parsed.data.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(radarGroup.id, parsed.data.id));
    return successResponse(null, "Grupo atualizado com sucesso");
  } catch {
    return errorResponse("Status: erro ao atualizar grupo", 500);
  }
}

export async function DELETE(request: Request) {
  const authResult = await requirePermissionAuthUser("radarGroups", "delete");
  if (!authResult.ok) return authResult.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return errorResponse("ID é obrigatório", 400);

  try {
    const { radar } = await import("@/lib/db/schema");
    const { count } = await import("drizzle-orm");
    const radarsCount = await db.select({ value: count() }).from(radar).where(eq(radar.groupId, id));
    
    if (radarsCount[0].value > 0) {
      return errorResponse("Este grupo possui radares vinculados e não pode ser excluído.", 400);
    }

    await db.delete(radarGroup).where(eq(radarGroup.id, id));
    return successResponse(null, "Grupo excluído com sucesso");
  } catch (error) {
    console.error(error);
    return errorResponse("Erro ao excluir grupo", 500);
  }
}
