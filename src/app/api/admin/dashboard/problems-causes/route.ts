import { db } from "@/lib/db";
import { productActivity, productProblemCategory } from "@/lib/db/schema";
import { gte, inArray as inArr, and, isNotNull, ne } from "drizzle-orm";
import { NO_INCIDENTS_CATEGORY_ID } from "@/lib/constants";
import { requireAdminAuthUser } from "@/lib/auth/server";
import { successResponse, errorResponse } from "@/lib/api-response";

export const runtime = "nodejs";

// Não filtrar por status – qualquer atividade com categoria conta como causa de problema

export async function GET() {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const cutDate = new Date();
    cutDate.setDate(cutDate.getDate() - 28);

    const cutoffStr = cutDate.toISOString().slice(0, 10);

    // Atividades incidentes nos últimos 28 dias com categoria definida (excluindo "Não houve incidentes")
    const rows = await db
      .select({ categoryId: productActivity.problemCategoryId })
      .from(productActivity)
      .where(
        and(
          gte(productActivity.date, cutoffStr),
          isNotNull(productActivity.problemCategoryId),
          ne(productActivity.problemCategoryId, NO_INCIDENTS_CATEGORY_ID), // ← FILTRO AUTOMÁTICO
        ),
      );

    const counts = new Map<string, number>();
    for (const row of rows) {
      if (!row.categoryId) continue;
      counts.set(row.categoryId, (counts.get(row.categoryId) || 0) + 1);
    }

    if (counts.size === 0) return successResponse({ labels: [], values: [] });

    // Buscar nomes das categorias existentes
    const categoryRows = await db
      .select({
        id: productProblemCategory.id,
        name: productProblemCategory.name,
        color: productProblemCategory.color,
      })
      .from(productProblemCategory)
      .where(inArr(productProblemCategory.id, Array.from(counts.keys())));

    const labels: string[] = [];
    const values: number[] = [];
    const colors: (string | null)[] = [];

    for (const cat of categoryRows) {
      labels.push(cat.name);
      values.push(counts.get(cat.id) || 0);
      colors.push(cat.color);
    }

    return successResponse({ labels, values, colors });
  } catch (error) {
    const errorInfo =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { error };
    console.error(
      "❌ [API_DASHBOARD_PROBLEMS_CAUSES] Erro ao obter causas de problemas:",
      errorInfo,
    );
    return errorResponse("Erro ao obter causas de problemas", 500);
  }
}
