import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { productManual, product } from "@/lib/db/schema";
import { requireAdminAuthUser } from "@/lib/auth/server";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const { searchParams } = new URL(req.url);
    const productSlug = searchParams.get("productSlug");
    const productId = searchParams.get("productId");

    // Aceita tanto productSlug quanto productId para flexibilidade
    let manual = null;

    if (productSlug) {
      // Busca por slug (mais comum)
      const result = await db
        .select({
          manual: productManual,
        })
        .from(product)
        .leftJoin(productManual, eq(product.id, productManual.productId))
        .where(eq(product.slug, productSlug))
        .limit(1);

      manual = result[0]?.manual || null;
    } else if (productId) {
      // Busca por ID direto
      const result = await db
        .select()
        .from(productManual)
        .where(eq(productManual.productId, productId))
        .limit(1);

      manual = result[0] || null;
    } else {
      return errorResponse("productSlug ou productId é obrigatório", 400);
    }

    return successResponse(manual);
  } catch (error) {
    console.error("❌ [API_PRODUCTS_MANUAL] Erro ao buscar manual:", { error });
    return errorResponse("Erro interno do servidor", 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const { productId, description } = await req.json();

    if (!productId || !description) {
      return errorResponse("ProductId e description são obrigatórios", 400);
    }

    // Verifica se o produto existe
    const existingProduct = await db
      .select()
      .from(product)
      .where(eq(product.id, productId))
      .limit(1);
    if (existingProduct.length === 0) {
      return errorResponse("Produto não encontrado", 404);
    }

    // Verifica se já existe manual para este produto
    const existingManual = await db
      .select()
      .from(productManual)
      .where(eq(productManual.productId, productId))
      .limit(1);

    let result;
    if (existingManual.length > 0) {
      // Atualiza manual existente
      result = await db
        .update(productManual)
        .set({
          description,
          updatedAt: new Date(),
        })
        .where(eq(productManual.productId, productId))
        .returning();
    } else {
      // Cria novo manual
      result = await db
        .insert(productManual)
        .values({
          id: crypto.randomUUID(),
          productId,
          description,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
    }

    return successResponse(result[0], "Manual salvo com sucesso");
  } catch (error) {
    console.error("❌ [API_PRODUCTS_MANUAL] Erro ao salvar manual:", { error });
    return errorResponse("Erro interno do servidor", 500);
  }
}
