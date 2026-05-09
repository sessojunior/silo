import { config } from "@silo/engine/config";
import {
  createRestConsumer,
  deleteRestConsumer,
  fetchRecordsRest,
  subscribeRest,
} from "@silo/engine/kafka/rest-client";
import {
  clampProgress,
  normalizeModelKey,
  normalizeProductStatus,
} from "@silo/engine/dataflow/helpers";
import pipelineDataJson from "@silo/engine/dataflow/pipeline-data";
import { seedMonitoringProducts } from "@silo/engine/dataflow/seed-monitoring-products";

import type {
  DataFlowTask,
  DataFlowTaskGroup,
  GroupedPipelineData,
  GroupedPipelineDataFile,
  KafkaDataFlowGroup,
  KafkaDataFlowMessage,
  KafkaDataFlowTask,
  MonitoringProductItem,
  MonitoringProductsFile,
} from "./types.js";
import type { ProductStatus } from "@silo/engine/domain/product-status";
import {
  isFinishedStatus,
  addMinutesIso,
  toValidDateString,
  minutesBetween,
  productStatusToKafkaState,
  stableDependencies,
} from "./kafka-data-flow-transformers.js";

const legacyPipelineData = pipelineDataJson as GroupedPipelineDataFile;
const legacyMonitoringData = seedMonitoringProducts as unknown as MonitoringProductsFile;

type ActiveProduct = {
  slug: string;
  name: string;
};

function legacySnapshotToKafkaMessage(snapshot: GroupedPipelineData, requestedSlug: string): KafkaDataFlowMessage {
  const productSlug = requestedSlug || snapshot.model;
  const topic = `${config.kafka.dataFlowTopicPrefix}${productSlug}`;
  const generatedAt = new Date().toISOString();
  return {
    schemaVersion: 1,
    source: { type: "ecflow", transport: "kafka", topic, messageId: `${productSlug}-${snapshot.date}-${snapshot.turn}-${generatedAt}`, generatedAt },
    product: { slug: productSlug, name: productSlug.toUpperCase() },
    run: { date: snapshot.date, turn: snapshot.turn, cycleAt: snapshot.groups[0]?.tasks[0]?.start ?? null, status: snapshot.status },
    defaults: { timezone: "America/Sao_Paulo", latenessToleranceMinutes: 5, referenceDurationMinutes: 15 },
    groups: snapshot.groups.map((group) => ({
      id: group.id,
      parentId: `${productSlug}/${snapshot.date}/${snapshot.turn}`,
      kind: "family",
      name: group.name,
      status: group.tasks.some((t) => t.status === "in_progress") ? "active" : group.tasks.some((t) => t.status === "with_problems") ? "failed" : group.tasks.every((t) => t.status === "completed") ? "complete" : "queued",
      startedAt: group.tasks[0]?.start ?? null,
      finishedAt: group.tasks.at(-1)?.end ?? null,
      referenceDurationMinutes: minutesBetween(group.tasks[0]?.start, group.tasks.at(-1)?.end) ?? 15,
      tasks: group.tasks.map((task) => ({
        id: task.id, kind: "task", name: task.name,
        state: productStatusToKafkaState(task.status), status: task.status,
        dependencies: stableDependencies(task.dependencies),
        triggerExpression: null, plannedStartAt: task.start, plannedEndAt: task.end,
        startedAt: task.status === "pending" ? null : task.start,
        finishedAt: isFinishedStatus(task.status) ? task.end : null,
        referenceDurationMinutes: minutesBetween(task.start, task.end) ?? 15,
        delayMinutes: 0, isDelayed: false, progress: task.progress,
      } satisfies KafkaDataFlowTask)),
    } satisfies KafkaDataFlowGroup)),
    raw: { suiteId: `${productSlug.toUpperCase()}_PRE_OPER`, simulated: true },
  };
}

function createMockDataFlowMessages(slug: string): KafkaDataFlowMessage[] {
  const requestedSlug = normalizeModelKey(slug);
  const exactMatches = legacyPipelineData.pipelines.filter((snapshot) => normalizeModelKey(snapshot.model) === requestedSlug);
  const snapshots = exactMatches.length > 0 ? exactMatches : legacyPipelineData.pipelines;
  return snapshots.map((snapshot) => legacySnapshotToKafkaMessage(exactMatches.length > 0 ? snapshot : { ...snapshot, model: requestedSlug || snapshot.model }, requestedSlug || snapshot.model));
}

function isKafkaDataFlowMessage(value: unknown): value is KafkaDataFlowMessage {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<KafkaDataFlowMessage>;
  return Boolean(c.product?.slug && c.run?.date && c.run?.turn && Array.isArray(c.groups));
}

async function fetchLiveDataFlowMessages(slug: string): Promise<KafkaDataFlowMessage[]> {
  const topic = `${config.kafka.dataFlowTopicPrefix}${normalizeModelKey(slug)}`;
  const groupId = `${config.kafka.groupId}-ui-dataflow-${normalizeModelKey(slug) || "product"}`;
  const instance = await createRestConsumer(groupId, undefined, "earliest");
  try {
    await subscribeRest(instance, [topic]);
    const records = await fetchRecordsRest(instance, 1000);
    return records.map((r) => r.value).filter(isKafkaDataFlowMessage);
  } finally {
    await deleteRestConsumer(instance).catch(() => undefined);
  }
}

function shouldUseMockRestProxyData(): boolean {
  return config.kafka.restProxyUseMockData || !config.kafka.restProxyUrl;
}

function mapKafkaTaskToDataFlowTask(task: KafkaDataFlowTask, group: KafkaDataFlowGroup, message: KafkaDataFlowMessage): DataFlowTask {
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

function derivePipelineStatus(groups: DataFlowTaskGroup[]): ProductStatus {
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

function mapKafkaMessageToPipeline(message: KafkaDataFlowMessage): GroupedPipelineData {
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

async function getDataFlowMessages(slug: string): Promise<KafkaDataFlowMessage[]> {
  if (!shouldUseMockRestProxyData()) {
    try {
      const liveMessages = await fetchLiveDataFlowMessages(slug);
      if (liveMessages.length > 0) return liveMessages;
    } catch (error) {
      console.warn("[kafka-rest-dataflow] Falling back to simulated data", error);
    }
  }
  return createMockDataFlowMessages(slug);
}

export async function getProductDataFlowPipelinesFromKafkaRest({ slug, date, turn }: { slug: string; date?: string | null; turn?: string | null }): Promise<GroupedPipelineData[]> {
  const messages = await getDataFlowMessages(slug);
  return messages.map(mapKafkaMessageToPipeline).filter((p) => (!date || p.date === date) && (!turn || p.turn === String(turn))).sort((a, b) => {
    const d = b.date.localeCompare(a.date);
    if (d !== 0) return d;
    return Number(b.turn) - Number(a.turn);
  });
}

export async function getMonitoringProductsFromKafkaRest(activeProducts: ActiveProduct[]): Promise<MonitoringProductsFile> {
  if (!shouldUseMockRestProxyData() && activeProducts.length > 0) {
    try {
      const pipelineGroups = await Promise.all(activeProducts.map(async (ap) => ({ ap, pipelines: await getProductDataFlowPipelinesFromKafkaRest({ slug: ap.slug }) })));
      const products = pipelineGroups.map(({ ap, pipelines }) => {
        if (pipelines.length === 0) return null;
        const latestDate = pipelines[0].date;
        const turns = pipelines.filter((p) => p.date === latestDate).map((p) => {
          const tasks = p.groups.flatMap((g) => g.tasks);
          const progress = tasks.length > 0 ? Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / tasks.length) : 0;
          return { turn: p.turn, status: p.status, progress };
        });
        return { productId: ap.slug, model: ap.name, turns } satisfies MonitoringProductItem;
      }).filter((p): p is MonitoringProductItem => p !== null);
      if (products.length > 0) {
        return { referenceDate: pipelineGroups[0]?.pipelines[0]?.date ?? new Date().toISOString().slice(0, 10), products };
      }
    } catch (error) {
      console.warn("[kafka-rest-monitoring] Falling back to simulated data", error);
    }
  }
  // Fallback to mock
  const normalized = normalizeModelKey;
  return {
    referenceDate: legacyMonitoringData.referenceDate,
    products: legacyMonitoringData.products.map((mockProduct) => {
      const mockId = normalized(mockProduct.productId);
      const modelKey = normalized(mockProduct.model);
      const matched = activeProducts.find((ap) => {
        const s = normalized(ap.slug), n = normalized(ap.name);
        return s === mockId || s === modelKey || n === mockId || n === modelKey || s.includes(modelKey) || modelKey.includes(s) || n.includes(modelKey) || modelKey.includes(n);
      });
      if (!matched) return null;
      return {
        ...mockProduct, productId: matched.slug, model: matched.name,
        turns: mockProduct.turns.map((t) => ({ ...t, status: normalizeProductStatus(t.status), progress: clampProgress(t.progress, normalizeProductStatus(t.status)) })),
      } satisfies MonitoringProductItem;
    }).filter((p): p is MonitoringProductItem => p !== null),
  };
}
