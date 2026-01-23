import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { requirePermissionAuthUser } from "@/lib/permissions";
import { db } from "@/lib/db";
import {
  product,
  productActivity,
  productActivityHistory,
  productContact,
  productDependency,
  productManual,
  productProblem,
  productSolution,
  productProblemImage,
  productSolutionChecked,
  productSolutionImage,
} from "@/lib/db/schema";
import { eq, like, asc, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { formatSlug } from "@/lib/utils";

export const runtime = "nodejs";

// Listar produtos com paginação e filtro por nome ou buscar por slug
export async function GET(request: NextRequest) {
  const authResult = await requirePermissionAuthUser("products", "list");
  if (!authResult.ok) return authResult.response;

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug")?.trim();

  // Se tem slug, busca produto específico
  if (slug) {
    try {
      const products = await db
        .select()
        .from(product)
        .where(eq(product.slug, slug))
        .limit(1);
      return successResponse({ products });
    } catch (error) {
      const errorInfo =
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : { error };
      console.error("❌ [API_PRODUCTS] Erro ao buscar produto por slug:", {
        slug,
        ...errorInfo,
      });
      return errorResponse("Erro ao buscar produto.", 500);
    }
  }

  // Senão, lista produtos com paginação
  const page = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || "40");
  const name = searchParams.get("name")?.trim() || "";
  const offset = (page - 1) * limit;

  try {
    const where = name.length > 0 ? like(product.name, `%${name}%`) : undefined;
    const items = await (where
      ? db
          .select()
          .from(product)
          .where(where)
          .orderBy(asc(product.name))
          .limit(limit)
          .offset(offset)
      : db
          .select()
          .from(product)
          .orderBy(asc(product.name))
          .limit(limit)
          .offset(offset));
    return successResponse({ items });
  } catch (error) {
    const errorInfo =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { error };
    console.error("❌ [API_PRODUCTS] Erro ao buscar produtos:", {
      page,
      limit,
      offset,
      name,
      ...errorInfo,
    });
    return errorResponse("Erro ao buscar produtos.", 500);
  }
}

// Criar produto
export async function POST(request: Request) {
  const authResult = await requirePermissionAuthUser("products", "create");
  if (!authResult.ok) return authResult.response;

  const body = await request.json();
  const name = (body.name || "").trim();
  const slug = formatSlug(body.slug) || "";
  const available =
    typeof body.available === "boolean" ? body.available : false;
  const turns = Array.isArray(body.turns) ? body.turns : ["0", "6", "12", "18"];

  if (name.length < 2) {
    return errorResponse("O nome deve possuir ao menos dois caracteres.", 400, {
      field: "name",
    });
  }

  // Verifica duplicidade
  const existing = await db
    .select()
    .from(product)
    .where(like(product.slug, slug))
    .limit(1);
  if (existing.length > 0 && existing[0].slug === slug) {
    return errorResponse("Já existe um produto com este slug.", 400, {
      field: "name",
    });
  }

  try {
    await db.insert(product).values({
      id: randomUUID(),
      name,
      slug,
      available,
      turns,
    });
    return successResponse(null, "Produto criado com sucesso", 201);
  } catch {
    return errorResponse("Erro ao criar produto.", 500);
  }
}

// Atualizar produto
export async function PUT(request: Request) {
  const authResult = await requirePermissionAuthUser("products", "update");
  if (!authResult.ok) return authResult.response;

  const body = await request.json();
  const id = (body.id || "").trim();
  const name = (body.name || "").trim();
  const slug = formatSlug(body.slug) || "";
  const available =
    typeof body.available === "boolean" ? body.available : false;
  const turns = Array.isArray(body.turns) ? body.turns : ["0", "6", "12", "18"];

  if (!id) {
    return errorResponse("ID do produto é obrigatório.", 400);
  }

  if (name.length < 2) {
    return errorResponse("O nome deve possuir ao menos dois caracteres.", 400);
  }

  // Verifica duplicidade
  const existing = await db
    .select()
    .from(product)
    .where(like(product.slug, slug))
    .limit(1);
  if (
    existing.length > 0 &&
    existing[0].id !== id &&
    existing[0].slug === slug
  ) {
    return errorResponse("Já existe um produto com este slug.", 400);
  }

  try {
    const result = await db
      .update(product)
      .set({ name, slug, available, turns })
      .where(eq(product.id, id));
    if (!result.rowCount) {
      return errorResponse("Produto não encontrado.", 404);
    }
    return successResponse(null, "Produto atualizado com sucesso");
  } catch {
    return errorResponse("Erro ao atualizar produto.", 500);
  }
}

// Excluir produto com exclusão em cascata completa
export async function DELETE(request: Request) {
  try {
    const authResult = await requirePermissionAuthUser("products", "delete");
    if (!authResult.ok) return authResult.response;

    const { searchParams } = new URL(request.url);
    const id = (searchParams.get("id") || "").trim();

    if (!id) {
      console.warn("⚠️ [API_PRODUCTS] ID do produto não fornecido");
      return errorResponse("ID do produto é obrigatório", 400);
    }

    // Verificar se produto existe
    const existingProduct = await db
      .select()
      .from(product)
      .where(eq(product.id, id))
      .limit(1);

    if (existingProduct.length === 0) {
      console.warn("⚠️ [API_PRODUCTS] Produto não encontrado para exclusão:", {
        id,
      });
      return errorResponse("Produto não encontrado", 404);
    }

    // Executar exclusão em cascata usando transação
    await db.transaction(async (tx) => {
      // 1. Buscar todas as atividades do produto
      const activities = await tx
        .select({ id: productActivity.id })
        .from(productActivity)
        .where(eq(productActivity.productId, id));
      const activityIds = activities.map((a) => a.id);

      // 2. Excluir histórico das atividades
      if (activityIds.length > 0) {
        await tx
          .delete(productActivityHistory)
          .where(
            inArray(productActivityHistory.productActivityId, activityIds),
          );
      }

      // 3. Excluir atividades do produto
      await tx.delete(productActivity).where(eq(productActivity.productId, id));

      // 4. Buscar todos os problemas do produto
      const problems = await tx
        .select({ id: productProblem.id })
        .from(productProblem)
        .where(eq(productProblem.productId, id));
      const problemIds = problems.map((p) => p.id);

      // 5. Para cada problema, excluir soluções e suas dependências
      if (problemIds.length > 0) {
        // Buscar todas as soluções dos problemas
        const solutions = await tx
          .select({ id: productSolution.id })
          .from(productSolution)
          .where(inArray(productSolution.productProblemId, problemIds));
        const solutionIds = solutions.map((s) => s.id);

        // Excluir verificações das soluções
        if (solutionIds.length > 0) {
          await tx
            .delete(productSolutionChecked)
            .where(
              inArray(productSolutionChecked.productSolutionId, solutionIds),
            );
        }

        // Excluir imagens das soluções
        if (solutionIds.length > 0) {
          await tx
            .delete(productSolutionImage)
            .where(
              inArray(productSolutionImage.productSolutionId, solutionIds),
            );
        }

        // Excluir todas as soluções
        await tx
          .delete(productSolution)
          .where(inArray(productSolution.productProblemId, problemIds));

        // Excluir imagens dos problemas
        await tx
          .delete(productProblemImage)
          .where(inArray(productProblemImage.productProblemId, problemIds));

        // Excluir todos os problemas
        await tx.delete(productProblem).where(eq(productProblem.productId, id));
      }

      // 6. Excluir dependências do produto
      await tx
        .delete(productDependency)
        .where(eq(productDependency.productId, id));

      // 7. Excluir manual do produto
      await tx.delete(productManual).where(eq(productManual.productId, id));

      // 8. Excluir associações de contatos
      await tx.delete(productContact).where(eq(productContact.productId, id));

      // 9. Finalmente, excluir o produto
      await tx.delete(product).where(eq(product.id, id));
    });

    return successResponse(
      null,
      "Produto e todos os dados relacionados excluídos com sucesso",
    );
  } catch (error) {
    console.error("Erro ao excluir produto:", error);

    return errorResponse(
      "Erro interno ao excluir produto. Tente novamente.",
      500,
      { details: error instanceof Error ? error.message : String(error) },
    );
  }
}
