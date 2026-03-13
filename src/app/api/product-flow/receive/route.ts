import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { product } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const apiKeyHeader = request.headers.get("x-api-key");
    const expectedKey = process.env.PRODUCT_FLOW_API_KEY;
    if (expectedKey && apiKeyHeader !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { productId, slug, payload } = body || {};

    if (!productId && !slug) {
      return NextResponse.json(
        { error: "productId or slug is required in the body" },
        { status: 400 },
      );
    }

    const rows = await db
      .select()
      .from(product)
      .where(productId ? eq(product.id, productId) : eq(product.slug, slug))
      .limit(1);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const prod = rows[0];
    const existing: unknown[] = (prod.dataProductFlow as unknown[]) ?? [];
    const entry = { receivedAt: new Date().toISOString(), payload } as unknown;
    const nextArr = [...existing, entry];

    await db.update(product).set({ dataProductFlow: nextArr as unknown }).where(eq(product.id, prod.id));

    return NextResponse.json({ ok: true, entry }, { status: 200 });
  } catch (error) {
    console.error("[PRODUCT_FLOW] Error receiving flow payload:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
