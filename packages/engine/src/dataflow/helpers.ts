import {
  DEFAULT_STATUS,
  type ProductStatus,
} from "../domain/product-status";

export const STATUS_BY_KAFKA_STATE: Record<string, ProductStatus> = {
  queued: "pending",
  queue: "pending",
  pending: "pending",
  submitted: "pending",
  complete: "completed",
  completed: "completed",
  active: "in_progress",
  running: "in_progress",
  in_progress: "in_progress",
  failed: "with_problems",
  aborted: "with_problems",
  error: "with_problems",
  with_problems: "with_problems",
  run_again: "run_again",
  not_run: "not_run",
  under_support: "under_support",
  suspended: "suspended",
};

export function normalizeModelKey(value: string): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeProductStatus(
  primary?: string | null,
  fallback?: string | null,
): ProductStatus {
  const candidates = [primary, fallback];
  for (const candidate of candidates) {
    const key = String(candidate ?? "").trim().toLowerCase();
    if (key && STATUS_BY_KAFKA_STATE[key]) {
      return STATUS_BY_KAFKA_STATE[key];
    }
  }
  return DEFAULT_STATUS;
}

export function clampProgress(value: unknown, status: ProductStatus): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(100, Math.max(0, Math.round(value)));
  }

  if (status === "completed") return 100;
  if (status === "in_progress") return 50;
  return 0;
}
