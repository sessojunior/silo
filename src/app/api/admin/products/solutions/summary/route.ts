import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { product, productProblem, productSolution } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { requireAdminAuthUser } from "@/lib/auth/server";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const productSlug = searchParams.get("productSlug");

  if (!productSlug) {
    return errorResponse("Parâmetro productSlug é obrigatório.", 400);
  }

  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    // Query otimizada com JOINs - uma única consulta ao banco
    // Retorna: total de soluções + última data de atualização
    const result = await db
      .select({
        totalSolutions: sql<number>`COUNT(${productSolution.id})`,
        lastUpdated: sql<Date | null>`MAX(GREATEST(${productProblem.updatedAt}, COALESCE(${productSolution.updatedAt}, ${productProblem.updatedAt})))`,
      })
      .from(product)
      .leftJoin(productProblem, eq(productProblem.productId, product.id))
      .leftJoin(
        productSolution,
        eq(productSolution.productProblemId, productProblem.id),
      )
      .where(eq(product.slug, productSlug))
      .groupBy(product.id);

    // Se produto não existe, retorna valores zerados
    if (!result.length) {
      return successResponse({
        totalSolutions: 0,
        lastUpdated: null,
      });
    }

    const data = result[0];

    return successResponse({
      totalSolutions: Number(data.totalSolutions) || 0,
      lastUpdated: data.lastUpdated,
    });
  } catch (error) {
    console.error(
      "❌ [API_PRODUCTS_SOLUTIONS_SUMMARY] Erro ao buscar summary:",
      { error },
    );
    return errorResponse("Erro interno do servidor.", 500);
  }
}
