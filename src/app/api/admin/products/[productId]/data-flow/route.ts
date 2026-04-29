import { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api-response";
import { getProductDataFlowPipelinesFromKafkaRest } from "@/lib/dataflow/kafkaDataFlowSource";
import { requirePermissionAuthUser } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  const authResult = await requirePermissionAuthUser("products", "list");
  if (!authResult.ok) return authResult.response;

  const { productId } = await params;
  const productSlug = String(productId ?? "").trim();
  if (!productSlug) {
    return errorResponse("Produto inválido.", 400);
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const turn = searchParams.get("turn");

  const pipelines = await getProductDataFlowPipelinesFromKafkaRest({
    slug: productSlug,
    date,
    turn,
  });

  return successResponse({ pipelines });
}