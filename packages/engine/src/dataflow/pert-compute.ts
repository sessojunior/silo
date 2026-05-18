import type { PertTaskNode } from "./pert-types";

// Duração mínima usada para tarefas sem janela conhecida (queued/pending) — manter
// como constante nomeada porque entra em todos os cálculos do PERT.
export const DEFAULT_QUEUED_DURATION_MIN = 5;
const EPSILON_SLACK_MIN = 0.001;

interface MutablePertNode extends PertTaskNode {}

// Implementação Kahn. Retorna a ordem topológica e a lista de ids que ficaram
// fora dela (indício de ciclo). Sem throw silencioso.
export function topoSort(
  nodes: PertTaskNode[],
  edges: { source: string; target: string }[],
): { order: string[]; leftover: string[] } {
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    indegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    if (!indegree.has(edge.target) || !adjacency.has(edge.source)) continue;
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    adjacency.get(edge.source)!.push(edge.target);
  }

  const queue: string[] = [];
  for (const [id, degree] of indegree) {
    if (degree === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const neighbor of adjacency.get(id) ?? []) {
      const next = (indegree.get(neighbor) ?? 0) - 1;
      indegree.set(neighbor, next);
      if (next === 0) queue.push(neighbor);
    }
  }

  const leftover: string[] = [];
  for (const node of nodes) {
    if (!order.includes(node.id)) leftover.push(node.id);
  }

  return { order, leftover };
}

// Aplica forward pass + backward pass + slack/critical em-place.
export function applyPertSchedule(
  nodes: MutablePertNode[],
  edges: { source: string; target: string }[],
): void {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const predecessors = new Map<string, string[]>();
  const successors = new Map<string, string[]>();

  for (const node of nodes) {
    predecessors.set(node.id, []);
    successors.set(node.id, []);
  }

  for (const edge of edges) {
    if (byId.has(edge.source) && byId.has(edge.target)) {
      predecessors.get(edge.target)!.push(edge.source);
      successors.get(edge.source)!.push(edge.target);
    }
  }

  const { order } = topoSort(nodes, edges);

  // Forward pass: ES = max(EF dos predecessores), EF = ES + duration
  for (const id of order) {
    const node = byId.get(id);
    if (!node) continue;
    const preds = predecessors.get(id) ?? [];
    const es = preds.length === 0
      ? 0
      : Math.max(...preds.map((p) => byId.get(p)?.efMinutes ?? 0));
    const duration = effectiveDuration(node);
    node.esMinutes = es;
    node.efMinutes = es + duration;
  }

  const projectEf = order.length === 0
    ? 0
    : Math.max(...order.map((id) => byId.get(id)?.efMinutes ?? 0));

  // Backward pass: LF = min(LS dos sucessores) ou projectEf, LS = LF - duration
  for (const id of [...order].reverse()) {
    const node = byId.get(id);
    if (!node) continue;
    const succ = successors.get(id) ?? [];
    const lf = succ.length === 0
      ? projectEf
      : Math.min(...succ.map((s) => byId.get(s)?.lsMinutes ?? projectEf));
    const duration = effectiveDuration(node);
    node.lfMinutes = lf;
    node.lsMinutes = lf - duration;
    node.slackMinutes = node.lsMinutes - node.esMinutes;
    node.isCritical = Math.abs(node.slackMinutes) <= EPSILON_SLACK_MIN;
  }
}

function effectiveDuration(node: PertTaskNode): number {
  if (node.durationMinutes > 0) return node.durationMinutes;
  return DEFAULT_QUEUED_DURATION_MIN;
}
