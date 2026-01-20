import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import {
  deleteUploadFile,
  getContentTypeFromFilename,
  isSafeFilename,
  isUploadKind,
  readUploadFile,
} from "@/lib/localUploads";
import { getAuthUser } from "@/lib/auth/server";
import { requireAdmin } from "@/lib/auth/admin";
import { errorResponse, successResponse } from "@/lib/api-response";

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

const buildFileHeaders = (req: NextRequest): Headers => {
  const headers = new Headers();
  const origin = req.headers.get("origin");
  const allowedOrigin = getAllowedOrigin(origin);

  if (allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
    headers.set("Vary", "Origin");
  }

  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS, DELETE");
  headers.set(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept",
  );
  headers.set("Cross-Origin-Resource-Policy", "same-site");
  return headers;
};

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: buildFileHeaders(req),
  });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ type: string; filename: string }> },
) {
  const { type, filename } = await context.params;

  if (!isUploadKind(type)) return errorResponse("Parâmetros inválidos", 400);
  if (!isSafeFilename(filename))
    return errorResponse("Parâmetros inválidos", 400);

  const file = await readUploadFile(type, filename);
  if (!file) return errorResponse("Arquivo não encontrado", 404);

  const headers = buildFileHeaders(req);
  headers.set("Content-Type", getContentTypeFromFilename(filename));
  headers.set("Cache-Control", "public, max-age=3600");

  const body = new Uint8Array(file);
  return new NextResponse(body, { status: 200, headers });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ type: string; filename: string }> },
) {
  const { type, filename } = await context.params;

  if (!isUploadKind(type)) return errorResponse("Parâmetros inválidos", 400);
  if (!isSafeFilename(filename))
    return errorResponse("Parâmetros inválidos", 400);

  const headers = buildFileHeaders(req);

  const user = await getAuthUser();
  if (!user) {
    return errorResponse("Usuário não autenticado.", 401, undefined, headers);
  }

  const adminCheck = await requireAdmin(user.id);
  if (!adminCheck.success) {
    return errorResponse(adminCheck.error, 403, undefined, headers);
  }

  const ok = await deleteUploadFile(type, filename);
  if (!ok)
    return errorResponse("Arquivo não encontrado", 404, undefined, headers);

  return successResponse(
    null,
    "Arquivo deletado com sucesso",
    200,
    undefined,
    headers,
  );
}
