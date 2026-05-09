import { db } from "@silo/database";
import { product } from "@silo/database/schema";
import { eq } from "drizzle-orm";
import { getProductDataFlowPipelinesFromKafkaRest } from "../dataflow/kafka-data-flow-source.js";

type ProductDataFlowServiceSuccess<T> = {
  ok: true;
  data: T;
};

type ProductDataFlowServiceError = {
  ok: false;
  error: string;
  status?: number;
};

const success = <T>(data: T): ProductDataFlowServiceSuccess<T> => ({
  ok: true,
  data,
});

const failure = (error: string, status?: number): ProductDataFlowServiceError => ({
  ok: false,
  error,
  ...(typeof status === "number" ? { status } : {}),
});

export type ProductDataFlowPipeline = Awaited<ReturnType<typeof getProductDataFlowPipelinesFromKafkaRest>>[number];

type ProductDataFlowEntry = {
  receivedAt: string;
  payload: unknown;
};

export async function appendProductFlowEntry(params: {
  productId?: string;
  slug?: string;
  payload?: unknown;
}): Promise<ProductDataFlowServiceSuccess<{ entry: ProductDataFlowEntry }> | ProductDataFlowServiceError> {
  const { productId, slug, payload } = params;
  const rows = await db
    .select({ id: product.id, dataProductFlow: product.dataProductFlow })
    .from(product)
    .where(productId ? eq(product.id, productId) : eq(product.slug, slug ?? ""))
    .limit(1);

  if (rows.length === 0) {
    return failure("Produto não encontrado.", 404);
  }

  const currentFlow = Array.isArray(rows[0].dataProductFlow) ? rows[0].dataProductFlow : [];
  const entry: ProductDataFlowEntry = { receivedAt: new Date().toISOString(), payload };
  const nextFlow = [...currentFlow, entry];

  await db.update(product).set({ dataProductFlow: nextFlow as unknown }).where(eq(product.id, rows[0].id));

  return success({ entry });
}

export async function listProductDataFlowPipelines(params: {
  productSlug: string | null | undefined;
  date?: string | null | undefined;
  turn?: string | null | undefined;
}): Promise<ProductDataFlowServiceSuccess<{ pipelines: ProductDataFlowPipeline[] }> | ProductDataFlowServiceError> {
  const productSlug = String(params.productSlug ?? "").trim();
  if (!productSlug) {
    return failure("Produto inválido.", 400);
  }

  const pipelines = await getProductDataFlowPipelinesFromKafkaRest({
    slug: productSlug,
    date: params.date,
    turn: params.turn,
  });

  return success({ pipelines });
}