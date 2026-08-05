import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { errorResponse } from "@/lib/api-response";

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

  // Valida o cookie de sessao (mesmo padrao do proxy.ts)
  const sessionCookie = req.cookies.get("silo_session")?.value?.trim();
  if (!sessionCookie) {
    return errorResponse("Usuário não autenticado.", 401);
  }

  try {
    // Le o corpo bruto da requisicao (multipart/form-data)
    const bodyBuffer = await req.arrayBuffer();

    // Encaminha para o backend Python
    const backendUrl = config.getApiUrl(`/api/upload/${kind}`);
    const forwardHeaders = new Headers();
    // Encaminha todos os cookies da requisicao original
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      forwardHeaders.set("cookie", cookieHeader);
    }
    forwardHeaders.set(
      "content-type",
      req.headers.get("content-type") ?? "multipart/form-data",
    );
    forwardHeaders.set("accept", "application/json");

    const upstream = await fetch(backendUrl, {
      method: "POST",
      headers: forwardHeaders,
      body: bodyBuffer,
    });

    const payload: unknown = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      const message =
        (payload && typeof payload === "object" && "error" in payload
          ? String((payload as Record<string, unknown>).error)
          : null) ??
        `Erro no upload: ${upstream.status}`;
      return errorResponse(message, upstream.status);
    }

    return NextResponse.json(payload, { status: upstream.status });
  } catch (error) {
    console.error("[upload-route] Erro ao encaminhar upload:", error);
    return errorResponse("Erro ao processar upload.", 502);
  }
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
