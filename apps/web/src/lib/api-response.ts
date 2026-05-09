import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildApiErrorPayload,
  buildApiSuccessPayload,
  parseApiResponse,
  readApiResponse,
  type ApiResponse,
} from "@silo/engine/contracts/api-response";

export { parseApiResponse, readApiResponse } from "@silo/engine/contracts/api-response";
export { type ApiResponse } from "@silo/engine/contracts/api-response";

type ParsedRequest<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

function toFieldFromPath(path: Array<PropertyKey>): string | undefined {
  const segments = path.map((segment) => String(segment).trim()).filter((segment) => segment.length > 0);
  if (segments.length === 0) return undefined;
  return segments.join(".");
}

/**
 * Retorna uma resposta de sucesso padronizada
 * @param data Dados a serem retornados
 * @param message Mensagem opcional de sucesso
 * @param status Código HTTP (padrão 200)
 * @param meta Metadados opcionais (paginação, etc)
 */
export function successResponse<T>(
  data: T,
  message?: string,
  status: number = 200,
  meta?: Record<string, unknown>,
  headers?: HeadersInit,
) {
  return NextResponse.json(
    buildApiSuccessPayload(data, message, meta),
    { status, headers },
  );
}

/**
 * Retorna uma resposta de erro padronizada
 * @param error Mensagem de erro
 * @param status Código HTTP (padrão 400)
 * @param data Dados opcionais relacionados ao erro (ex: campos inválidos)
 * @param headers Headers opcionais para a resposta
 */
export function errorResponse(
  error: string,
  status: number = 400,
  data?: unknown,
  headers?: HeadersInit,
) {
  const field =
    typeof data === "object" &&
    data !== null &&
    "field" in data &&
    typeof (data as { field?: unknown }).field === "string"
      ? (data as { field: string }).field
      : undefined;

  return NextResponse.json(
    buildApiErrorPayload(error, {
      ...(field ? { field } : {}),
      ...(data !== undefined ? { data } : {}),
    }),
    { status, headers },
  );
}

const toZodFirstIssue = (
  error: z.ZodError,
): { message: string; field?: string } => {
  const issue = error.issues[0];
  if (!issue) return { message: "Dados inválidos." };
  const field = toFieldFromPath(issue.path);
  return {
    message: issue.message || "Dados inválidos.",
    ...(field ? { field } : {}),
  };
};

export async function parseRequestJson<TSchema extends z.ZodTypeAny>(
  req: Request,
  schema: TSchema,
): Promise<ParsedRequest<z.infer<TSchema>>> {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return { ok: false, response: errorResponse("Body inválido.", 400) };
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const issue = toZodFirstIssue(parsed.error);
    return {
      ok: false,
      response: errorResponse(
        issue.message,
        400,
        issue.field ? { field: issue.field } : undefined,
      ),
    };
  }

  return { ok: true, data: parsed.data };
}

export function parseRequestQuery<TSchema extends z.ZodTypeAny>(
  req: Request,
  schema: TSchema,
): ParsedRequest<z.infer<TSchema>> {
  const { searchParams } = new URL(req.url);
  const raw: Record<string, string | string[]> = {};
  for (const [key, value] of searchParams.entries()) {
    const current = raw[key];
    if (current === undefined) raw[key] = value;
    else if (Array.isArray(current)) current.push(value);
    else raw[key] = [current, value];
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = toZodFirstIssue(parsed.error);
    return {
      ok: false,
      response: errorResponse(
        issue.message,
        400,
        issue.field ? { field: issue.field } : undefined,
      ),
    };
  }

  return { ok: true, data: parsed.data };
}

export async function parseRequestFormData<TSchema extends z.ZodTypeAny>(
  req: Request,
  schema: TSchema,
): Promise<ParsedRequest<z.infer<TSchema>>> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return { ok: false, response: errorResponse("Body inválido.", 400) };
  }

  const raw: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    const current = raw[key];
    if (current === undefined) raw[key] = value;
    else if (Array.isArray(current)) current.push(value);
    else raw[key] = [current, value];
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = toZodFirstIssue(parsed.error);
    return {
      ok: false,
      response: errorResponse(
        issue.message,
        400,
        issue.field ? { field: issue.field } : undefined,
      ),
    };
  }

  return { ok: true, data: parsed.data };
}
