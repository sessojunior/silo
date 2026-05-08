/**
 * Interface padronizada para respostas da API
 * Zero runtime deps — types only.
 */
export type ApiResponse<T = unknown> = {
  ok?: boolean;
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  field?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    [key: string]: unknown;
  };
};

export const parseApiResponse = <T = unknown>(value: unknown): ApiResponse<T> => {
  if (
    value !== null &&
    typeof value === "object" &&
    "success" in value &&
    typeof (value as Record<string, unknown>).success === "boolean"
  ) {
    return value as ApiResponse<T>;
  }
  return {
    success: false,
    ok: false,
    error: "Resposta inválida.",
    message: "Resposta inválida.",
  };
};

export const readApiResponse = async <T = unknown>(res: Response): Promise<ApiResponse<T>> => {
  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return {
      success: false,
      ok: false,
      error: "Resposta inválida.",
      message: "Resposta inválida.",
    };
  }
  return parseApiResponse<T>(payload);
};
