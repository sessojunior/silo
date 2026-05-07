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

export const parseApiResponse = (value: unknown): ApiResponse => {
  if (
    value !== null &&
    typeof value === "object" &&
    "success" in value &&
    typeof (value as Record<string, unknown>).success === "boolean"
  ) {
    return value as ApiResponse;
  }
  return {
    success: false,
    ok: false,
    error: "Resposta inválida.",
    message: "Resposta inválida.",
  };
};

export const readApiResponse = async (res: Response): Promise<ApiResponse> => {
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
  return parseApiResponse(payload);
};
