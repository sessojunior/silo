import { NextResponse } from "next/server";

/**
 * Interface padronizada para respostas da API
 */
export type ApiResponse<T = unknown> = {
  ok?: boolean;
  success: boolean;
  data?: T;
  error?: string;
  message?: string; // Mensagem amigável para o usuário
  field?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    [key: string]: unknown;
  };
};

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
    {
      ok: true,
      success: true,
      data,
      message,
      ...(meta && { meta }),
    },
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
    {
      ok: false,
      success: false,
      error,
      message: error,
      ...(field ? { field } : {}),
      ...(data !== undefined ? { data } : {}),
    },
    { status, headers },
  );
}
