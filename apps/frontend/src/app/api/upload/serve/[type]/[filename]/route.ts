import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api-response";
import { requireAuthUser } from "@/lib/auth/server";
import { config } from "@/lib/config";

export const runtime = "nodejs";

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const PDF_FILENAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\.pdf$/i;

function isSafePdfPath(type: string, filename: string): boolean {
  return (
    type === "reports" &&
    PDF_FILENAME_PATTERN.test(filename) &&
    !filename.includes("..") &&
    !filename.includes("/") &&
    !filename.includes("\\") &&
    !filename.includes(":")
  );
}

function upstreamHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const name of ["cookie", "origin", "referer", "sec-fetch-site"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("accept", "application/pdf");
  return headers;
}

function isPdfSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ type: string; filename: string }> },
) {
  const { type, filename } = await context.params;

  if (!isSafePdfPath(type, filename)) {
    return errorResponse("Arquivo nÃ£o encontrado.", 404);
  }

  const auth = await requireAuthUser();
  if (!auth.ok) return auth.response;

  try {
    const upstream = await fetch(
      config.getApiUrl(
        `/api/upload/serve/${encodeURIComponent(type)}/${encodeURIComponent(filename)}`,
      ),
      {
        cache: "no-store",
        headers: upstreamHeaders(request),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!upstream.ok) {
      return errorResponse(
        upstream.status === 401
          ? "UsuÃ¡rio nÃ£o autenticado."
          : upstream.status === 403
            ? "PermissÃ£o insuficiente."
            : "Arquivo nÃ£o encontrado.",
        upstream.status,
      );
    }

    const declaredLength = Number(upstream.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_PDF_BYTES) {
      return errorResponse("PDF excede o tamanho permitido.", 413);
    }

    const bytes = new Uint8Array(await upstream.arrayBuffer());
    if (bytes.byteLength > MAX_PDF_BYTES) {
      return errorResponse("PDF excede o tamanho permitido.", 413);
    }
    if (!isPdfSignature(bytes)) {
      return errorResponse("Arquivo PDF invÃ¡lido.", 502);
    }

    const checksumBuffer = await crypto.subtle.digest("SHA-256", bytes);
    const checksum = Array.from(new Uint8Array(checksumBuffer), (value) =>
      value.toString(16).padStart(2, "0"),
    ).join("");
    const headers = new Headers({
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(bytes.byteLength),
      "Content-Type": "application/pdf",
      "ETag": `"${checksum}"`,
      "X-Content-SHA256": checksum,
      "X-Content-Type-Options": "nosniff",
    });
    return new NextResponse(bytes, { status: 200, headers });
  } catch {
    return errorResponse("Erro ao ler arquivo.", 502);
  }
}
