"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useSearchParams } from "next/navigation";

import type { PertRunMeta } from "@silo/engine/dataflow/pert-types";
import {
  FALLBACK_ECFLOW_TREE_ROOT,
  selectDataFlowSnapshotFromPipelines,
  useDataFlowPipelines,
} from "@/lib/dataflow/mock-ecflow";

const PertGraph = dynamic(
  () => import("@/components/admin/data-flow/pert/pert-graph"),
  { ssr: false },
);

export default function ProductDataFlowPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const modelSlug = String(params?.slug ?? "").trim();
  const selectedDate = searchParams.get("date");
  const selectedTurn = searchParams.get("turn");

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const { pipelines, loading } = useDataFlowPipelines(modelSlug);

  const activeSnapshot = useMemo(
    () => selectDataFlowSnapshotFromPipelines(pipelines, selectedDate, selectedTurn),
    [pipelines, selectedDate, selectedTurn],
  );

  const groups = useMemo(() => activeSnapshot?.groups ?? [], [activeSnapshot]);

  const runMeta: PertRunMeta = useMemo(() => {
    const date = activeSnapshot?.date ?? selectedDate ?? "";
    const turn = activeSnapshot?.turn ?? selectedTurn ?? "";
    const allStarts = groups.flatMap((g) => g.tasks.map((t) => Date.parse(t.start))).filter(Number.isFinite);
    const allEnds = groups.flatMap((g) => g.tasks.map((t) => Date.parse(t.end))).filter(Number.isFinite);
    const allFinished = groups
      .flatMap((g) => g.tasks.map((t) => (t.finishedAt ? Date.parse(t.finishedAt) : NaN)))
      .filter(Number.isFinite);
    const allStarted = groups
      .flatMap((g) => g.tasks.map((t) => (t.startedAt ? Date.parse(t.startedAt) : NaN)))
      .filter(Number.isFinite);
    return {
      productSlug: modelSlug,
      productLabel: (activeSnapshot?.model ?? modelSlug).replace(/[-_]/g, " ").toUpperCase(),
      date,
      turn,
      runLabel: `${date}${turn ? ` · ${turn.padStart(2, "0")}Z` : ""}`,

      plannedStartAt: allStarts.length > 0 ? new Date(Math.min(...allStarts)).toISOString() : null,
      plannedEndAt: allEnds.length > 0 ? new Date(Math.max(...allEnds)).toISOString() : null,
      actualStartAt: allStarted.length > 0 ? new Date(Math.min(...allStarted)).toISOString() : null,
      actualEndAt: allFinished.length > 0 ? new Date(Math.max(...allFinished)).toISOString() : null,
      lastUpdatedAt: new Date().toISOString(),
    };
  }, [activeSnapshot, groups, modelSlug, selectedDate, selectedTurn]);

  useEffect(() => {
    const allTasks = groups.flatMap((group) => group.tasks);
    if (allTasks.length === 0) {
      if (selectedTaskId !== null) setSelectedTaskId(null);
      return;
    }

    if (selectedTaskId && allTasks.some((task) => task.id === selectedTaskId)) {
      return;
    }

    const nextSelectedTask = allTasks.find((task) => task.status === "in_progress")
      ?? allTasks.find((task) => task.status === "with_problems")
      ?? allTasks.find((task) => task.status === "pending")
      ?? allTasks[0];

    setSelectedTaskId(nextSelectedTask?.id ?? null);
  }, [groups, selectedTaskId]);

  if (loading && pipelines.length === 0) {
    return (
      <div className="flex h-[calc(100dvh-140px)] min-h-0 w-full items-start rounded-lg border border-zinc-200 bg-white p-4 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
        Carregando fluxo de dados...
      </div>
    );
  }

  if (!activeSnapshot) {
    return (
      <div className="flex h-[calc(100dvh-140px)] min-h-0 w-full items-start rounded-lg border border-zinc-200 bg-white p-4 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
        Nenhum fluxo fake encontrado para este modelo.
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-140px)] min-h-0 w-full flex-col overflow-hidden">
      <PertGraph
        groups={groups}
        ecflowRoot={FALLBACK_ECFLOW_TREE_ROOT}
        runMeta={runMeta}
        selectedTaskId={selectedTaskId}
        onSelectTask={setSelectedTaskId}
      />
    </div>
  );
}
