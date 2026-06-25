"use client";

import { useEffect, useMemo, useState } from "react";

import type { EcflowKafkaNode } from "@silo/engine/dataflow/ecflow-kafka";
import { clampProgress, normalizeProductStatus } from "@silo/engine/dataflow/helpers";
import type { PertGraph } from "@silo/engine/dataflow/pert-types";
import { getStatusLabel, type ProductStatus } from "@silo/engine/domain/product-status";

import { FAILURE_STATUSES, STATUS_STYLE } from "../status-style";
import { formatHourMinute } from "./time-format";
import Button from "@/components/ui/button";
import Select from "@/components/ui/select";
import Accordion, { type Section } from "@/components/ui/accordion";

const INDENT_WIDTH = 22;
const ROW_HEIGHT = 48;
const ROOT_ROW_HEIGHT = 52;
const TABLE_MIN_WIDTH = 1440;
const DEPENDENCY_BADGE_MAX_WIDTH = 220;
const INSPECTOR_WIDTH = 420;
const GRID_COLUMNS = "minmax(360px,1.65fr) 130px 170px 104px 96px 96px 110px minmax(260px,1fr) 120px";

type TreeKind = "suite" | "family" | "task";
type RelationKind = "dependency" | "trigger" | "combined";

interface TreeRow {
  id: string;
  key: string;
  parentId: string | null;
  path: string;
  kind: TreeKind;
  name: string;
  depth: number;
  status: ProductStatus;
  progress: number;
  durationLabel: string;
  startLabel: string;
  endLabel: string;
  delayLabel: string;
  isDelayed: boolean;
  dependencyLabels: string[];
  dependencyRefs: string[];
  triggerLabel: string | null;
  triggerRef: string | null;
  attributes: string[];
  hasChildren: boolean;
  lineageLastFlags: boolean[];
  flowLabel: string;
}

interface DependencyRelation {
  id: string;
  label: string;
  ref: string;
  kind: RelationKind;
  source: TreeRow | null;
  target: TreeRow;
}

interface PertCanvasProps {
  graph: PertGraph;
  ecflowRoot: EcflowKafkaNode;
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
}

function readText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function readChildren(node: EcflowKafkaNode): EcflowKafkaNode[] {
  const tasks = Array.isArray(node.tasks) ? node.tasks : [];
  const groups = Array.isArray(node.groups) ? node.groups : [];
  return [...tasks, ...groups];
}

function resolveKind(node: EcflowKafkaNode): TreeKind {
  const kind = readText(node.kind)?.toLowerCase();
  if (kind === "suite") return "suite";
  if (kind === "task") return "task";
  return "family";
}

function normalizeName(value: string): string {
  return value.replace(/_/g, " ");
}

function formatAttribute(value: string): string {
  const time = value.match(/^time=(\d{2}:\d{2})$/i)?.[1];
  if (time) return `time=${time}`;
  return value;
}

function dependencyName(value: string): string {
  return normalizeName(value.split("/").filter(Boolean).at(-1) ?? value);
}

function relationLabel(value: string): string {
  return value.includes("/") ? dependencyName(value) : normalizeName(value);
}

function formatTreePath(value: string): string {
  return value
    .split("/")
    .filter(Boolean)
    .map(normalizeName)
    .join(" / ");
}

function compactFlowLabel(value: string): string {
  const label = value
    .replace(/_\d{4}-\d{2}-\d{2}$/g, "")
    .replace(/^SMNA[_/-]?/i, "")
    .replace(/analysis_cycle/i, "ANALYSIS")
    .replace(/forecast_cycle/i, "FORECAST")
    .replace(/_/g, " ")
    .trim();

  return (label || value).slice(0, 12).toUpperCase();
}

function normalizeReference(value: string): string {
  return value
    .trim()
    .replace(/^trigger\s+/i, "")
    .replace(/\s+(?:eq|==|=)\s+.*$/i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}

function extractTriggerReference(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/trigger\s+(.+?)\s+(?:eq|==|=)\s+/i);
  return match?.[1]?.trim() ?? null;
}

function formatDurationFromDates(start?: string | null, end?: string | null, referenceMinutes?: number | null): string {
  const startMs = start ? Date.parse(start) : NaN;
  const endMs = end ? Date.parse(end) : NaN;
  const seconds = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs
    ? Math.round((endMs - startMs) / 1000)
    : null;

  if (seconds !== null) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  if (typeof referenceMinutes === "number" && Number.isFinite(referenceMinutes) && referenceMinutes > 0) {
    const totalSeconds = Math.round(referenceMinutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return "--";
}

function formatDelayFromDates(plannedEnd?: string | null, finishedAt?: string | null): { label: string; isDelayed: boolean } {
  const plannedMs = plannedEnd ? Date.parse(plannedEnd) : NaN;
  if (!Number.isFinite(plannedMs)) return { label: "--", isDelayed: false };

  const referenceMs = finishedAt ? Date.parse(finishedAt) : Date.now();
  if (!Number.isFinite(referenceMs) || referenceMs <= plannedMs) {
    return { label: "No prazo", isDelayed: false };
  }

  const diffMinutes = Math.round((referenceMs - plannedMs) / 60000);
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  const label = hours > 0 ? `+${hours}h ${String(minutes).padStart(2, "0")}m` : `+${diffMinutes}m`;
  return { label, isDelayed: true };
}

function aggregateStatus(kind: TreeKind, explicitStatus: ProductStatus, children: TreeRow[]): ProductStatus {
  if (children.length === 0) return explicitStatus;
  const statuses = children.map((child) => child.status);

  if (statuses.some((status) => FAILURE_STATUSES.has(status))) return "with_problems";
  if (statuses.some((status) => status === "in_progress")) return "in_progress";
  if (statuses.length > 0 && statuses.every((status) => status === "completed")) return "completed";
  if (kind !== "suite" && statuses.some((status) => status === "completed")) return "in_progress";

  return explicitStatus;
}

function aggregateProgress(node: EcflowKafkaNode, status: ProductStatus, children: TreeRow[]): number {
  if (children.length > 0) {
    return Math.round(children.reduce((sum, child) => sum + child.progress, 0) / children.length);
  }

  if (status === "pending" && !node.startedAt && !node.finishedAt) return 0;
  return clampProgress(node.progress, status);
}

function buildTreeRow(
  node: EcflowKafkaNode,
  depth: number,
  lineageLastFlags: boolean[],
  index: number,
  siblingCount: number,
  parentId: string | null,
  parentPath: string,
): TreeRow[] {
  const kind = resolveKind(node);
  const children = readChildren(node);
  const name = readText(node.name) ?? readText(node.id) ?? kind;
  const id = readText(node.id) ?? `${name}-${depth}-${index}`;
  const path = `${parentPath}/${name}`.replace(/\/+/g, "/");
  const nestedRows = children.flatMap((child, childIndex) => buildTreeRow(child, depth + 1, [...lineageLastFlags, childIndex === children.length - 1], childIndex, children.length, id, path));
  const directChildren = nestedRows.filter((row) => row.parentId === id);
  const explicitStatus = normalizeProductStatus(node.state ?? node.status ?? node.node_state, node.default_state);
  const status = aggregateStatus(kind, explicitStatus, directChildren);
  const progress = aggregateProgress(node, status, directChildren);
  const dependencyRefs = Array.isArray(node.dependencies) ? node.dependencies.map((dependency) => readText(dependency)).filter((dependency): dependency is string => Boolean(dependency)) : [];
  const dependencies = dependencyRefs.map(dependencyName);
  const trigger = readText(node.triggerExpression);
  const triggerRef = extractTriggerReference(trigger);
  const attributes = Array.isArray(node.attributes) ? node.attributes.map(formatAttribute) : [];
  const delayInfo = formatDelayFromDates(node.plannedEndAt, node.finishedAt);
  const row: TreeRow = {
    id,
    key: `${id}-${depth}-${index}`,
    parentId,
    path,
    kind,
    name,
    depth,
    status,
    progress,
    durationLabel: formatDurationFromDates(node.startedAt, node.finishedAt, node.referenceDurationMinutes),
    startLabel: formatHourMinute(node.startedAt ?? node.plannedStartAt) ?? "--",
    endLabel: formatHourMinute(node.finishedAt ?? node.plannedEndAt) ?? "--",
    delayLabel: delayInfo.label,
    isDelayed: delayInfo.isDelayed,
    dependencyLabels: dependencies,
    dependencyRefs,
    triggerLabel: trigger,
    triggerRef,
    attributes,
    hasChildren: children.length > 0,
    lineageLastFlags: depth === 0 ? [] : [...lineageLastFlags.slice(0, -1), index === siblingCount - 1],
    flowLabel: compactFlowLabel(name),
  };

  return [row, ...nestedRows];
}

function buildFallbackRows(graph: PertGraph): TreeRow[] {
  const root: TreeRow = {
    id: "fallback-root",
    key: "fallback-root",
    parentId: null,
    path: "/fallback-root",
    kind: "suite",
    name: graph.runMeta.productLabel || "Fluxo de dados",
    depth: 0,
    status: graph.summary.failedTaskIds.length > 0 ? "with_problems" : graph.summary.byStatus.in_progress > 0 ? "in_progress" : "pending",
    progress: graph.summary.successRate,
    durationLabel: "--",
    startLabel: formatHourMinute(graph.runMeta.actualStartAt ?? graph.runMeta.plannedStartAt) ?? "--",
    endLabel: formatHourMinute(graph.runMeta.actualEndAt ?? graph.runMeta.plannedEndAt) ?? "--",
    delayLabel: "--",
    isDelayed: false,
    dependencyLabels: [],
    dependencyRefs: [],
    triggerLabel: null,
    triggerRef: null,
    attributes: [],
    hasChildren: graph.nodes.length > 0,
    lineageLastFlags: [],
    flowLabel: compactFlowLabel(graph.runMeta.productLabel || "Fluxo de dados"),
  };

  const tasks = graph.nodes.map((task, index): TreeRow => {
    const delayInfo = formatDelayFromDates(task.plannedEndAt, task.finishedAt);
    return {
      id: task.id,
      key: `fallback-${task.id}`,
      parentId: root.id,
      path: `/fallback-root/${task.name}`,
      kind: "task",
      name: task.name,
      depth: 1,
      status: task.status,
      progress: task.progress,
      durationLabel: formatDurationFromDates(task.startedAt, task.finishedAt, task.durationMinutes),
      startLabel: formatHourMinute(task.startedAt ?? task.plannedStartAt) ?? "--",
      endLabel: formatHourMinute(task.finishedAt ?? task.plannedEndAt) ?? "--",
      delayLabel: delayInfo.label,
      isDelayed: delayInfo.isDelayed,
      dependencyLabels: task.dependencies,
      dependencyRefs: task.dependencies,
      triggerLabel: null,
      triggerRef: null,
      attributes: [],
      hasChildren: false,
      lineageLastFlags: [index === graph.nodes.length - 1],
      flowLabel: compactFlowLabel(task.name),
    };
  });

  return [root, ...tasks];
}

function filterRows(rows: TreeRow[], query: string, statusFilter: ProductStatus | "all"): TreeRow[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery && statusFilter === "all") return rows;

  const descendantMatches = new Set<string>();
  const matchedIds = new Set<string>();

  for (const row of rows) {
    const matchesStatus = statusFilter === "all" || row.status === statusFilter;
    const queryTarget = `${row.name} ${row.attributes.join(" ")} ${row.dependencyLabels.join(" ")} ${row.triggerLabel ?? ""}`.toLowerCase();
    const matchesQuery = !normalizedQuery || queryTarget.includes(normalizedQuery);
    if (matchesStatus && matchesQuery) {
      matchedIds.add(row.id);
      descendantMatches.add(row.id);

      for (let index = rows.indexOf(row) - 1; index >= 0; index -= 1) {
        const candidate = rows[index];
        if (candidate.depth < row.depth) {
          descendantMatches.add(candidate.id);
          if (candidate.depth === 0) break;
        }
      }
    }
  }

  return rows.filter((row) => matchedIds.has(row.id) || descendantMatches.has(row.id));
}

function applyExpandedRows(rows: TreeRow[], expandedIds: ReadonlySet<string>, query: string): TreeRow[] {
  if (query.trim()) return rows;

  const rowById = new Map(rows.map((row) => [row.id, row]));
  return rows.filter((row) => {
    let parentId = row.parentId;
    while (parentId) {
      if (!expandedIds.has(parentId)) return false;
      parentId = rowById.get(parentId)?.parentId ?? null;
    }
    return true;
  });
}

function buildInitialExpandedRows(rows: TreeRow[]): Set<string> {
  return new Set(rows.filter((row) => row.hasChildren).map((row) => row.id));
}

function buildReferenceMap(rows: TreeRow[]): Map<string, TreeRow> {
  const references = new Map<string, TreeRow>();
  for (const row of rows) {
    references.set(normalizeReference(row.path), row);
    references.set(normalizeReference(row.id), row);
    references.set(normalizeReference(row.name), row);
  }
  return references;
}

function buildDependencyRelations(row: TreeRow, references: Map<string, TreeRow>): DependencyRelation[] {
  const relations = new Map<string, DependencyRelation>();

  function upsertRelation(ref: string, label: string, kind: Exclude<RelationKind, "combined">) {
    const normalizedRef = normalizeReference(ref);
    if (!normalizedRef) return;

    const existing = relations.get(normalizedRef);
    const source = references.get(normalizedRef) ?? existing?.source ?? null;

    if (existing) {
      relations.set(normalizedRef, {
        ...existing,
        kind: mergeRelationKind(existing.kind, kind),
        source,
      });
      return;
    }

    relations.set(normalizedRef, {
      id: `${row.id}-${kind}-${normalizedRef}`,
      label,
      ref,
      kind,
      source,
      target: row,
    });
  }

  row.dependencyRefs.forEach((ref, index) => {
    upsertRelation(ref, row.dependencyLabels[index] ?? relationLabel(ref), "dependency");
  });

  const triggerReference = row.triggerRef ?? row.triggerLabel?.replace(/^trigger\s+/i, "") ?? null;
  if (triggerReference) {
    upsertRelation(triggerReference, relationLabel(triggerReference), "trigger");
  }

  return [...relations.values()];
}

function mergeRelationKind(current: RelationKind, next: Exclude<RelationKind, "combined">): RelationKind {
  if (current === next || current === "combined") return current;
  return "combined";
}

function relationKindLabel(kind: RelationKind): string {
  if (kind === "trigger") return "Gatilho";
  if (kind === "combined") return "Dependência + gatilho";
  return "Dependência";
}

function relationToneClassName(kind: RelationKind): string {
  if (kind === "trigger") return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300";
  if (kind === "combined") return "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900/60 dark:bg-teal-950/30 dark:text-teal-300";
  return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300";
}

function relationDotClassName(kind: RelationKind): string {
  if (kind === "trigger") return "bg-amber-500";
  if (kind === "combined") return "bg-teal-500";
  return "bg-blue-500";
}

// relationTooltipTitle and relationDescriptor were removed (unused)

function getImpactLevel(row: TreeRow): "ALTO" | "MÉDIO" | "BAIXO" {
  if (FAILURE_STATUSES.has(row.status)) return "ALTO";
  if (row.isDelayed || row.status === "in_progress") return "MÉDIO";
  return "BAIXO";
}

function impactToneClassName(level: "ALTO" | "MÉDIO" | "BAIXO"): string {
  if (level === "ALTO") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (level === "MÉDIO") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
}

type OverviewBucket = {
  id: "success" | "running" | "waiting" | "failed";
  label: string;
  count: number;
  color: string;
  labelClassName: string;
};

function buildOverviewBuckets(rows: TreeRow[]): OverviewBucket[] {
  let success = 0;
  let running = 0;
  let waiting = 0;
  let failed = 0;

  rows.forEach((currentRow) => {
    if (currentRow.kind !== "task") return;

    if (currentRow.status === "completed") {
      success += 1;
      return;
    }

    if (currentRow.status === "in_progress") {
      running += 1;
      return;
    }

    if (FAILURE_STATUSES.has(currentRow.status)) {
      failed += 1;
      return;
    }

    waiting += 1;
  });

  return [
    { id: "success", label: "Sucesso", count: success, color: "#22c55e", labelClassName: "text-emerald-600 dark:text-emerald-300" },
    { id: "running", label: "Executando", count: running, color: "#3b82f6", labelClassName: "text-blue-600 dark:text-blue-300" },
    { id: "waiting", label: "Aguardando", count: waiting, color: "#d4d4d8", labelClassName: "text-zinc-500 dark:text-zinc-400" },
    { id: "failed", label: "Falhas", count: failed, color: "#ef4444", labelClassName: "text-red-600 dark:text-red-300" },
  ];
}

function buildOverviewGradient(buckets: OverviewBucket[], total: number): string {
  if (total <= 0) return "conic-gradient(#d4d4d8 0deg 360deg)";

  let accumulated = 0;
  const segments = buckets
    .filter((bucket) => bucket.count > 0)
    .map((bucket) => {
      const start = (accumulated / total) * 360;
      accumulated += bucket.count;
      const end = (accumulated / total) * 360;
      return `${bucket.color} ${start}deg ${end}deg`;
    });

  return segments.length > 0 ? `conic-gradient(${segments.join(", ")})` : "conic-gradient(#d4d4d8 0deg 360deg)";
}



function OverviewSummaryCard({ rows }: { rows: TreeRow[] }) {
  const buckets = buildOverviewBuckets(rows);
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const ringBackground = buildOverviewGradient(buckets, total);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex shrink-0 items-center justify-center self-center">
          <div className="relative flex size-36 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 shadow-inner dark:border-zinc-700 dark:bg-zinc-950">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                backgroundImage: ringBackground,
                WebkitMaskImage: "radial-gradient(circle, transparent 55%, black 56%)",
                maskImage: "radial-gradient(circle, transparent 55%, black 56%)",
              }}
            />
            <div className="relative z-10 flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white text-center dark:bg-zinc-900">
              <span className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{total}</span>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">tasks</span>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-0.5">
          {buckets.map((bucket) => {
            const percentage = total > 0 ? Math.round((bucket.count / total) * 100) : 0;

            return (
              <div key={bucket.id} className="flex w-full items-center gap-2 py-0.5 text-sm">
                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: bucket.color }} />
                <span className="min-w-0 shrink-0 tabular-nums text-lg font-semibold text-zinc-900 dark:text-zinc-100">{bucket.count}</span>
                <span className={`min-w-0 flex-1 font-medium ${bucket.labelClassName}`}>{bucket.label}</span>
                <span className={`shrink-0 tabular-nums text-sm font-medium ${bucket.labelClassName}`}>{percentage}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
function kindLabel(kind: TreeKind): string {
  if (kind === "suite") return "Suite";
  if (kind === "family") return "Fam\u00edlia";
  return "Task";
}

function familyPath(row: TreeRow): string {
  const segments = row.path.split("/").filter(Boolean);
  if (segments.length <= 1) return "--";
  return segments.slice(0, -1).map(normalizeName).join(" / ");
}

function buildOutgoingRelations(row: TreeRow, rows: TreeRow[], references: Map<string, TreeRow>): DependencyRelation[] {
  const outgoing: DependencyRelation[] = [];

  rows.forEach((candidate) => {
    const candidateRelations = buildDependencyRelations(candidate, references);
    candidateRelations.forEach((relation) => {
      if (relation.source?.id !== row.id) return;
      outgoing.push(relation);
    });
  });

  return outgoing;
}

function FlowInspectorPanel({
  row,
  rows,
  references,
  onClear,
}: {
  row: TreeRow | null;
  rows: TreeRow[];
  references: Map<string, TreeRow>;
  onClear: () => void;
}) {
  if (!row) {
    return (
      <aside className="hidden shrink-0 border-l border-zinc-200 bg-zinc-50/70 xl:flex dark:border-zinc-700 dark:bg-zinc-950/40" style={{ width: INSPECTOR_WIDTH }}>
        <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Clique em um item da tabela para ver o histórico do fluxo.
        </div>
      </aside>
    );
  }

  const incomingRelations = buildDependencyRelations(row, references);
  const outgoingRelations = buildOutgoingRelations(row, rows, references);
  const impactLevel = getImpactLevel(row);
  const impactNotes = outgoingRelations.length > 0
    ? outgoingRelations.slice(0, 3).map((relation) => `${normalizeName(relation.target.name)} pode ser impactado.`)
    : ["Sem impacto relevante mapeado para outros itens."];
  const summarySections: Section[] = [
    {
      id: "resumo-geral",
      title: "Resumo geral",
      chapters: [],
      content: <OverviewSummaryCard rows={rows} />,
    },
  ];
  const detailsSections: Section[] = [
    {
      id: "dados",
      title: "Dados",
      chapters: [],
      content: (
        <>
          <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm font-medium text-zinc-600 dark:text-zinc-300">
                <span>PROGRESSO:</span>
                <span>{row.progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, row.progress))}%` }} />
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">Impacto:</span>
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${impactToneClassName(impactLevel)}`}>{impactLevel}</span>
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">Tipo:</span><span className="font-medium text-zinc-800 dark:text-zinc-200">{kindLabel(row.kind)}</span>
              <span className="text-zinc-500 dark:text-zinc-400">Família:</span><span className="font-medium text-zinc-800 dark:text-zinc-200">{familyPath(row)}</span>
              <span className="text-zinc-500 dark:text-zinc-400">ID:</span><span className="font-medium text-zinc-800 dark:text-zinc-200">{row.id}</span>
              <span className="text-zinc-500 dark:text-zinc-400">Início:</span><span className="font-medium text-zinc-800 dark:text-zinc-200">{row.startLabel}</span>
              <span className="text-zinc-500 dark:text-zinc-400">Fim:</span><span className="font-medium text-zinc-800 dark:text-zinc-200">{row.endLabel}</span>
              <span className="text-zinc-500 dark:text-zinc-400">Duração:</span><span className="font-medium text-zinc-800 dark:text-zinc-200">{row.durationLabel}</span>
              <span className="text-zinc-500 dark:text-zinc-400">Trigger:</span><span className="font-medium text-zinc-800 dark:text-zinc-200">{row.triggerLabel ?? "--"}</span>
            </div>
          </div>
        </>
      ),
    },
    {
      id: "fluxo",
      title: "Fluxo de dados",
      chapters: [],
      content: (
        <>
          <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">DE ONDE VEM (INPUT)</div>
            <div className="space-y-2">
              {incomingRelations.length === 0 ? <p className="text-base text-zinc-500 dark:text-zinc-400">Sem origem mapeada.</p> : null}
              {incomingRelations.map((relation) => (
                <div key={`incoming-${relation.id}`} className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950/60">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{relation.source ? normalizeName(relation.source.name) : normalizeName(relation.ref)}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${relationToneClassName(relation.kind)}`}>{relationKindLabel(relation.kind)}</span>
                  </div>
                  <p className="mt-1 text-zinc-500 dark:text-zinc-400">{relation.source ? formatTreePath(relation.source.path) : formatTreePath(relation.ref) || normalizeName(relation.ref)}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">PARA ONDE VAI (OUTPUT)</div>
            <div className="space-y-2">
              {outgoingRelations.length === 0 ? <p className="text-base text-zinc-500 dark:text-zinc-400">Sem destino mapeado.</p> : null}
              {outgoingRelations.map((relation) => (
                <div key={`outgoing-${relation.id}`} className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950/60">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{normalizeName(relation.target.name)}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${relationToneClassName(relation.kind)}`}>{relationKindLabel(relation.kind)}</span>
                  </div>
                  <p className="mt-1 text-zinc-500 dark:text-zinc-400">{formatTreePath(relation.target.path)}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      ),
    },
    {
      id: "impacto",
      title: "Impacto",
      chapters: [],
      content: (
        <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-200">Se falhar ou atrasar</div>
          <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
            {impactNotes.map((note) => (
              <li key={note} className="flex items-start gap-2">
                <span className="icon-[lucide--triangle-alert] mt-0.5 size-4 text-amber-500" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      ),
    },
  ];

  return (
    <aside className="hidden shrink-0 border-l border-zinc-200 bg-zinc-50/70 xl:flex dark:border-zinc-700 dark:bg-zinc-950/40" style={{ width: INSPECTOR_WIDTH }}>
      <div className="flex h-full w-full flex-col">
        <div className="border-b border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between px-4 py-1.5 bg-zinc-50 dark:bg-zinc-800">
            <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">Detalhes do item selecionado</h2>
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              onClick={onClear}
              aria-label="Fechar detalhes"
            >
              <span className="icon-[lucide--x] size-4" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-t border-zinc-200 dark:border-zinc-700">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`${statusIcon(row.status)} size-5`} style={{ color: STATUS_STYLE[row.status].fill }} />
                <span className="truncate text-base font-medium text-zinc-900 dark:text-zinc-100">{normalizeName(row.name)}</span>
              </div>
            </div>
            <span className={`rounded px-2 py-1 text-xs whitespace-nowrap uppercase font-semibold ${STATUS_STYLE[row.status].chipClass}`}>{getStatusLabel(row.status)}</span>
          </div>
        </div>

        <div className="min-h-0 flex flex-col gap-4 flex-1 overflow-auto px-4 py-4 text-base">
          <Accordion
            key={`summary-${row.id}-closed`}
            sections={summarySections}
            defaultOpenSections={[]}
          />
          <Accordion
            key={`details-${row.id}`}
            sections={detailsSections}
            allowMultiple
            defaultOpenAll
          />
        </div>
      </div>
    </aside>
  );
}

function DependencyBadge({ relation }: { relation: DependencyRelation }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-sm font-medium shadow-sm transition-colors ${relationToneClassName(relation.kind)}`}
      style={{ maxWidth: DEPENDENCY_BADGE_MAX_WIDTH }}
      title={`${relationKindLabel(relation.kind)}: ${relation.ref}`}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${relationDotClassName(relation.kind)}`} />
      <span className="truncate">{relation.label}</span>
    </span>
  );
}

function statusIcon(status: ProductStatus): string {
  if (status === "completed") return "icon-[lucide--check-circle-2]";
  if (status === "in_progress") return "icon-[lucide--play-circle]";
  if (FAILURE_STATUSES.has(status)) return "icon-[lucide--x-circle]";
  return "icon-[lucide--circle]";
}

function nodeIcon(row: TreeRow): string {
  if (row.kind === "task") return statusIcon(row.status);
  if (row.kind === "suite") return "icon-[lucide--folder-tree]";
  return "icon-[lucide--folder-check]";
}

function TreeGuides({ row }: { row: TreeRow }) {
  // Marca o parâmetro como usado para evitar aviso de variável não utilizada
  void row;
  return null;
}

function ImpactChip({ row }: { row: TreeRow }) {
  const impactLevel = getImpactLevel(row);
  return <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${impactToneClassName(impactLevel)}`}>{impactLevel}</span>;
}

function StatusChip({ status }: { status: ProductStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-semibold uppercase whitespace-nowrap ${style.chipClass}`}>
      {getStatusLabel(status)}
    </span>
  );
}

function ProgressBar({ value, status }: { value: number; status: ProductStatus }) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  const fill = STATUS_STYLE[status].fill;
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${percent}%`, backgroundColor: fill }} />
      </div>
      <span className="w-10 text-right text-base font-medium tabular-nums text-zinc-700 dark:text-zinc-300">{percent}%</span>
    </div>
  );
}

function DependencyCell({
  row,
  references,
}: {
  row: TreeRow;
  references: Map<string, TreeRow>;
}) {
  const relations = buildDependencyRelations(row, references);

  if (relations.length === 0) return <span className="text-sm text-zinc-500 dark:text-zinc-400">--</span>;

  return (
    <div className="flex min-w-0 flex-wrap gap-1.5 py-1">
      {relations.map((relation) => <DependencyBadge key={relation.id} relation={relation} />)}
    </div>
  );
}

function TreeRowLine({
  row,
  selectedTaskId,
  expanded,
  references,
  activeFlowRowId,
  onSelectRow,
  onToggleExpanded,
  onSelectTask,
}: {
  row: TreeRow;
  selectedTaskId: string | null;
  expanded: boolean;
  references: Map<string, TreeRow>;
  activeFlowRowId: string | null;
  onSelectRow: (row: TreeRow) => void;
  onToggleExpanded: (id: string) => void;
  onSelectTask: (id: string) => void;
}) {
  const selected = row.id === activeFlowRowId || (row.kind === "task" && row.id === selectedTaskId);
  const statusStyle = STATUS_STYLE[row.status];
  const content = (
    <>
      <div className="relative flex min-w-0 items-center gap-2 px-4" style={{ paddingLeft: 16 + row.depth * INDENT_WIDTH, minHeight: row.depth === 0 ? ROOT_ROW_HEIGHT : ROW_HEIGHT }}>
        <TreeGuides row={row} />
        {row.hasChildren ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpanded(row.id);
            }}
            className="relative z-10 flex size-5 shrink-0 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label={expanded ? `Recolher ${row.name}` : `Expandir ${row.name}`}
          >
            <span className={`${expanded ? "icon-[lucide--minus-square]" : "icon-[lucide--plus-square]"} size-4`} />
          </button>
        ) : (
          <span className="relative z-10 size-5 shrink-0" />
        )}
        <span className={`${nodeIcon(row)} relative z-10 size-5 shrink-0`} style={{ color: statusStyle.fill }} />
        <div className="relative z-10 min-w-0">
          <div className={`${row.depth <= 1 ? "font-semibold" : "font-medium"} truncate text-base text-zinc-900 dark:text-zinc-100`}>{normalizeName(row.name)}</div>
          {row.attributes.length > 0 ? <div className="truncate text-sm text-zinc-500 dark:text-zinc-400">{row.attributes.join(" · ")}</div> : null}
        </div>
      </div>
      <div className="px-3"><StatusChip status={row.status} /></div>
      <div className="px-3"><ProgressBar value={row.progress} status={row.status} /></div>
      <div className="px-3 text-base font-medium tabular-nums text-zinc-700 dark:text-zinc-300">{row.durationLabel}</div>
      <div className="px-3 text-base font-medium tabular-nums text-zinc-700 dark:text-zinc-300">{row.startLabel}</div>
      <div className="px-3 text-base font-medium tabular-nums text-zinc-700 dark:text-zinc-300">{row.endLabel}</div>
      <div className={`px-3 text-base font-semibold tabular-nums ${row.isDelayed ? "text-red-600 dark:text-red-300" : "text-zinc-700 dark:text-zinc-300"}`}>{row.delayLabel}</div>
      <div className="min-w-0 px-3">
        <DependencyCell row={row} references={references} />
      </div>
      <div className="px-3"><ImpactChip row={row} /></div>
    </>
  );

  const className = `relative grid w-full cursor-pointer items-center border-b border-zinc-200 text-left transition dark:border-zinc-700 ${selected ? "bg-blue-50/80 dark:bg-blue-950/30" : row.depth === 0 ? "bg-zinc-50 dark:bg-zinc-800/60" : "bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/60"}`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        onSelectRow(row);
        if (row.kind === "task") onSelectTask(row.id);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelectRow(row);
        if (row.kind === "task") onSelectTask(row.id);
      }}
      className={className}
      style={{ gridTemplateColumns: GRID_COLUMNS, minHeight: row.depth === 0 ? ROOT_ROW_HEIGHT : ROW_HEIGHT }}
    >
      {content}
    </div>
  );
}

export function PertCanvas({ graph, ecflowRoot, selectedTaskId, onSelectTask }: PertCanvasProps) {
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [activeFlowRowId, setActiveFlowRowId] = useState<string | null>(null);
  const [lastUpdateAt, setLastUpdateAt] = useState<number>(() => {
    const parsed = Date.parse(graph.runMeta.lastUpdatedAt ?? "");
    return Number.isFinite(parsed) ? parsed : Date.now();
  });
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const rows = useMemo(() => {
    const treeRows = buildTreeRow(ecflowRoot, 0, [], 0, 1, null, "");
    return treeRows.length > 0 ? treeRows : buildFallbackRows(graph);
  }, [ecflowRoot, graph]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => buildInitialExpandedRows(rows));
  const references = useMemo(() => buildReferenceMap(rows), [rows]);
  const activeFlowRow = useMemo(
    () => rows.find((row) => row.id === activeFlowRowId) ?? null,
    [rows, activeFlowRowId],
  );

  const visibleRows = useMemo(() => applyExpandedRows(filterRows(rows, query, statusFilter), expandedIds, query), [rows, expandedIds, query, statusFilter]);

  useEffect(() => {
    if (!activeFlowRowId) return;
    const exists = rows.some((row) => row.id === activeFlowRowId);
    if (!exists) setActiveFlowRowId(null);
  }, [activeFlowRowId, rows]);

  useEffect(() => {
    const parsed = Date.parse(graph.runMeta.lastUpdatedAt ?? "");
    setLastUpdateAt(Number.isFinite(parsed) ? parsed : Date.now());
  }, [graph.runMeta.lastUpdatedAt]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      if (now - lastUpdateAt >= 60000) {
        setLastUpdateAt(now);
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [lastUpdateAt]);

  const secondsUntilRefresh = Math.max(0, 60 - Math.floor((nowMs - lastUpdateAt) / 1000));
  const countdownLabel = `00:${String(secondsUntilRefresh).padStart(2, "0")}`;
  const lastUpdateLabel = formatHourMinute(new Date(lastUpdateAt).toISOString()) ?? "--:--";

  function toggleExpanded(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allExpanded = rows.filter((row) => row.hasChildren).every((row) => expandedIds.has(row.id));

  function toggleExpandAllRows() {
    if (allExpanded) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(buildInitialExpandedRows(rows));
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border-t border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900" data-testid="pert-flow-canvas">
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
        <label className="relative min-w-64 flex-1 md:flex-none">
          <span className="icon-[lucide--search] pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-3 text-base text-zinc-700 outline-none transition placeholder:text-zinc-400 focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            placeholder="Buscar task ou família..."
          />
        </label>
        <div className="w-44">
          <Select
            name="status-filter"
            selected={statusFilter}
            options={[
              { value: "all", label: "Todos" },
              { value: "completed", label: "Concluído" },
              { value: "in_progress", label: "Em execução" },
              { value: "pending", label: "Pendente" },
              { value: "with_problems", label: "Com problemas" },
              { value: "suspended", label: "Suspenso" },
            ]}
            onChange={(value) => setStatusFilter(value as ProductStatus | "all")}
            buttonClassName="h-10 py-0 pl-3 pr-10"
            noTruncate
          />
        </div>
        <Button
          type="button"
          style="bordered"
          className="h-10 w-10 px-0 py-0"
          icon="icon-[lucide--folder-tree]"
          title={allExpanded ? "Recolher tudo" : "Expandir tudo"}
          aria-label={allExpanded ? "Recolher tudo" : "Expandir tudo"}
          onClick={toggleExpandAllRows}
        />
        <div className="ml-auto flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
          <span>Últ. {lastUpdateLabel}</span>
          <span className="text-zinc-400">•</span>
          <span>Próx. {countdownLabel}</span>
          <button
            type="button"
            onClick={() => {
              setLastUpdateAt(Date.now());
              setNowMs(Date.now());
            }}
            className="inline-flex size-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Atualizar"
            title="Atualizar"
          >
            <span className="icon-[lucide--refresh-cw] size-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex flex-1 overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto">
          <div style={{ minWidth: TABLE_MIN_WIDTH }}>
            <div
              className="sticky top-0 z-20 grid border-b border-zinc-200 bg-zinc-50 text-sm font-medium uppercase tracking-wider text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
              style={{ gridTemplateColumns: GRID_COLUMNS }}
            >
              <div className="px-4 py-3">Nome</div>
              <div className="px-3 py-3">Status</div>
              <div className="px-3 py-3">Progresso</div>
              <div className="px-3 py-3">Duração</div>
              <div className="px-3 py-3">Início</div>
              <div className="px-3 py-3">Fim</div>
              <div className="px-3 py-3">Atraso</div>
              <div className="px-3 py-3">Dependências / Gatilhos</div>
              <div className="px-3 py-3">Impacto</div>
            </div>

            <div className="bg-white dark:bg-zinc-900">
              {visibleRows.map((row) => (
                <TreeRowLine
                  key={row.key}
                  row={row}
                  selectedTaskId={selectedTaskId}
                  expanded={expandedIds.has(row.id)}
                  references={references}
                  activeFlowRowId={activeFlowRowId}
                  onSelectRow={(selectedRow) => setActiveFlowRowId(selectedRow.id)}
                  onToggleExpanded={toggleExpanded}
                  onSelectTask={onSelectTask}
                />
              ))}
            </div>
          </div>
        </div>

        {activeFlowRow ? (
          <FlowInspectorPanel
            row={activeFlowRow}
            rows={rows}
            references={references}
            onClear={() => setActiveFlowRowId(null)}
          />
        ) : null}
      </div>
    </section>
  );
}





