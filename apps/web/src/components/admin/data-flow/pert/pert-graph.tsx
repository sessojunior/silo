"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";

import type { EcflowKafkaNode } from "@silo/engine/dataflow/ecflow-kafka";
import { buildPertGraphFromGroups } from "@silo/engine/dataflow/pert-build";
import type { PertRunMeta } from "@silo/engine/dataflow/pert-types";
import type { DataFlowTaskGroup } from "@silo/engine/dataflow/types";
import { normalizeProductStatus } from "@silo/engine/dataflow/helpers";
// getStatusLabel removed — unused in this file
import type { ProductStatus } from "@silo/engine/domain/product-status";

// Removed unused imports from status-style
import { PertCanvas } from "./pert-canvas";
import { formatHourMinute } from "./time-format";

interface PertGraphProps {
  groups: DataFlowTaskGroup[];
  ecflowRoot: EcflowKafkaNode;
  runMeta: PertRunMeta;
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
}

const COMPACT_KPI_BREAKPOINT = 1024;

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
  compact = false,
}: {
  icon: string;
  label: string;
  value: string;
  detail: string;
  color: string;
  compact?: boolean;
}) {
  const cardClassName = compact
    ? "bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 flex min-h-16 items-center gap-2"
    : "bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-3 flex min-h-20 items-center gap-3";
  const iconSizeClass = compact ? "size-6" : "size-8";
  const labelClassName = compact
    ? "text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
    : "text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";
  const valueClassName = compact
    ? "mt-0.5 text-lg font-bold leading-none tracking-tight text-zinc-900 dark:text-zinc-50 whitespace-nowrap"
    : "mt-1 text-2xl font-bold leading-none tracking-tight text-zinc-900 dark:text-zinc-50";
  const detailClassName = compact
    ? "mt-0.5 text-xs text-zinc-500 dark:text-zinc-400"
    : "mt-1 text-sm text-zinc-500 dark:text-zinc-400";

  return (
    <div className={cardClassName}>
      <span className={`${icon} ${iconSizeClass} shrink-0`} style={{ color }} />
      <div className="min-w-0">
        <div className={labelClassName}>{label}</div>
        <div className={valueClassName}>{value}</div>
        <div className={detailClassName}>{detail}</div>
      </div>
    </div>
  );
}


// MetricDot removed (unused)



// Removed unused helper components and functions (PanelSection, RunDonut, FailureItem, impactMessage)

// OperationalSidePanel was removed — it was unused and triggered lint warnings.

export default function PertGraph({ groups, ecflowRoot, runMeta, selectedTaskId, onSelectTask }: PertGraphProps) {
  const graph = useMemo(() => buildPertGraphFromGroups(groups, runMeta), [groups, runMeta]);
  const treeSummary = useMemo(() => buildTreeSummary(ecflowRoot), [ecflowRoot]);
  const kpiContainerRef = useRef<HTMLDivElement | null>(null);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const completed = treeSummary.byStatus.completed;
  const running = treeSummary.byStatus.in_progress;
  const waiting = treeSummary.byStatus.pending;
  const failures = treeSummary.failedTaskIds.length;
  const total = treeSummary.total;
  const elapsed = formatElapsed(runMeta.actualStartAt ?? runMeta.plannedStartAt, runMeta.actualEndAt);

  useLayoutEffect(() => {
    const element = kpiContainerRef.current;
    if (!element) return;

    const checkWidth = () => {
      setIsCompactViewport(element.getBoundingClientRect().width < COMPACT_KPI_BREAKPOINT);
    };

    checkWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", checkWidth);
      return () => window.removeEventListener("resize", checkWidth);
    }

    const observer = new ResizeObserver(() => {
      checkWidth();
    });

    observer.observe(element);
    window.addEventListener("resize", checkWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", checkWidth);
    };
  }, []);

  const kpiCards = [
    {
      icon: "icon-[lucide--gauge]",
      label: "Progresso geral",
      value: `${treeSummary.successRate}%`,
      detail: `${completed} / ${total} tasks`,
      color: "#2563eb",
    },
    {
      icon: "icon-[lucide--check-circle-2]",
      label: "Sucesso",
      value: String(completed),
      detail: `${percentOf(completed, total)}%`,
      color: "#22c55e",
    },
    {
      icon: "icon-[lucide--play-circle]",
      label: "Executando",
      value: String(running),
      detail: `${percentOf(running, total)}%`,
      color: "#2563eb",
    },
    {
      icon: "icon-[lucide--hourglass]",
      label: "Aguardando",
      value: String(waiting),
      detail: `${percentOf(waiting, total)}%`,
      color: "#94a3b8",
    },
    {
      icon: "icon-[lucide--x-circle]",
      label: "Falhas",
      value: String(failures),
      detail: `${percentOf(failures, total)}%`,
      color: "#ef4444",
    },
    {
      icon: "icon-[lucide--timer]",
      label: "Tempo decorrido",
      value: elapsed,
      detail: `Início: ${formatHourMinute(runMeta.actualStartAt ?? runMeta.plannedStartAt) ?? "--:--"}`,
      color: "#64748b",
    },
  ];

  const visibleKpiCards = isCompactViewport && kpiCards.length > 2
    ? [kpiCards[0], kpiCards[kpiCards.length - 1]]
    : kpiCards;

  const kpiGridClassName = isCompactViewport
    ? "grid grid-cols-1 gap-2 p-3 sm:grid-cols-2"
    : "grid gap-4 p-4 xl:grid-cols-[repeat(6,minmax(135px,1fr))]";
 
     return (
       <div className="flex min-h-0 flex-1 flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-900 dark:text-zinc-50">
         <div ref={kpiContainerRef} data-testid="pert-kpis" className={kpiGridClassName}>
           {visibleKpiCards.map((card) => (
             <HeaderMetric
               key={card.label}
               icon={card.icon}
               label={card.label}
               value={card.value}
               detail={card.detail}
               color={card.color}
               compact={isCompactViewport}
             />
           ))}
         </div>

      <div className="min-h-0 flex flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <PertCanvas graph={graph} ecflowRoot={ecflowRoot} selectedTaskId={selectedTaskId} onSelectTask={onSelectTask} />
        </div>
      </div>
    </div>
  );
}

