"use client";

import type { PertSummary } from "@silo/engine/dataflow/pert-types";

interface KpiCardProps {
  label: string;
  value: string;
  iconClass: string;
  iconToneClass: string;
}

function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

function KpiCard({ label, value, iconClass, iconToneClass }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <span className={`${iconClass} size-5 shrink-0 ${iconToneClass}`} aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{label}</p>
          <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</p>
        </div>
      </div>
    </div>
  );
}

export function PertKpis({ summary }: { summary: PertSummary }) {
  const failed = summary.byStatus.with_problems
    + summary.byStatus.run_again
    + summary.byStatus.not_run
    + summary.byStatus.under_support;
  const cancelled = summary.byStatus.suspended;

  return (
    <div data-testid="pert-kpis" className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        label="Total tasks"
        value={String(summary.total)}
        iconClass="icon-[lucide--layers-3]"
        iconToneClass="text-blue-600"
      />

      <KpiCard
        label="Sucesso"
        value={`${summary.byStatus.completed} (${pct(summary.byStatus.completed, summary.total)})`}
        iconClass="icon-[lucide--check-circle]"
        iconToneClass="text-emerald-600"
      />
      <KpiCard
        label="Executando"
        value={`${summary.byStatus.in_progress} (${pct(summary.byStatus.in_progress, summary.total)})`}
        iconClass="icon-[lucide--play-circle]"
        iconToneClass="text-sky-600"
      />
      <KpiCard
        label="Aguardando"
        value={`${summary.byStatus.pending} (${pct(summary.byStatus.pending, summary.total)})`}
        iconClass="icon-[lucide--clock-3]"
        iconToneClass="text-zinc-500"
      />
      <KpiCard
        label="Falha"
        value={`${failed} (${pct(failed, summary.total)})`}
        iconClass="icon-[lucide--alert-triangle]"
        iconToneClass="text-red-600"
      />
      <KpiCard
        label="Cancelado"
        value={`${cancelled} (${pct(cancelled, summary.total)})`}
        iconClass="icon-[lucide--ban]"
        iconToneClass="text-amber-600"
      />
    </div>
  );
}

