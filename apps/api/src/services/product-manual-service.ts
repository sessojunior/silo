import { db } from "@silo/database";
import { product, productManual } from "@silo/database/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { upsertManualChunks } from "./embedding-write-service.js";

type ProductManualServiceSuccess<T> = {
  ok: true;
  data: T;
};

type ProductManualServiceError = {
  ok: false;
  error: string;
  status?: number;
};

const success = <T>(data: T): ProductManualServiceSuccess<T> => ({
  ok: true,
  data,
});

const failure = (
  error: string,
  status?: number,
): ProductManualServiceError => ({
  ok: false,
  error,
  ...(typeof status === "number" ? { status } : {}),
});

type ProductManualRecord = typeof productManual.$inferSelect;

export async function getProductManual(params: {
  productSlug?: string;
  productId?: string;
}): Promise<ProductManualServiceSuccess<{ manual: ProductManualRecord | null }> | ProductManualServiceError> {
  if (params.productSlug) {
    const [row] = await db
      .select({ manual: productManual })
      .from(product)
      .leftJoin(productManual, eq(productManual.productId, product.id))
      .where(eq(product.slug, params.productSlug))
      .limit(1);

    return success({ manual: row?.manual ?? null });
  }

  if (params.productId) {
    const [row] = await db
      .select()
      .from(productManual)
      .where(eq(productManual.productId, params.productId))
      .limit(1);

    return success({ manual: row ?? null });
  }

  return failure("productSlug ou productId é obrigatório", 400);
}

export async function upsertProductManual(data: {
  productId: string;
  description: string;
}): Promise<ProductManualServiceSuccess<{ manual: ProductManualRecord }> | ProductManualServiceError> {
  const [existingProduct] = await db
    .select()
    .from(product)
    .where(eq(product.id, data.productId))
    .limit(1);

  if (!existingProduct) {
    return failure("Produto não encontrado", 404);
  }

  const [existingManual] = await db
    .select()
    .from(productManual)
    .where(eq(productManual.productId, data.productId))
    .limit(1);

  if (existingManual) {
    const [manual] = await db
      .update(productManual)
      .set({ description: data.description, updatedAt: new Date() })
      .where(eq(productManual.productId, data.productId))
      .returning();

    // Atualiza chunks do manual em background
    upsertManualChunks(manual.id, data.productId, data.description).catch(
      (err) => console.warn("⚠️ [MANUAL] Chunk embedding failed:", err instanceof Error ? err.message : String(err)),
    );

    return success({ manual });
  }

  const [manual] = await db
    .insert(productManual)
    .values({
      id: randomUUID(),
      productId: data.productId,
      description: data.description,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // Cria chunks do manual em background
  upsertManualChunks(manual.id, data.productId, data.description).catch(
    (err) => console.warn("⚠️ [MANUAL] Chunk embedding failed:", err instanceof Error ? err.message : String(err)),
  );

  return success({ manual });
}