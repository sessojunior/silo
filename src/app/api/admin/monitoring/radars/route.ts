import { db } from "@/lib/db";
import { radar } from "@/lib/db/schema";
import { radarSchema } from "@/lib/validation";
import { parseRequestJson, successResponse, errorResponse } from "@/lib/api-response";
import { requirePermissionAuthUser } from "@/lib/permissions";

export async function GET() {
  const authResult = await requirePermissionAuthUser("radars", "list");
  if (!authResult.ok) return authResult.response;

  try {
    const items = await db.query.radar.findMany({
      orderBy: (radars, { asc }) => [asc(radars.name)],
    });
    return successResponse(items);
  } catch {
    return errorResponse("Erro ao buscar radares", 500);
  }
}

export async function PUT(request: Request) {
  const authResult = await requirePermissionAuthUser("radars", "update");
  if (!authResult.ok) return authResult.response;

  const parsed = await parseRequestJson(request, radarSchema);
  if (!parsed.ok) return parsed.response;

  try {
    await db.insert(radar)
      .values({
        id: parsed.data.id,
        slug: parsed.data.slug,
        groupId: parsed.data.groupId,
        name: parsed.data.name,
        description: parsed.data.description,
        webhookUrl: parsed.data.webhookUrl,
        logUrl: parsed.data.logUrl,
        active: parsed.data.active,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: radar.id,
        set: {
          slug: parsed.data.slug,
          groupId: parsed.data.groupId,
          name: parsed.data.name,
          description: parsed.data.description,
          webhookUrl: parsed.data.webhookUrl,
          logUrl: parsed.data.logUrl,
          active: parsed.data.active,
          updatedAt: new Date(),
        }
      });
    return successResponse(null, "Radar salvo com sucesso");
  } catch (error) {
    console.error(error);
    return errorResponse("Erro ao salvar radar", 500);
  }
}

export async function DELETE(request: Request) {
  const authResult = await requirePermissionAuthUser("radars", "delete");
  if (!authResult.ok) return authResult.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return errorResponse("ID é obrigatório", 400);

  try {
    const { eq } = await import("drizzle-orm");
    await db.delete(radar).where(eq(radar.id, id));
    return successResponse(null, "Radar excluído com sucesso");
  } catch (error) {
    console.error(error);
    return errorResponse("Erro ao excluir radar", 500);
  }
}
