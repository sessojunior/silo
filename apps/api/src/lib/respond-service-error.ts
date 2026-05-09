import type { Response as ExpressResponse } from "express";

export type ServiceErrorResult = {
  ok: false;
  error: unknown;
  status?: number;
  field?: string;
  data?: unknown;
  retryAfterSeconds?: number;
  resetFlow?: boolean;
};

export const isServiceErrorResult = (result: unknown): result is ServiceErrorResult => {
  return (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    "ok" in result &&
    (result as { ok?: unknown }).ok === false
  );
};

export const respondServiceError = (
  res: ExpressResponse,
  result: unknown,
  fallbackMessage: string,
): result is ServiceErrorResult => {
  if (!isServiceErrorResult(result)) {
    return false;
  }

  const errorResult = result;
  const status = typeof errorResult.status === "number" ? errorResult.status : 400;
  const retryAfterSeconds = typeof errorResult.retryAfterSeconds === "number" ? errorResult.retryAfterSeconds : undefined;
  const payload: { success: false; error: string; field?: string; data?: unknown; retryAfterSeconds?: number; resetFlow?: boolean } = {
    success: false,
    error: typeof errorResult.error === "string" ? errorResult.error : fallbackMessage,
  };

  if (typeof errorResult.field === "string") payload.field = errorResult.field;
  if (errorResult.data !== undefined) payload.data = errorResult.data;
  if (retryAfterSeconds !== undefined) payload.retryAfterSeconds = retryAfterSeconds;
  if (typeof errorResult.resetFlow === "boolean") payload.resetFlow = errorResult.resetFlow;
  if (retryAfterSeconds !== undefined && status === 429) res.set("Retry-After", String(retryAfterSeconds));

  res.status(status).json(payload);
  return true;
};
