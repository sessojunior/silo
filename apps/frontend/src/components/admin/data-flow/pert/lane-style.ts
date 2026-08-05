import type { PertLaneColorToken } from "@silo/engine/dataflow/pert-types";

// Mapeia o token neutro vindo do engine para as classes Tailwind reais.
// Mantido na camada web porque cores e tons são decisão de design.
export const LANE_BAND_CLASS: Record<PertLaneColorToken, string> = {
  slate: "bg-gradient-to-r from-slate-100 via-slate-50 to-white dark:from-slate-900/60 dark:via-slate-900/35 dark:to-zinc-950",
  emerald: "bg-gradient-to-r from-emerald-100/90 via-emerald-50/60 to-white dark:from-emerald-950/50 dark:via-emerald-950/30 dark:to-zinc-950",
  sky: "bg-gradient-to-r from-sky-100/90 via-sky-50/60 to-white dark:from-sky-950/50 dark:via-sky-950/30 dark:to-zinc-950",
  amber: "bg-gradient-to-r from-amber-100/90 via-amber-50/60 to-white dark:from-amber-950/50 dark:via-amber-950/30 dark:to-zinc-950",
  violet: "bg-gradient-to-r from-violet-100/85 via-violet-50/50 to-white dark:from-violet-950/50 dark:via-violet-950/30 dark:to-zinc-950",
  fuchsia: "bg-gradient-to-r from-fuchsia-100/85 via-fuchsia-50/50 to-white dark:from-fuchsia-950/50 dark:via-fuchsia-950/30 dark:to-zinc-950",
  rose: "bg-gradient-to-r from-rose-100/85 via-rose-50/50 to-white dark:from-rose-950/50 dark:via-rose-950/30 dark:to-zinc-950",
};

export const LANE_LABEL_CLASS: Record<PertLaneColorToken, string> = {
  slate: "text-zinc-950 dark:text-zinc-100",
  emerald: "text-zinc-950 dark:text-zinc-100",
  sky: "text-zinc-950 dark:text-zinc-100",
  amber: "text-zinc-950 dark:text-zinc-100",
  violet: "text-zinc-950 dark:text-zinc-100",
  fuchsia: "text-zinc-950 dark:text-zinc-100",
  rose: "text-zinc-950 dark:text-zinc-100",
};

export const LANE_ICON_BG_CLASS: Record<PertLaneColorToken, string> = {
  slate: "text-zinc-950 dark:text-zinc-100",
  emerald: "text-zinc-950 dark:text-zinc-100",
  sky: "text-zinc-950 dark:text-zinc-100",
  amber: "text-zinc-950 dark:text-zinc-100",
  violet: "text-zinc-950 dark:text-zinc-100",
  fuchsia: "text-zinc-950 dark:text-zinc-100",
  rose: "text-zinc-950 dark:text-zinc-100",
};

// Iconify identifiers por token semântico vindo do engine.
export const LANE_ICON_BY_TOKEN: Record<string, string> = {
  ingestion: "icon-[lucide--satellite]",
  preprocess: "icon-[lucide--settings-2]",
  model: "icon-[lucide--cloud]",
  postprocess: "icon-[lucide--chart-column]",
  distribution: "icon-[lucide--globe]",
  verification: "icon-[lucide--badge-check]",
  generic: "icon-[lucide--circle-dot]",
};
