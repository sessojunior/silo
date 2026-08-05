import type { ProductStatus } from "@silo/engine/domain/product-status";

// Paleta de status compartilhada entre o gráfico antigo e o novo PERT.
// Mantida em um único lugar para evitar deriva visual.
export const STATUS_STYLE: Record<
  ProductStatus,
  {
    fill: string;
    text: string;
    meta: string;
    // Classes Tailwind para a borda lateral do node + chip de status.
    borderClass: string;
    chipClass: string;
    iconClass: string;
  }
> = {
  pending: {
    fill: "#9ca3af",
    text: "#111827",
    meta: "#6b7280",
    borderClass: "border-zinc-300 dark:border-zinc-600",
    chipClass: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
    iconClass: "text-zinc-400",
  },
  in_progress: {
    fill: "#3b82f6",
    text: "#ffffff",
    meta: "#e0f2fe",
    borderClass: "border-blue-400 dark:border-blue-500",
    chipClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200",
    iconClass: "text-blue-500",
  },
  completed: {
    fill: "#22c55e",
    text: "#ffffff",
    meta: "#dcfce7",
    borderClass: "border-emerald-400 dark:border-emerald-500",
    chipClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
    iconClass: "text-emerald-500",
  },
  with_problems: {
    fill: "#ef4444",
    text: "#ffffff",
    meta: "#fee2e2",
    borderClass: "border-red-400 dark:border-red-500",
    chipClass: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200",
    iconClass: "text-red-500",
  },
  run_again: {
    fill: "#f97316",
    text: "#ffffff",
    meta: "#ffedd5",
    borderClass: "border-orange-400 dark:border-orange-500",
    chipClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200",
    iconClass: "text-orange-500",
  },
  not_run: {
    fill: "#6b7280",
    text: "#ffffff",
    meta: "#f3f4f6",
    borderClass: "border-zinc-400 dark:border-zinc-500",
    chipClass: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
    iconClass: "text-zinc-500",
  },
  under_support: {
    fill: "#a855f7",
    text: "#ffffff",
    meta: "#f3e8ff",
    borderClass: "border-violet-400 dark:border-violet-500",
    chipClass: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200",
    iconClass: "text-violet-500",
  },
  suspended: {
    fill: "#52525b",
    text: "#ffffff",
    meta: "#f4f4f5",
    borderClass: "border-zinc-500 dark:border-zinc-400",
    chipClass: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
    iconClass: "text-zinc-500",
  },
};

export const FAILURE_STATUSES: ReadonlySet<ProductStatus> = new Set([
  "with_problems",
  "run_again",
  "not_run",
  "under_support",
  "suspended",
]);
