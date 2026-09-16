import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { errorResponse } from "@/lib/api-response";
import { forwardUpload, mutationHeaders } from "@/lib/upload-proxy";

export const runtime = "nodejs";

/**
 * Route Handler para upload de avatar (POST /api/admin/users/profile-image).
 *
 * O proxy NextResponse.rewrite nao preserva o corpo multipart/form-data
 * ao reescrever para o backend. Esta rota encaminha o upload diretamente.
 */
export async function POST(req: NextRequest) {
  return forwardUpload(req, "/api/users/profile-image");
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
    const forwardHeaders = mutationHeaders(req);

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
