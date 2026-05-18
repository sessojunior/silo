import type { ProductStatus } from "../domain/product-status";
import { normalizeDataFlowReferenceKey } from "./helpers";
import { applyPertSchedule } from "./pert-compute";
import type {
  PertEdge,
  PertGraph,
  PertLane,
  PertLaneColorToken,
  PertRunMeta,
  PertSummary,
  PertTaskNode,
} from "./pert-types";
import type { DataFlowTaskGroup } from "./types";

const FAILURE_STATUSES: ReadonlySet<ProductStatus> = new Set([
  "with_problems",
  "run_again",
  "not_run",
  "under_support",
  "suspended",
]);

const LANE_COLOR_BY_INDEX: PertLaneColorToken[] = [
  "slate",
  "emerald",
  "sky",
  "amber",
  "violet",
  "fuchsia",
  "rose",
];

// Heurística simples para escolher um ícone-token por nome de grupo. A camada
// de UI traduz o token em um ícone real do iconify.
function pickIconToken(rawName: string): string {
  const name = rawName.toLowerCase();
  if (name.includes("ingest") || name.includes("download") || name.includes("obs")) {
    return "ingestion";
  }
  if (name.includes("pre") || name.includes("qc") || name.includes("bias")) {
    return "preprocess";
  }
  if (name.includes("model") || name.includes("wrf") || name.includes("brams") || name.includes("eta")) {
    return "model";
  }
  if (name.includes("pos") || name.includes("post") || name.includes("ensemble") || name.includes("blend")) {
    return "postprocess";
  }
  if (name.includes("produto") || name.includes("publi") || name.includes("distrib")) {
    return "distribution";
  }
  if (name.includes("verif") || name.includes("control")) {
    return "verification";
  }
  return "generic";
}

function durationFromIso(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return 0;
  return Math.round((endMs - startMs) / 60_000);
}

// Constroi o PertGraph completo a partir do snapshot já achatado em groups[].
// Lanes vêm dos próprios groups; arestas resolvem dependências via reference key.
export function buildPertGraphFromGroups(
  groups: DataFlowTaskGroup[],
  runMeta: PertRunMeta,
): PertGraph {
  const lanes: PertLane[] = groups.map((group, index) => ({
    id: group.id,
    label: group.name,
    colorToken: LANE_COLOR_BY_INDEX[index % LANE_COLOR_BY_INDEX.length],
    iconToken: pickIconToken(group.name),
    taskIds: group.tasks.map((task) => task.id),
  }));

  // Mapa referenceKey → taskId para resolver dependências.
  const taskByRefKey = new Map<string, string>();
  for (const group of groups) {
    for (const task of group.tasks) {
      taskByRefKey.set(normalizeDataFlowReferenceKey(task.id), task.id);
    }
  }

  const taskLane = new Map<string, string>();
  for (const group of groups) {
    for (const task of group.tasks) {
      taskLane.set(task.id, group.id);
    }
  }

  // Estado de falha por task (para marcar isBlocked nos descendentes).
  const failingIds = new Set<string>();
  for (const group of groups) {
    for (const task of group.tasks) {
      if (FAILURE_STATUSES.has(task.status)) failingIds.add(task.id);
    }
  }

  // Pré-cria nodes (campos de PERT preenchidos depois).
  const nodes: PertTaskNode[] = [];
  for (const group of groups) {
    for (const task of group.tasks) {
      const dependencies = task.dependencies
        .map((dep) => taskByRefKey.get(normalizeDataFlowReferenceKey(dep)))
        .filter((id): id is string => Boolean(id));

      const duration = task.referenceDurationMinutes && task.referenceDurationMinutes > 0
        ? Math.round(task.referenceDurationMinutes)
        : durationFromIso(task.start, task.end);

      nodes.push({
        id: task.id,
        name: task.name,
        laneId: group.id,
        status: task.status,
        type: task.type,
        plannedStartAt: task.plannedStartAt ?? task.start ?? null,
        plannedEndAt: task.plannedEndAt ?? task.end ?? null,
        startedAt: task.startedAt ?? null,
        finishedAt: task.finishedAt ?? null,
        durationMinutes: duration,
        progress: task.progress,
        dependencies,
        depth: 0,
        laneSlot: 0,
        esMinutes: 0,
        efMinutes: 0,
        lsMinutes: 0,
        lfMinutes: 0,
        slackMinutes: 0,
        isCritical: false,
        isBlocked: false,
      });
    }
  }

  // Edges direcionais: src → tgt.
  const edges: PertEdge[] = [];
  for (const node of nodes) {
    for (const dep of node.dependencies) {
      const sourceLane = taskLane.get(dep);
      const targetLane = taskLane.get(node.id);
      const isCrossLane = sourceLane !== targetLane;
      const isBlocked = failingIds.has(dep);
      edges.push({
        id: `${dep}__${node.id}`,
        source: dep,
        target: node.id,
        isCrossLane,
        isCritical: false,
        isBlocked,
      });
    }
  }

  // Profundidade (coluna) — maior caminho a partir das raízes.
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const depthMemo = new Map<string, number>();
  function computeDepth(id: string, visiting = new Set<string>()): number {
    if (depthMemo.has(id)) return depthMemo.get(id)!;
    if (visiting.has(id)) return 0; // proteção contra ciclo
    visiting.add(id);
    const node = nodeById.get(id);
    if (!node) return 0;
    const value = node.dependencies.length === 0
      ? 0
      : 1 + Math.max(...node.dependencies.map((d) => computeDepth(d, visiting)));
    visiting.delete(id);
    depthMemo.set(id, value);
    return value;
  }
  for (const node of nodes) node.depth = computeDepth(node.id);

  // Slot dentro da lane: agrupa por (lane, depth) e atribui índice estável.
  const slotsByLaneDepth = new Map<string, number>();
  // Ordena para determinismo: pelo depth, depois pela ordem original em groups[].
  const orderedNodes = [...nodes].sort((a, b) => {
    if (a.laneId !== b.laneId) {
      return lanes.findIndex((l) => l.id === a.laneId) - lanes.findIndex((l) => l.id === b.laneId);
    }
    if (a.depth !== b.depth) return a.depth - b.depth;
    return 0;
  });
  // Atribui laneSlot incremental por lane, respeitando colunas para evitar overlap.
  // Cada lane tem um contador por coluna (depth) e empilha verticalmente.
  const slotPerCell = new Map<string, number>();
  for (const node of orderedNodes) {
    const cellKey = `${node.laneId}::${node.depth}`;
    const slot = slotPerCell.get(cellKey) ?? 0;
    node.laneSlot = slot;
    slotPerCell.set(cellKey, slot + 1);
    void slotsByLaneDepth;
  }

  // PERT (ES/EF/LS/LF/slack/critical).
  applyPertSchedule(nodes, edges);

  // Marca arestas no caminho crítico (origem e destino críticos + slack 0).
  for (const edge of edges) {
    const src = nodeById.get(edge.source);
    const tgt = nodeById.get(edge.target);
    if (src?.isCritical && tgt?.isCritical) edge.isCritical = true;
  }

  // Bloqueio: BFS a partir de tasks com falha.
  const blocked = new Set<string>();
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node.id, []);
  for (const edge of edges) adjacency.get(edge.source)?.push(edge.target);
  const queue: string[] = [];
  for (const id of failingIds) {
    for (const succ of adjacency.get(id) ?? []) {
      if (!blocked.has(succ)) {
        blocked.add(succ);
        queue.push(succ);
      }
    }
  }
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const succ of adjacency.get(id) ?? []) {
      if (!blocked.has(succ)) {
        blocked.add(succ);
        queue.push(succ);
      }
    }
  }
  for (const node of nodes) node.isBlocked = blocked.has(node.id);

  // Resumo.
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
  for (const node of nodes) byStatus[node.status] += 1;
  const total = nodes.length;
  const successRate = total === 0 ? 0 : Math.round((byStatus.completed / total) * 100);
  const failedTaskIds = nodes.filter((n) => FAILURE_STATUSES.has(n.status)).map((n) => n.id);
  const affectedTaskIds = nodes.filter((n) => n.isBlocked).map((n) => n.id);
  const criticalFailedCount = nodes.filter(
    (n) => n.isCritical && FAILURE_STATUSES.has(n.status),
  ).length;

  const summary: PertSummary = {
    total,
    byStatus,
    successRate,
    failedTaskIds,
    affectedTaskIds,
    criticalFailedCount,
  };

  return {
    nodes,
    edges,
    lanes,
    summary,
    runMeta,
  };
}
