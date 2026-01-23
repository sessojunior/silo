import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { productSolution } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { requirePermissionAuthUser } from "@/lib/permissions";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requirePermissionAuthUser(
      "productSolutions",
      "list",
    );
    if (!authResult.ok) return authResult.response;

    const { problemIds } = await req.json();

    if (!problemIds || !Array.isArray(problemIds) || problemIds.length === 0) {
      return errorResponse(
        "Array problemIds é obrigatório e não pode estar vazio.",
        400,
      );
    }

    // Query otimizada: conta soluções agrupadas por problemId em uma única consulta
    const result = await db
      .select({
        problemId: productSolution.productProblemId,
        count: sql<number>`COUNT(${productSolution.id})`,
      })
      .from(productSolution)
      .where(inArray(productSolution.productProblemId, problemIds))
      .groupBy(productSolution.productProblemId);

    // Converte resultado para objeto { problemId: count }
    const counts: Record<string, number> = {};

    // Inicializa todos os problemas com 0 (caso não tenham soluções)
    problemIds.forEach((id: string) => {
      counts[id] = 0;
    });

    // Atualiza com as contagens reais
    result.forEach((row) => {
      counts[row.problemId] = Number(row.count);
    });

    return successResponse(counts);
  } catch (error) {
    console.error(
      "❌ [API_PRODUCTS_SOLUTIONS_COUNT] Erro ao buscar contagens:",
      { error },
    );
    return errorResponse("Erro interno do servidor.", 500);
  }
}
