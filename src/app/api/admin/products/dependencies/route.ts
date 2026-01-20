import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { eq, isNull, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { productDependency } from "@/lib/db/schema";
import { requireAdminAuthUser } from "@/lib/auth/server";

// Utilitários para campos híbridos
function calculateTreePath(
  parentPath: string | null,
  position: number,
): string {
  return parentPath ? `${parentPath}/${position}` : `/${position}`;
}

function calculateSortKey(
  parentSortKey: string | null,
  position: number,
): string {
  const positionStr = position.toString().padStart(3, "0");
  return parentSortKey ? `${parentSortKey}.${positionStr}` : positionStr;
}

function calculateTreeDepth(parentDepth: number | null): number {
  return parentDepth !== null ? parentDepth + 1 : 0;
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return errorResponse("ProductId é obrigatório", 400);
    }

    // Busca todas as dependências do produto ORDENADAS por sortKey (otimizado)
    const dependencies = await db
      .select()
      .from(productDependency)
      .where(eq(productDependency.productId, productId))
      .orderBy(productDependency.sortKey);

    // Organiza as dependências em uma estrutura hierárquica
    const buildTree = (
      items: typeof dependencies,
      parentId: string | null = null,
    ): typeof dependencies => {
      return items
        .filter((item) => item.parentId === parentId)
        .map((item) => ({
          ...item,
          children: buildTree(items, item.id),
        }));
    };

    const tree = buildTree(dependencies);

    return successResponse({ dependencies: tree });
  } catch (error) {
    console.error(
      "❌ [API_PRODUCTS_DEPENDENCIES] Erro ao buscar dependências:",
      { error },
    );
    return errorResponse("Erro interno do servidor", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const { productId, name, icon, description, parentId } = await req.json();

    // Validação básica
    if (!productId || !name) {
      return errorResponse("ProductId e nome são obrigatórios", 400);
    }

    // Determinar próxima posição no mesmo nível (baseado em sortKey)
    const siblings = await db
      .select()
      .from(productDependency)
      .where(
        and(
          eq(productDependency.productId, productId),
          parentId
            ? eq(productDependency.parentId, parentId)
            : isNull(productDependency.parentId),
        ),
      );

    const nextPosition = siblings.length;

    // Buscar dados do pai se existir
    let parentData = null;
    if (parentId) {
      const parentResult = await db
        .select()
        .from(productDependency)
        .where(eq(productDependency.id, parentId))
        .limit(1);
      parentData = parentResult[0] || null;
    }

    // Calcular campos híbridos
    const treePath = calculateTreePath(
      parentData?.treePath || null,
      nextPosition,
    );
    const sortKey = calculateSortKey(parentData?.sortKey || null, nextPosition);
    const treeDepth = calculateTreeDepth(parentData?.treeDepth || null);

    // Criar dependência
    const dependencyId = randomUUID();
    const newDependency = await db
      .insert(productDependency)
      .values({
        id: dependencyId,
        productId,
        name,
        icon: icon || null,
        description: description || null,
        parentId: parentId || null,
        treePath,
        treeDepth,
        sortKey,
      })
      .returning();

    return successResponse(
      { dependency: newDependency[0] },
      "Dependência criada com sucesso",
      201,
    );
  } catch (error) {
    console.error("❌ [API_PRODUCTS_DEPENDENCIES] Erro ao criar dependência:", {
      error,
    });
    return errorResponse("Erro interno do servidor", 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const { id, name, icon, description, parentId, newPosition } =
      await req.json();

    // Validação básica
    if (!id || !name) {
      return errorResponse("ID e nome são obrigatórios", 400);
    }

    // Verificar se a dependência existe
    const existingDependency = await db
      .select()
      .from(productDependency)
      .where(eq(productDependency.id, id))
      .limit(1);

    if (!existingDependency.length) {
      return errorResponse("Dependência não encontrada", 404);
    }

    // Preparar dados para atualização
    const updateData: {
      name: string;
      icon: string | null;
      description: string | null;
      updatedAt: Date;
      parentId?: string | null;
      treePath?: string;
      sortKey?: string;
      treeDepth?: number;
    } = {
      name,
      icon: icon || null,
      description: description || null,
      updatedAt: new Date(),
    };

    // Só recalcula ordenação se realmente necessário
    // Para edições simples (nome, ícone, descrição), não deve recalcular ordenação
    const shouldRecalculateOrdering = newPosition !== undefined;

    if (shouldRecalculateOrdering) {
      // Buscar dados do novo pai se existir
      let parentData = null;
      if (parentId) {
        const parentResult = await db
          .select()
          .from(productDependency)
          .where(eq(productDependency.id, parentId))
          .limit(1);
        parentData = parentResult[0] || null;
      }

      // Recalcular campos híbridos com a nova posição
      const position = newPosition;
      updateData.parentId = parentId;
      updateData.treePath = calculateTreePath(
        parentData?.treePath || null,
        position,
      );
      updateData.sortKey = calculateSortKey(
        parentData?.sortKey || null,
        position,
      );
      updateData.treeDepth = calculateTreeDepth(parentData?.treeDepth || null);
    }

    // Atualizar dependência
    const updatedDependency = await db
      .update(productDependency)
      .set(updateData)
      .where(eq(productDependency.id, id))
      .returning();

    return successResponse(
      { dependency: updatedDependency[0] },
      "Dependência atualizada com sucesso",
    );
  } catch (error) {
    console.error(
      "❌ [API_PRODUCTS_DEPENDENCIES] Erro ao atualizar dependência:",
      { error },
    );
    return errorResponse("Erro interno do servidor", 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const { id } = await req.json();

    if (!id) {
      return errorResponse("ID é obrigatório", 400);
    }

    // Verificar se a dependência existe
    const existingDependency = await db
      .select()
      .from(productDependency)
      .where(eq(productDependency.id, id))
      .limit(1);

    if (!existingDependency.length) {
      return errorResponse("Dependência não encontrada", 404);
    }

    // Verificar se há dependências filhas
    const children = await db
      .select()
      .from(productDependency)
      .where(eq(productDependency.parentId, id));

    if (children.length > 0) {
      return errorResponse(
        "Não é possível excluir uma dependência que possui itens filhos. Exclua primeiro os itens filhos.",
        400,
      );
    }

    // Excluir dependência
    await db.delete(productDependency).where(eq(productDependency.id, id));

    return successResponse(
      { success: true },
      "Dependência excluída com sucesso",
    );
  } catch (error) {
    console.error(
      "❌ [API_PRODUCTS_DEPENDENCIES] Erro ao excluir dependência:",
      { error },
    );
    return errorResponse("Erro interno do servidor", 500);
  }
}
