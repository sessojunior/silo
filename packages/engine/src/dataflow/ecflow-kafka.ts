import type { ProductStatus } from "../domain/product-status";
import {
  clampProgress,
  normalizeModelKey,
  normalizeProductStatus,
} from "./helpers";
import type {
  DataFlowTask,
  DataFlowTaskGroup,
  GroupedPipelineData,
  GroupedPipelineDataFile,
} from "./types";

export type EcflowKafkaNode = {
  id?: string;
  kind?: string;
  name?: string;
  state?: string | null;
  status?: string | null;
  node_state?: string | null;
  default_state?: string | null;
  date?: string | null;
  turn?: string | null;
  attributes?: string[];
  dependencies?: string[];
  triggerExpression?: string | null;
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  referenceDurationMinutes?: number | null;
  delayMinutes?: number | null;
  isDelayed?: boolean | null;
  progress?: number | null;
  groups?: EcflowKafkaNode[];
  tasks?: EcflowKafkaNode[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function toValidDateString(value: unknown): string | null {
  const text = readText(value);
  if (!text) return null;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return text;
}

function addMinutesIso(start: string, minutes: number): string {
  const date = new Date(start);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function stableDependencies(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((dependency) => readText(dependency))
    .filter((dependency): dependency is string => Boolean(dependency));
}

function isGroupedPipelineData(value: unknown): value is GroupedPipelineData {
  if (!isRecord(value)) return false;
  return (
    typeof value.model === "string" &&
    typeof value.date === "string" &&
    typeof value.turn === "string" &&
    Array.isArray(value.groups)
  );
}

function isGroupedPipelineDataFile(value: unknown): value is GroupedPipelineDataFile {
  if (!isRecord(value) || !Array.isArray(value.pipelines)) return false;
  return value.pipelines.every(isGroupedPipelineData);
}

function isEcflowNode(value: unknown): value is EcflowKafkaNode {
  if (!isRecord(value)) return false;

  return (
    typeof value.name === "string" ||
    typeof value.kind === "string" ||
    Array.isArray(value.groups) ||
    Array.isArray(value.tasks)
  );
}

function isEcflowTreeRoot(value: unknown): value is EcflowKafkaNode {
  if (!isEcflowNode(value)) return false;

  return (
    readText(value.kind) === "suite" ||
    readText(value.kind) === "family" ||
    Array.isArray(value.groups) ||
    Array.isArray(value.tasks)
  );
}

function extractDateFromIdentifier(identifier?: string): string | null {
  if (!identifier) return null;

  const parts = identifier.split("_").filter(Boolean);
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(parts[index])) {
      return parts[index];
    }
  }

  return null;
}

function extractTurnFromIdentifier(identifier?: string): string | null {
  if (!identifier) return null;

  const parts = identifier.split("_").filter(Boolean);
  for (let index = parts.length - 1; index > 0; index -= 1) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(parts[index])) {
      const candidate = parts[index - 1];
      return /^\d{1,2}$/.test(candidate) ? candidate : null;
    }
  }

  return null;
}

function resolveModelSlug(root: EcflowKafkaNode, fallbackSlug?: string): string {
  const normalizedFallback = normalizeModelKey(readText(fallbackSlug) ?? "");
  if (normalizedFallback) return normalizedFallback;

  const baseName = readText(root.name) ?? readText(root.id) ?? "";
  const withoutSuffix = baseName
    .replace(/_PRE_OPER$/i, "")
    .replace(/_PREOP$/i, "")
    .replace(/_PRE_OPERACAO$/i, "");
  const firstToken = withoutSuffix.split(/[_/-]+/).filter(Boolean)[0] ?? withoutSuffix;

  return normalizeModelKey(firstToken);
}

function findAncestorDate(ancestors: EcflowKafkaNode[]): string | null {
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const ancestor = ancestors[index];
    const explicitDate = toValidDateString(ancestor.date);
    if (explicitDate) return explicitDate;

    const derivedDate = extractDateFromIdentifier(readText(ancestor.id));
    if (derivedDate) return derivedDate;
  }

  return null;
}

function resolveExecutionDate(node: EcflowKafkaNode, ancestors: EcflowKafkaNode[]): string | null {
  return (
    toValidDateString(node.date) ??
    extractDateFromIdentifier(readText(node.id)) ??
    findAncestorDate(ancestors)
  );
}

function resolveExecutionTurn(node: EcflowKafkaNode): string | null {
  return readText(node.turn) ?? extractTurnFromIdentifier(readText(node.id));
}

function mapTaskNodeToDataFlowTask(task: EcflowKafkaNode, group: EcflowKafkaNode): DataFlowTask {
  const status = normalizeProductStatus(task.state, task.status ?? task.node_state);
  const fallbackStart =
    toValidDateString(task.startedAt) ??
    toValidDateString(group.startedAt) ??
    new Date().toISOString();
  const plannedStartAt =
    toValidDateString(task.plannedStartAt) ??
    toValidDateString(task.startedAt) ??
    fallbackStart;
  const groupReferenceDuration =
    typeof group.referenceDurationMinutes === "number" && Number.isFinite(group.referenceDurationMinutes)
      ? group.referenceDurationMinutes
      : null;
  const referenceDurationMinutes =
    typeof task.referenceDurationMinutes === "number" && Number.isFinite(task.referenceDurationMinutes)
      ? task.referenceDurationMinutes
      : groupReferenceDuration ?? 15;
  const plannedEndAt =
    toValidDateString(task.plannedEndAt) ??
    toValidDateString(task.finishedAt) ??
    addMinutesIso(plannedStartAt, referenceDurationMinutes);
  const delayMinutes =
    typeof task.delayMinutes === "number" && Number.isFinite(task.delayMinutes)
      ? task.delayMinutes
      : 0;

  return {
    id: readText(task.id) ?? readText(task.name) ?? `${plannedStartAt}-${group.name}`,
    name: readText(task.name) ?? readText(task.id) ?? "task",
    start: plannedStartAt,
    end: plannedEndAt,
    progress: clampProgress(task.progress, status),
    dependencies: stableDependencies(task.dependencies),
    status,
    type: "task",
    plannedStartAt,
    plannedEndAt,
    startedAt: toValidDateString(task.startedAt),
    finishedAt: toValidDateString(task.finishedAt),
    referenceDurationMinutes,
    delayMinutes,
    isDelayed:
      typeof task.isDelayed === "boolean"
        ? task.isDelayed
        : delayMinutes > 5,
  };
}

function collectTaskGroups(
  node: EcflowKafkaNode,
  pathSegments: string[],
): DataFlowTaskGroup[] {
  const groups: DataFlowTaskGroup[] = [];
  const nodeKey = readText(node.id) ?? readText(node.name) ?? "group";
  const currentPath = [...pathSegments, nodeKey];
  const tasks = Array.isArray(node.tasks) ? node.tasks.filter(isEcflowNode) : [];

  if (tasks.length > 0) {
    groups.push({
      id: readText(node.id) ?? currentPath.join("/"),
      name: readText(node.name) ?? nodeKey,
      tasks: tasks.map((task) => mapTaskNodeToDataFlowTask(task, node)),
    });
  }

  for (const child of node.groups ?? []) {
    groups.push(...collectTaskGroups(child, currentPath));
  }

  return groups.filter((group) => group.tasks.length > 0);
}

function derivePipelineStatus(groups: DataFlowTaskGroup[]): ProductStatus {
  const statuses = groups.flatMap((group) => group.tasks.map((task) => task.status));

  if (statuses.includes("with_problems")) return "with_problems";
  if (statuses.includes("in_progress")) return "in_progress";
  if (statuses.includes("run_again")) return "run_again";
  if (statuses.includes("not_run")) return "not_run";
  if (statuses.includes("under_support")) return "under_support";
  if (statuses.includes("suspended")) return "suspended";
  if (statuses.length > 0 && statuses.every((status) => status === "completed")) {
    return "completed";
  }

  return "pending";
}

function collectPipelineSnapshots(
  node: EcflowKafkaNode,
  ancestors: EcflowKafkaNode[],
  model: string,
): GroupedPipelineData[] {
  const snapshots: GroupedPipelineData[] = [];
  const turn = resolveExecutionTurn(node);
  const date = resolveExecutionDate(node, ancestors);
  const kind = readText(node.kind)?.toLowerCase();

  if (kind !== "task" && turn && date && (kind !== "suite" || ancestors.length > 0)) {
    const groups = collectTaskGroups(node, []);
    if (groups.length > 0) {
      const explicitStatus = normalizeProductStatus(node.state ?? node.status ?? node.node_state, node.default_state);
      const status = explicitStatus === "pending" ? derivePipelineStatus(groups) : explicitStatus;

      snapshots.push({
        model,
        date,
        turn,
        status,
        groups,
      });
    }
  }

  for (const child of node.groups ?? []) {
    snapshots.push(...collectPipelineSnapshots(child, [...ancestors, node], model));
  }

  return snapshots;
}

function sortPipelines(pipelines: GroupedPipelineData[]): GroupedPipelineData[] {
  return [...pipelines].sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date);
    if (dateDiff !== 0) return dateDiff;
    return Number(b.turn) - Number(a.turn);
  });
}

export function parseEcflowKafkaPipelines(
  value: unknown,
  fallbackSlug?: string,
): GroupedPipelineData[] {
  if (isGroupedPipelineDataFile(value)) {
    return sortPipelines(value.pipelines);
  }

  if (Array.isArray(value)) {
    if (value.every(isGroupedPipelineData)) {
      return sortPipelines(value);
    }

    return sortPipelines(
      value.flatMap((item) => parseEcflowKafkaPipelines(item, fallbackSlug)),
    );
  }

  if (!isEcflowTreeRoot(value)) {
    return [];
  }

  const model = resolveModelSlug(value, fallbackSlug);
  const snapshots = collectPipelineSnapshots(value, [], model);
  const uniqueSnapshots = new Map<string, GroupedPipelineData>();

  for (const snapshot of snapshots) {
    uniqueSnapshots.set(`${snapshot.model}|${snapshot.date}|${snapshot.turn}`, snapshot);
  }

  return sortPipelines([...uniqueSnapshots.values()]);
}