import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { productDependency } from "@/lib/db/schema";
import { requirePermissionAuthUser } from "@/lib/permissions";
import { successResponse, errorResponse } from "@/lib/api-response";

interface ReorderItem {
  id: string;
  parentId: string | null;
  treePath: string;
  treeDepth: number;
  sortKey: string;
}

export async function PUT(req: NextRequest) {
  try {
    const authResult = await requirePermissionAuthUser(
      "productDependencies",
      "reorder",
    );
    if (!authResult.ok) return authResult.response;

    const body = await req.json();
    const { productId, items }: { productId: string; items: ReorderItem[] } =
      body;

    if (!productId || !items || !Array.isArray(items)) {
      return errorResponse("ProductId e items são obrigatórios", 400);
    }

    // Validar se todos os itens pertencem ao produto
    const existingDependencies = await db
      .select({ id: productDependency.id })
      .from(productDependency)
      .where(eq(productDependency.productId, productId));

    const existingIds = existingDependencies.map((dep) => dep.id);
    const invalidItems = items.filter(
      (item: ReorderItem) => !existingIds.includes(item.id),
    );

    if (invalidItems.length > 0) {
      return errorResponse("Alguns itens não pertencem a este produto", 400);
    }

    // Atualizar cada item em transação
    await db.transaction(async (tx) => {
      for (const item of items) {
        await tx
          .update(productDependency)
          .set({
            parentId: item.parentId,
            treePath: item.treePath,
            treeDepth: item.treeDepth,
            sortKey: item.sortKey,
            updatedAt: new Date(),
          })
          .where(eq(productDependency.id, item.id));
      }
    });

    return successResponse(null, "Dependências reordenadas com sucesso!");
  } catch (error) {
    console.error(
      "❌ [API_PRODUCTS_DEPENDENCIES_REORDER] Erro ao reordenar dependências:",
      { error },
    );
    return errorResponse("Erro interno do servidor", 500);
  }
}
