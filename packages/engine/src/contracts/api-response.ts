/**
 * Interface padronizada para respostas da API
 * Zero runtime deps — types only.
 */
export type ApiResponseMeta = {
  page?: number;
  limit?: number;
  total?: number;
  [key: string]: unknown;
};

export type ApiResponse<T = unknown> = {
  ok?: boolean;
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  field?: string;
  meta?: ApiResponseMeta;
};

export type ApiSuccessPayload<T> = {
  ok: true;
  success: true;
  data: T;
  message?: string;
  meta?: ApiResponseMeta;
};

export type ApiErrorPayload = {
  ok: false;
  success: false;
  error: string;
  message: string;
  data?: unknown;
  field?: string;
};

export const buildApiSuccessPayload = <T>(
  data: T,
  message?: string,
  meta?: ApiResponseMeta,
): ApiSuccessPayload<T> => {
  return {
    ok: true,
    success: true,
    data,
    ...(message ? { message } : {}),
    ...(meta ? { meta } : {}),
  };
};

export const buildApiErrorPayload = (
  error: string,
  options?: { data?: unknown; field?: string },
): ApiErrorPayload => {
  return {
    ok: false,
    success: false,
    error,
    message: error,
    ...(options?.data !== undefined ? { data: options.data } : {}),
    ...(options?.field ? { field: options.field } : {}),
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
