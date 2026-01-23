import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { productProblemCategory } from "@/lib/db/schema";
import { eq, ilike, and, not } from "drizzle-orm";
import { requirePermissionAuthUser } from "@/lib/permissions";
import { successResponse, errorResponse } from "@/lib/api-response";

// GET  /api/admin/products/problems/categories?search=text
export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionAuthUser(
      "productProblems",
      "list",
    );
    if (!authResult.ok) return authResult.response;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    const items = await db
      .select()
      .from(productProblemCategory)
      .where(
        search ? ilike(productProblemCategory.name, `%${search}%`) : undefined,
      )
      .orderBy(productProblemCategory.name);

    return successResponse(items);
  } catch (error) {
    console.error(
      "❌ [API_PRODUCTS_PROBLEMS_CATEGORIES] Erro ao listar categorias de problemas:",
      { error },
    );
    return errorResponse("Erro interno ao listar categorias", 500);
  }
}

// POST  criar categoria
export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionAuthUser(
      "productProblems",
      "create",
    );
    if (!authResult.ok) return authResult.response;

    const { name, color } = await request.json();
    if (!name || name.trim().length < 2) {
      return errorResponse(
        "Nome é obrigatório e deve ter pelo menos 2 caracteres.",
        400,
        { field: "name" },
      );
    }

    const existing = await db
      .select()
      .from(productProblemCategory)
      .where(eq(productProblemCategory.name, name.trim()))
      .limit(1);
    if (existing.length > 0) {
      return errorResponse("Categoria já existe.", 400, { field: "name" });
    }

    const newCat = {
      id: randomUUID(),
      name: name.trim(),
      color: color || null,
    };
    await db.insert(productProblemCategory).values(newCat);
    return successResponse(newCat, "Categoria criada com sucesso", 201);
  } catch (error) {
    console.error(
      "❌ [API_PRODUCTS_PROBLEMS_CATEGORIES] Erro ao criar categoria de problema:",
      { error },
    );
    return errorResponse("Erro interno ao criar categoria", 500);
  }
}

// PUT atualizar categoria
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requirePermissionAuthUser(
      "productProblems",
      "update",
    );
    if (!authResult.ok) return authResult.response;

    const { id, name, color } = await request.json();
    if (!id) return errorResponse("ID obrigatório.", 400, { field: "id" });
    if (!name || name.trim().length < 2) {
      return errorResponse(
        "Nome é obrigatório e deve ter pelo menos 2 caracteres.",
        400,
        { field: "name" },
      );
    }

    const duplicate = await db
      .select()
      .from(productProblemCategory)
      .where(
        and(
          eq(productProblemCategory.name, name.trim()),
          not(eq(productProblemCategory.id, id)),
        ),
      )
      .limit(1);
    if (duplicate.length > 0) {
      return errorResponse("Já existe outra categoria com esse nome.", 400, {
        field: "name",
      });
    }

    await db
      .update(productProblemCategory)
      .set({ name: name.trim(), color: color || null, updatedAt: new Date() })
      .where(eq(productProblemCategory.id, id));
    return successResponse(null, "Categoria atualizada com sucesso");
  } catch (error) {
    console.error(
      "❌ [API_PRODUCTS_PROBLEMS_CATEGORIES] Erro ao atualizar categoria de problema:",
      { error },
    );
    return errorResponse("Erro interno ao atualizar categoria", 500);
  }
}

// DELETE  /api/admin/products/problems/categories?id=uuid
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requirePermissionAuthUser(
      "productProblems",
      "delete",
    );
    if (!authResult.ok) return authResult.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return errorResponse("ID obrigatório.", 400);

    await db
      .delete(productProblemCategory)
      .where(eq(productProblemCategory.id, id));
    return successResponse(null, "Categoria excluída com sucesso");
  } catch (error) {
    console.error(
      "❌ [API_PRODUCTS_PROBLEMS_CATEGORIES] Erro ao excluir categoria de problema:",
      { error },
    );
    return errorResponse("Erro interno ao excluir categoria", 500);
  }
}
