"use client";

import { useMemo, useState, type ReactNode } from "react";

import type { EcflowKafkaNode } from "@silo/engine/dataflow/ecflow-kafka";
import { buildPertGraphFromGroups } from "@silo/engine/dataflow/pert-build";
import type { PertGraph as PertGraphModel, PertRunMeta, PertTaskNode } from "@silo/engine/dataflow/pert-types";
import type { DataFlowTaskGroup } from "@silo/engine/dataflow/types";
import { normalizeProductStatus } from "@silo/engine/dataflow/helpers";
import { getStatusLabel } from "@silo/engine/domain/product-status";
import type { ProductStatus } from "@silo/engine/domain/product-status";

import { FAILURE_STATUSES, STATUS_STYLE } from "../status-style";
import { PertCanvas } from "./pert-canvas";
import { formatDateTimeTechnical, formatDurationMinutes, formatHourMinute } from "./time-format";

interface PertGraphProps {
  groups: DataFlowTaskGroup[];
  ecflowRoot: EcflowKafkaNode;
  runMeta: PertRunMeta;
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
}

function percentOf(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}

type TreeSummary = {
  total: number;
  byStatus: Record<ProductStatus, number>;
  successRate: number;
  failedTaskIds: string[];
};

function buildTreeSummary(root: EcflowKafkaNode): TreeSummary {
  const byStatus: Record<ProductStatus, number> = {
    pending: 0,
    in_progress: 0,
    completed: 0,
    with_problems: 0,
    run_again: 0,
    not_run: 0,
    under_support: 0,
    suspended: 0,
  };
  const failedTaskIds: string[] = [];

  let total = 0;

  function visit(node: EcflowKafkaNode): void {
    const kind = typeof node.kind === "string" ? node.kind.trim().toLowerCase() : "";
    if (kind === "task") {
      const status = normalizeProductStatus(node.state ?? node.status ?? node.node_state, node.default_state);
      byStatus[status] += 1;
      total += 1;

      if (
        status === "with_problems" ||
        status === "run_again" ||
        status === "not_run" ||
        status === "under_support" ||
        status === "suspended"
      ) {
        failedTaskIds.push(String(node.id ?? node.name ?? `task-${total}`));
      }
      return;
    }

    for (const child of node.tasks ?? []) visit(child);
    for (const child of node.groups ?? []) visit(child);
  }

  visit(root);

  return {
    total,
    byStatus,
    successRate: total === 0 ? 0 : Math.round((byStatus.completed / total) * 100),
    failedTaskIds,
  };
}

function formatElapsed(start?: string | null, end?: string | null): string {
  if (!start) return "--:--:--";
  const startMs = Date.parse(start);
  const endMs = end ? Date.parse(end) : Date.now();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return "--:--:--";
  const totalSeconds = Math.floor((endMs - startMs) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function HeaderMetric({
  icon,
  label,
  value,
  detail,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  detail: string;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-3 flex min-h-20 items-center gap-3">
      <span className={`${icon} size-8 shrink-0`} style={{ color }} />
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</div>
        <div className="mt-1 text-2xl font-bold leading-none tracking-tight text-zinc-900 dark:text-zinc-50">{value}</div>
        <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{detail}</div>
      </div>
    </div>
  );
}

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function MetricDot({ color, label, value, percent }: { color: string; label: string; value: number; percent: number }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-sm">
      <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="truncate font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      <span className="text-right font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{value} <span className="font-medium text-zinc-500">{percent}%</span></span>
    </div>
  );
}

function RunDonut({ graph }: { graph: PertGraphModel }) {
  const total = Math.max(graph.summary.total, 1);
  const success = percentOf(graph.summary.byStatus.completed, total);
  const running = percentOf(graph.summary.byStatus.in_progress, total);
  const failed = percentOf(graph.summary.failedTaskIds.length, total);
  const waiting = Math.max(0, 100 - success - running - failed);

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative flex size-28 shrink-0 items-center justify-center rounded-full"
        style={{ background: `conic-gradient(#22c55e 0 ${success}%, #2563eb ${success}% ${success + running}%, #ef4444 ${success + running}% ${success + running + failed}%, #d4d4d8 ${success + running + failed}% ${success + running + failed + waiting}%)` }}
      >
        <div className="flex size-20 flex-col items-center justify-center rounded-full bg-white text-center shadow-inner dark:bg-zinc-900">
          <span className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{graph.summary.total}</span>
          <span className="text-xs font-medium text-zinc-500">tasks</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <MetricDot color="#22c55e" label="Sucesso" value={graph.summary.byStatus.completed} percent={success} />
        <MetricDot color="#2563eb" label="Executando" value={graph.summary.byStatus.in_progress} percent={running} />
        <MetricDot color="#9ca3af" label="Aguardando" value={graph.summary.byStatus.pending} percent={percentOf(graph.summary.byStatus.pending, total)} />
        <MetricDot color="#ef4444" label="Falhas" value={graph.summary.failedTaskIds.length} percent={failed} />
      </div>
    </div>
  );
}

function FailureItem({ task, onSelect }: { task: PertTaskNode; onSelect: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onSelect(task.id)} className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-red-50 dark:hover:bg-red-950/20">
      <span className="icon-[lucide--x-circle] mt-0.5 size-4 shrink-0 text-red-500" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-red-600 dark:text-red-300">{task.name}</span>
        <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">{formatHourMinute(task.finishedAt ?? task.plannedEndAt) ?? "--:--"} · {getStatusLabel(task.status)}</span>
      </span>
    </button>
  );
}

function impactMessage(graph: PertGraphModel): { title: string; items: string[]; tone: "red" | "amber" | "green" } {
  const failures = graph.summary.failedTaskIds.length;
  const affected = graph.summary.affectedTaskIds.length;

  if (failures > 0) {
    return {
      title: `${failures} falha${failures > 1 ? "s" : ""} detectada${failures > 1 ? "s" : ""} com impacto operacional`,
      items: [
        `${affected} task${affected === 1 ? "" : "s"} descendente${affected === 1 ? "" : "s"} afetada${affected === 1 ? "" : "s"}`,
        graph.summary.criticalFailedCount > 0 ? "Caminho crítico comprometido" : "Caminho crítico sem falha direta",
        "Produtos finais podem atrasar conforme dependências pendentes",
      ],
      tone: "red",
    };
  }

  if (graph.summary.byStatus.in_progress > 0) {
    return {
      title: "Rodada em execução sem falhas críticas",
      items: ["Monitorar conclusão das tasks em andamento", "Dependências ativas seguem no fluxo esperado", "Produtos finais ainda aguardam fechamento"],
      tone: "amber",
    };
  }

  return {
    title: "Rodada sem impacto operacional detectado",
    items: ["Nenhuma falha registrada", "Dependências principais satisfeitas", "Fluxo de dados estável"],
    tone: "green",
  };
}

function OperationalSidePanel({
  graph,
  runMeta,
  autoRefresh,
  onToggleAutoRefresh,
  onSelectTask,
}: {
  graph: PertGraphModel;
  runMeta: PertRunMeta;
  autoRefresh: boolean;
  onToggleAutoRefresh: (value: boolean) => void;
  onSelectTask: (id: string) => void;
}) {
  const failedTasks = graph.nodes.filter((task) => FAILURE_STATUSES.has(task.status));
  const impact = impactMessage(graph);
  const impactClass = impact.tone === "red" ? "border-red-200 bg-red-50 text-red-700" : impact.tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
      <div data-testid="pert-side-panel-scroll" className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        <PanelSection title="Saúde da rodada">
          <RunDonut graph={graph} />
          <div className="mt-4 grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 border-t border-zinc-200 pt-3 text-sm dark:border-zinc-700">
            <span className="font-medium text-zinc-500">Rodada</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">{runMeta.runLabel || "--"}</span>
            <span className="font-medium text-zinc-500">Início da rodada</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">{formatHourMinute(runMeta.actualStartAt ?? runMeta.plannedStartAt) ?? "--:--"}</span>
            <span className="font-medium text-zinc-500">Previsto término</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">{formatHourMinute(runMeta.plannedEndAt) ?? "--:--"}</span>
            <span className="font-medium text-zinc-500">Término atual</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">{formatHourMinute(runMeta.actualEndAt) ?? "--:--"}</span>
            <span className="font-medium text-zinc-500">Atualizado</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">{formatHourMinute(runMeta.lastUpdatedAt) ?? "--:--"}</span>
            <span className="font-medium text-zinc-500">Atualização</span>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              <input className="sr-only" type="checkbox" checked={autoRefresh} onChange={(event) => onToggleAutoRefresh(event.target.checked)} />
              <span className={`h-3 w-6 rounded-full ${autoRefresh ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"}`} />
              Autoatualizar
            </label>
          </div>
        </PanelSection>

        <PanelSection title="Falhas recentes">
          {failedTasks.length === 0 ? (
            <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">Nenhuma falha nesta rodada.</div>
          ) : (
            <div className="space-y-1">
              {failedTasks.slice(0, 5).map((task) => <FailureItem key={task.id} task={task} onSelect={onSelectTask} />)}
              <button type="button" className="w-full pt-1 text-right text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">Ver todas as falhas</button>
            </div>
          )}
        </PanelSection>

        <PanelSection title="Impacto operacional">
          <div className={`rounded-md border px-3 py-3 text-sm ${impactClass}`}>
            <div className="flex items-start gap-2 font-semibold">
              <span className="icon-[lucide--triangle-alert] mt-0.5 size-4 shrink-0" />
              <span>{impact.title}</span>
            </div>
            <ul className="mt-2 space-y-1 pl-6 text-sm">
              {impact.items.map((item) => <li key={item} className="list-disc">{item}</li>)}
            </ul>
          </div>
        </PanelSection>

      </div>
    </aside>
  );
}

export default function PertGraph({ groups, ecflowRoot, runMeta, selectedTaskId, onSelectTask }: PertGraphProps) {
  const graph = useMemo(() => buildPertGraphFromGroups(groups, runMeta), [groups, runMeta]);
  const treeSummary = useMemo(() => buildTreeSummary(ecflowRoot), [ecflowRoot]);
  const completed = treeSummary.byStatus.completed;
  const running = treeSummary.byStatus.in_progress;
  const waiting = treeSummary.byStatus.pending;
  const failures = treeSummary.failedTaskIds.length;
  const total = treeSummary.total;
  const elapsed = formatElapsed(runMeta.actualStartAt ?? runMeta.plannedStartAt, runMeta.actualEndAt);
 
     return (
       <div className="flex min-h-0 flex-1 flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-900 dark:text-zinc-50">
         <div data-testid="pert-kpis" className="grid gap-4 p-4 xl:grid-cols-[repeat(6,minmax(135px,1fr))]">
           <HeaderMetric icon="icon-[lucide--gauge]" label="Progresso geral" value={`${treeSummary.successRate}%`} detail={`${completed} / ${total} tasks`} color="#2563eb" />
           <HeaderMetric icon="icon-[lucide--check-circle-2]" label="Sucesso" value={String(completed)} detail={`${percentOf(completed, total)}%`} color="#22c55e" />
           <HeaderMetric icon="icon-[lucide--play-circle]" label="Executando" value={String(running)} detail={`${percentOf(running, total)}%`} color="#2563eb" />
           <HeaderMetric icon="icon-[lucide--hourglass]" label="Aguardando" value={String(waiting)} detail={`${percentOf(waiting, total)}%`} color="#94a3b8" />
           <HeaderMetric icon="icon-[lucide--x-circle]" label="Falhas" value={String(failures)} detail={`${percentOf(failures, total)}%`} color="#ef4444" />
           <HeaderMetric icon="icon-[lucide--timer]" label="Tempo decorrido" value={elapsed} detail={`Início: ${formatHourMinute(runMeta.actualStartAt ?? runMeta.plannedStartAt) ?? "--:--"}`} color="#64748b" />
         </div>

      <div className="min-h-0 flex flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <PertCanvas graph={graph} ecflowRoot={ecflowRoot} selectedTaskId={selectedTaskId} onSelectTask={onSelectTask} />
        </div>
      </div>
    </div>
  );
}

