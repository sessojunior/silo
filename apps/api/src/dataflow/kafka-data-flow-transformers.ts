import type { ProductStatus } from "@silo/engine/domain/product-status";
import {
  clampProgress,
  normalizeModelKey,
  normalizeProductStatus,
} from "@silo/engine/dataflow/helpers";
import type {
  DataFlowTask,
  DataFlowTaskGroup,
  GroupedPipelineData,
  KafkaDataFlowGroup,
  KafkaDataFlowMessage,
  KafkaDataFlowTask,
} from "./types.js";

export function toValidDateString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return value;
}

export function addMinutesIso(start: string, minutes: number): string {
  const date = new Date(start);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

export function minutesBetween(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const startDate = new Date(start), endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
}

export function stableDependencies(dependencies?: string[]): string[] {
  if (!Array.isArray(dependencies)) return [];
  return dependencies.map((d) => String(d ?? "").trim()).filter((d) => d.length > 0);
}

export function productStatusToKafkaState(status: ProductStatus): string {
  switch (status) {
    case "completed": return "complete";
    case "in_progress": return "active";
    case "with_problems": case "run_again": return "failed";
    case "not_run": case "suspended": case "under_support": return "aborted";
    default: return "queued";
  }
}

export function isFinishedStatus(status: ProductStatus): boolean {
  return status === "completed" || status === "with_problems" || status === "run_again";
}

export function mapKafkaTaskToDataFlowTask(task: KafkaDataFlowTask, group: KafkaDataFlowGroup, message: KafkaDataFlowMessage): DataFlowTask {
  const status = normalizeProductStatus(task.state, task.status);
  const fallbackStart = toValidDateString(group.startedAt) ?? toValidDateString(message.run.cycleAt) ?? new Date().toISOString();
  const plannedStartAt = toValidDateString(task.plannedStartAt) ?? toValidDateString(task.startedAt) ?? fallbackStart;
  const referenceDurationMinutes = typeof task.referenceDurationMinutes === "number" && Number.isFinite(task.referenceDurationMinutes) ? task.referenceDurationMinutes : message.defaults?.referenceDurationMinutes ?? 15;
  const plannedEndAt = toValidDateString(task.plannedEndAt) ?? toValidDateString(task.finishedAt) ?? addMinutesIso(plannedStartAt, referenceDurationMinutes);
  const delayMinutes = typeof task.delayMinutes === "number" && Number.isFinite(task.delayMinutes) ? task.delayMinutes : 0;
  return {
    id: task.id, name: task.name, start: plannedStartAt, end: plannedEndAt,
    progress: clampProgress(task.progress, status), dependencies: stableDependencies(task.dependencies),
    status, type: "task", plannedStartAt, plannedEndAt,
    startedAt: toValidDateString(task.startedAt), finishedAt: toValidDateString(task.finishedAt),
    referenceDurationMinutes, delayMinutes,
    isDelayed: typeof task.isDelayed === "boolean" ? task.isDelayed : delayMinutes > (message.defaults?.latenessToleranceMinutes ?? 5),
  };
}

export function derivePipelineStatus(groups: DataFlowTaskGroup[]): ProductStatus {
  const statuses = groups.flatMap((g) => g.tasks.map((t) => t.status));
  if (statuses.includes("with_problems")) return "with_problems";
  if (statuses.includes("in_progress")) return "in_progress";
  if (statuses.includes("run_again")) return "run_again";
  if (statuses.includes("not_run")) return "not_run";
  if (statuses.includes("under_support")) return "under_support";
  if (statuses.includes("suspended")) return "suspended";
  if (statuses.length > 0 && statuses.every((s) => s === "completed")) return "completed";
  return "pending";
}

export function mapKafkaMessageToPipeline(message: KafkaDataFlowMessage): GroupedPipelineData {
  const groups = message.groups.map((group): DataFlowTaskGroup => ({
    id: group.id,
    name: group.name,
    tasks: group.tasks.map((task) => mapKafkaTaskToDataFlowTask(task, group, message)),
  })).filter((g) => g.tasks.length > 0);
  return {
    model: normalizeModelKey(message.product.slug) || message.product.slug,
    date: message.run.date,
    turn: String(message.run.turn),
    status: message.run.status ? normalizeProductStatus(message.run.status) : derivePipelineStatus(groups),
    groups,
  };
}