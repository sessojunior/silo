import { Router } from "express";
import type { Request, Response } from "express";
import { config } from "@silo/engine/config";
import { respondServiceError as respondProductServiceError } from "../lib/respond-service-error.js";
import * as productService from "../services/product-service.js";

const router = Router();

function respondProductFlowError(res: Response, status: number, error?: string) {
  res.status(status).json({ success: false, error: error ?? "Erro ao processar fluxo de produto." });
}

function respondProductFlowSuccess(res: Response, entry: unknown) {
  res.status(200).json({ success: true, ok: true, data: { entry }, entry });
}

// POST /api/product-flow/receive
router.post("/receive", async (req: Request, res: Response) => {
  try {
    const apiKeyHeader = req.headers["x-api-key"];
    const providedApiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
    const expectedKey = config.productFlowApiKey;
    if (expectedKey && providedApiKey !== expectedKey) {
      respondProductFlowError(res, 401, "Não autorizado.");
      return;
    }

    const body = req.body as { productId?: string; slug?: string; payload?: unknown };
    const { productId, slug, payload } = body ?? {};

    if (!productId && !slug) {
      respondProductFlowError(res, 400, "productId ou slug são obrigatórios no corpo da requisição.");
      return;
    }

    const result = await productService.appendProductFlowEntry({ productId, slug, payload });
    if (!result.ok) {
      respondProductServiceError(res, result, "Erro ao processar fluxo de produto.");
      return;
    }

    respondProductFlowSuccess(res, result.data.entry);
  } catch (error) {
    console.error("[PRODUCT_FLOW] Error receiving flow payload:", error);
    respondProductFlowError(res, 500, "Erro interno do servidor.");
  }
});

export default router;
