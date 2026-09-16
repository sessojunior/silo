import { NextRequest, NextResponse } from "next/server";
import { forwardUpload } from "@/lib/upload-proxy";

export const runtime = "nodejs";

/**
 * Route Handler para upload de arquivos via multipart/form-data.
 *
 * O proxy do Next.js (proxy.ts) nao encaminha corretamente o corpo
 * multipart/form-data ao reescrever para o backend Python. Esta rota
 * resolve o problema recebendo o upload diretamente e encaminhando
 * o corpo bruto via fetch para o backend.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ kind: string }> },
) {
  const { kind } = await context.params;

  return forwardUpload(req, `/api/upload/${encodeURIComponent(kind)}`);
}

/**
 * Suporte a OPTIONS para CORS preflight (embora same-origin, mantemos).
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Cookie",
    },
  });
}
