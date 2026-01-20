import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { requireAdminAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

// GET - Buscar histórico de status de um produto específico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const { productId } = await params;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const turn = searchParams.get("turn");

    if (!date || !turn) {
      return errorResponse("Data e turno são obrigatórios", 400);
    }

    // Buscar atividade atual do produto para a data e turno específicos
    const currentActivity = await db
      .select({
        id: schema.productActivity.id,
      })
      .from(schema.productActivity)
      .where(
        and(
          eq(schema.productActivity.productId, productId),
          eq(schema.productActivity.date, date),
          eq(schema.productActivity.turn, parseInt(turn)),
        ),
      )
      .limit(1);

    if (currentActivity.length === 0) {
      return successResponse({ history: [] });
    }

    // Buscar histórico real da atividade
    const history = await db
      .select({
        id: schema.productActivityHistory.id,
        status: schema.productActivityHistory.status,
        description: schema.productActivityHistory.description,
        createdAt: schema.productActivityHistory.createdAt,
        user: {
          id: schema.authUser.id,
          name: schema.authUser.name,
          email: schema.authUser.email,
          image: schema.authUser.image,
        },
      })
      .from(schema.productActivityHistory)
      .innerJoin(
        schema.authUser,
        eq(schema.productActivityHistory.userId, schema.authUser.id),
      )
      .where(
        eq(
          schema.productActivityHistory.productActivityId,
          currentActivity[0].id,
        ),
      )
      .orderBy(desc(schema.productActivityHistory.createdAt));

    return successResponse({ history });
  } catch (error) {
    console.error(
      "❌ [API_PRODUCTS_HISTORY] Erro ao buscar histórico do produto:",
      error,
    );
    return errorResponse("Erro interno do servidor", 500);
  }
}
