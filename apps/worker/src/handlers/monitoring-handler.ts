import { db } from "@silo/database";
import * as schema from "@silo/database/schema";
import { eq } from "drizzle-orm";

export async function monitoringHandler(params: {
  topic: string;
  partition: number;
  messageId: string | number;
  payload: unknown;
  tx?: unknown;
}) {
  const { payload, tx } = params;
  try {
    const payloadObj = (payload || {}) as Record<string, unknown>;
    const slug = (payloadObj["slug"] ??
      payloadObj["pageSlug"] ??
      payloadObj["page_id"]) as string | undefined;
    if (!slug) return;

    const client = ((tx as unknown) as typeof db) || db;

    const rows = await client
      .select()
      .from(schema.picturePage)
      .where(eq(schema.picturePage.slug, slug))
      .limit(1);
    if (!rows || rows.length === 0) return;

    const page = rows[0];
    const update: Record<string, unknown> = {};
    if (typeof payloadObj["status"] !== "undefined")
      update.status = payloadObj["status"];
    if (typeof payloadObj["delayMinutes"] !== "undefined")
      update.delayMinutes = payloadObj["delayMinutes"];
    if (typeof payloadObj["delay"] !== "undefined")
      update.delay = payloadObj["delay"];

    if (Object.keys(update).length === 0) return;

    await client
      .update(schema.picturePage)
      .set(update)
      .where(eq(schema.picturePage.id, page.id));
  } catch (err) {
    console.error("[KAFKA][monitoringHandler] error", err);
    throw err;
  }
}
