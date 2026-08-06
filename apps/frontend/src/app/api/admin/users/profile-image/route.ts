import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { errorResponse } from "@/lib/api-response";

export const runtime = "nodejs";

/**
 * Route Handler para upload de avatar (POST /api/admin/users/profile-image).
 *
 * O proxy NextResponse.rewrite nao preserva o corpo multipart/form-data
 * ao reescrever para o backend. Esta rota encaminha o upload diretamente.
 */
export async function POST(req: NextRequest) {
  const sessionCookie = req.cookies.get("silo_session")?.value?.trim();
  if (!sessionCookie) {
    return errorResponse("Usuário não autenticado.", 401);
  }

  try {
    const bodyBuffer = await req.arrayBuffer();

    const backendUrl = config.getApiUrl("/api/users/profile-image");
    const forwardHeaders = new Headers();
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
          : null) ?? `Erro no upload: ${upstream.status}`;
      return errorResponse(message, upstream.status);
    }

    return NextResponse.json(payload, { status: upstream.status });
  } catch (error) {
    console.error("[profile-image-route] Erro ao encaminhar upload:", error);
    return errorResponse("Erro ao processar upload.", 502);
  }
}

/**
 * DELETE /api/admin/users/profile-image — remove a foto de perfil.
 */
export async function DELETE(req: NextRequest) {
  const sessionCookie = req.cookies.get("silo_session")?.value?.trim();
  if (!sessionCookie) {
    return errorResponse("Usuário não autenticado.", 401);
  }

  try {
    const cookieHeader = req.headers.get("cookie");
    const forwardHeaders = new Headers();
    if (cookieHeader) {
      forwardHeaders.set("cookie", cookieHeader);
    }

    const upstream = await fetch(
      config.getApiUrl("/api/users/profile-image"),
      {
        method: "DELETE",
        headers: forwardHeaders,
      },
    );

    if (!upstream.ok) {
      const payload = await upstream.json().catch(() => null) as Record<string, unknown> | null;
      return errorResponse(
        String(payload?.error ?? "Erro ao remover imagem."),
        upstream.status,
      );
    }

    return NextResponse.json(
      { success: true, message: "Imagem removida." },
      { status: 200 },
    );
  } catch (error) {
    console.error("[profile-image-route] Erro ao remover imagem:", error);
    return errorResponse("Erro ao remover imagem.", 502);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Cookie",
    },
  });
}
