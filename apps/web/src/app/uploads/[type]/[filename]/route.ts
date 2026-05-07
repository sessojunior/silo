import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { errorResponse, successResponse } from "@/lib/api-response";
import { getApiUrl } from "@/lib/api-client";

export const runtime = "nodejs";

const getAllowedOrigin = (origin: string | null): string | null => {
  if (!origin) return null;
  try {
    const requestOrigin = new URL(origin).origin;
    if (!config.appUrl) return null;
    const appOrigin = new URL(config.appUrl).origin;
    return requestOrigin === appOrigin ? requestOrigin : null;
  } catch {
    return null;
  }
};

const buildCorsHeaders = (req: NextRequest): Headers => {
  const headers = new Headers();
  const origin = req.headers.get("origin");
  const allowedOrigin = getAllowedOrigin(origin);
  if (allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
    headers.set("Vary", "Origin");
  }
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS, DELETE");
  headers.set("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  headers.set("Cross-Origin-Resource-Policy", "same-site");
  return headers;
};

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 200, headers: buildCorsHeaders(req) });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ type: string; filename: string }> },
) {
  const { type, filename } = await context.params;
  const corsHeaders = buildCorsHeaders(req);
  try {
    const upstream = await fetch(getApiUrl(`/api/upload/serve/${type}/${filename}`), { cache: "no-store" });
    if (!upstream.ok) {
      return errorResponse("Arquivo não encontrado", upstream.status as 404, undefined, corsHeaders);
    }
    const responseHeaders = new Headers(corsHeaders);
    const ct = upstream.headers.get("content-type");
    if (ct) responseHeaders.set("Content-Type", ct);
    responseHeaders.set("Cache-Control", "public, max-age=3600");
    return new NextResponse(upstream.body, { status: 200, headers: responseHeaders });
  } catch {
    return errorResponse("Erro ao ler arquivo.", 502, undefined, corsHeaders);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ type: string; filename: string }> },
) {
  const { type, filename } = await context.params;
  const corsHeaders = buildCorsHeaders(req);
  const forwardHeaders = new Headers();
  const cookie = req.headers.get("cookie");
  if (cookie) forwardHeaders.set("cookie", cookie);
  try {
    const upstream = await fetch(getApiUrl(`/api/upload/serve/${type}/${filename}`), {
      method: "DELETE",
      headers: forwardHeaders,
    });
    if (!upstream.ok) {
      const body = await upstream.json().catch(() => ({ error: "Erro ao deletar arquivo." })) as { error?: string };
      return errorResponse(body.error ?? "Erro ao deletar arquivo.", upstream.status as 404 | 403, undefined, corsHeaders);
    }
    return successResponse(null, undefined, 200, undefined, corsHeaders);
  } catch {
    return errorResponse("Erro ao deletar arquivo.", 502, undefined, corsHeaders);
  }
}

