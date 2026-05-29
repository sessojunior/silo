import * as schema from "@silo/database/schema";
import { eq } from "drizzle-orm";
import { resolveWorkerDbClient } from "./db-client";
import { isRecord } from "../lib/kafka-payload";

export async function modelHandler(params: {
  topic: string;
  partition: number;
  messageId: string | number;
  payload: unknown;
  tx?: unknown;
}) {
  const { messageId, payload, tx } = params;
  try {
    const payloadObj = isRecord(payload) ? payload : null;
    const productIdValue = payloadObj?.productId ?? payloadObj?.product_id;
    const productId =
      typeof productIdValue === "string" || typeof productIdValue === "number"
        ? productIdValue
        : undefined;
    const slugValue = payloadObj?.slug;
    const slug = typeof slugValue === "string" ? slugValue : undefined;
    const data = payloadObj?.data ?? payloadObj?.payload ?? payloadObj;

    if (!productId && !slug) return;

    const client = resolveWorkerDbClient(tx);

    const whereExpr = productId
      ? eq(schema.product.id, productId)
      : eq(schema.product.slug, slug);

    const rows = await client
      .select()
      .from(schema.product)
      .where(whereExpr)
      .limit(1);
    if (!rows || rows.length === 0) return;

    const prod = rows[0];
    const existing: unknown[] = (prod.dataProductFlow as unknown[]) ?? [];
    const entry = {
      receivedAt: new Date().toISOString(),
      payload: data,
      messageId,
    } as unknown;
    const nextArr = [...existing, entry];

    await client
      .update(schema.product)
      .set({ dataProductFlow: nextArr as unknown })
      .where(eq(schema.product.id, prod.id));
  } catch (err) {
    console.error("[KAFKA][modelHandler] error", err);
    throw err;
  }
}
