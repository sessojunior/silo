import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { errorResponse } from "@/lib/api-response";
import { requireAuthUser } from "@/lib/auth/server";

export const MAX_UPLOAD_REQUEST_BYTES = 5 * 1024 * 1024;

export class UploadBodyTooLargeError extends Error {}

export async function readLimitedBody(request: Request, limit = MAX_UPLOAD_REQUEST_BYTES) {
  const length = request.headers.get("content-length");
  if (length && Number(length) > limit) throw new UploadBodyTooLargeError();
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new UploadBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export function mutationHeaders(request: Request) {
  const headers = new Headers();
  for (const name of ["cookie", "origin", "referer", "sec-fetch-site", "content-type"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("accept", "application/json");
  return headers;
}

export async function forwardUpload(request: Request, apiPath: string) {
  const auth = await requireAuthUser();
  if (!auth.ok) return auth.response;
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;")) {
    return errorResponse("Requisição deve ser multipart/form-data.", 415);
  }
  try {
    const body = await readLimitedBody(request);
    const upstream = await fetch(config.getApiUrl(apiPath), {
      method: "POST", headers: mutationHeaders(request), body,
      signal: AbortSignal.timeout(30_000),
    });
    const payload: unknown = await upstream.json().catch(() => null);
    return NextResponse.json(payload ?? { success: false, error: "Resposta inválida do serviço de upload." }, {
      status: payload ? upstream.status : 502,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof UploadBodyTooLargeError) {
      return errorResponse("Requisição muito grande.", 413);
    }
    return errorResponse("Erro ao processar upload.", 502);
  }
}
