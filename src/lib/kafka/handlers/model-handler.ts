import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function modelHandler(params: {
  topic: string;
  partition: number;
  messageId: string | number;
  payload: unknown;
  tx?: unknown;
}) {
  const { messageId, payload, tx } = params;
  // Exemplo mínimo: se payload tiver productId ou slug, adiciona entry em dataProductFlow
  try {
    const payloadObj = (payload || {}) as Record<string, unknown>;
    const productId = (payloadObj["productId"] ?? payloadObj["product_id"]) as string | number | undefined;
    const slug = payloadObj["slug"] as string | undefined;
    const data = (payloadObj["data"] ?? payloadObj["payload"] ?? payloadObj) as unknown;

    if (!productId && !slug) {
      // Sem referência a produto - nada a fazer aqui
      return;
    }

    const client = ((tx as unknown) as typeof db) || db;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const whereExpr = productId
      ? eq(schema.product.id, productId as any)
      : eq(schema.product.slug, slug as any);
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const rows = await client.select().from(schema.product).where(whereExpr).limit(1);
    if (!rows || rows.length === 0) return;

    const prod = rows[0];
    const existing: unknown[] = (prod.dataProductFlow as unknown[]) ?? [];
    const entry = { receivedAt: new Date().toISOString(), payload: data, messageId } as unknown;
    const nextArr = [...existing, entry];

    await client.update(schema.product).set({ dataProductFlow: nextArr as unknown }).where(eq(schema.product.id, prod.id));
  } catch (err) {
    console.error("[KAFKA][modelHandler] error", err);
    throw err;
  }
}
