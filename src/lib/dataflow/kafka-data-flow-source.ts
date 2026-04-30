import pipelineDataJson from "@/app/admin/products/[slug]/data-flow/pipeline-data.json";
import { config } from "@/lib/config";
import { createRestConsumer, deleteRestConsumer, fetchRecordsRest, subscribeRest } from "@/lib/kafka-rest";
import { DEFAULT_STATUS, type ProductStatus } from "@/lib/product-status";
import { seedMonitoringProducts } from "@/lib/db/seed-products";

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
} from "./types";

type ActiveProduct = {
  slug: string;
  name: string;
};

const legacyPipelineData = pipelineDataJson as GroupedPipelineDataFile;
const legacyMonitoringData = seedMonitoringProducts as unknown as MonitoringProductsFile;

const STATUS_BY_KAFKA_STATE: Record<string, ProductStatus> = {
  queued: "pending",
  queue: "pending",
  pending: "pending",
  submitted: "pending",
  complete: "completed",
  completed: "completed",
  active: "in_progress",
  running: "in_progress",
  in_progress: "in_progress",
  failed: "with_problems",
  aborted: "with_problems",
  error: "with_problems",
  with_problems: "with_problems",
  run_again: "run_again",
  not_run: "not_run",
  under_support: "under_support",
  suspended: "suspended",
};

function normalizeModelKey(value: string): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeProductStatus(primary?: string | null, fallback?: string | null): ProductStatus {
  const candidates = [primary, fallback];
  for (const candidate of candidates) {
    const key = String(candidate ?? "").trim().toLowerCase();
    if (key && STATUS_BY_KAFKA_STATE[key]) {
      return STATUS_BY_KAFKA_STATE[key];
    }
  }
  return DEFAULT_STATUS;
}

function clampProgress(value: unknown, status: ProductStatus): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(100, Math.max(0, Math.round(value)));
  }

  if (status === "completed") return 100;
  if (status === "in_progress") return 50;
  return 0;
}

function toValidDateString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return value;
}

function addMinutesIso(start: string, minutes: number): string {
  const date = new Date(start);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function minutesBetween(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
}

function stableDependencies(dependencies?: string[]): string[] {
  if (!Array.isArray(dependencies)) return [];
  return dependencies
    .map((dependency) => String(dependency ?? "").trim())
    .filter((dependency) => dependency.length > 0);
}

function productStatusToKafkaState(status: ProductStatus): string {
  switch (status) {
    case "completed":
      return "complete";
    case "in_progress":
      return "active";
    case "with_problems":
    case "run_again":
      return "failed";
    case "not_run":
    case "suspended":
    case "under_support":
      return "aborted";
    case "pending":
    default:
      return "queued";
  }
}

function isFinishedStatus(status: ProductStatus): boolean {
  return status === "completed" || status === "with_problems" || status === "run_again";
}

function legacySnapshotToKafkaMessage(snapshot: GroupedPipelineData, requestedSlug: string): KafkaDataFlowMessage {
  const productSlug = requestedSlug || snapshot.model;
  const productName = productSlug.toUpperCase();
  const topicPrefix = config.kafka.dataFlowTopicPrefix;
  const topic = `${topicPrefix}${productSlug}`;
  const generatedAt = new Date().toISOString();

  return {
    schemaVersion: 1,
    source: {
      type: "ecflow",
      transport: "kafka",
      topic,
      messageId: `${productSlug}-${snapshot.date}-${snapshot.turn}-${generatedAt}`,
      generatedAt,
    },
    product: {
      slug: productSlug,
      name: productName,
    },
    run: {
      date: snapshot.date,
      turn: snapshot.turn,
      cycleAt: snapshot.groups[0]?.tasks[0]?.start ?? null,
      status: snapshot.status,
    },
    defaults: {
      timezone: "America/Sao_Paulo",
      latenessToleranceMinutes: 5,
      referenceDurationMinutes: 15,
    },
    groups: snapshot.groups.map((group) => ({
      id: group.id,
      parentId: `${productSlug}/${snapshot.date}/${snapshot.turn}`,
      kind: "family",
      name: group.name,
      status: group.tasks.some((task) => task.status === "in_progress")
        ? "active"
        : group.tasks.some((task) => task.status === "with_problems")
          ? "failed"
          : group.tasks.every((task) => task.status === "completed")
            ? "complete"
            : "queued",
      startedAt: group.tasks[0]?.start ?? null,
      finishedAt: group.tasks.at(-1)?.end ?? null,
      referenceDurationMinutes: minutesBetween(group.tasks[0]?.start, group.tasks.at(-1)?.end) ?? 15,
      tasks: group.tasks.map((task) => {
        const referenceDurationMinutes = minutesBetween(task.start, task.end) ?? 15;
        return {
          id: task.id,
          kind: "task",
          name: task.name,
          state: productStatusToKafkaState(task.status),
          status: task.status,
          dependencies: stableDependencies(task.dependencies),
          triggerExpression: null,
          plannedStartAt: task.start,
          plannedEndAt: task.end,
          startedAt: task.status === "pending" ? null : task.start,
          finishedAt: isFinishedStatus(task.status) ? task.end : null,
          referenceDurationMinutes,
          delayMinutes: 0,
          isDelayed: false,
          progress: task.progress,
        } satisfies KafkaDataFlowTask;
      }),
    } satisfies KafkaDataFlowGroup)),
    raw: {
      suiteId: `${productSlug.toUpperCase()}_PRE_OPER`,
      simulated: true,
    },
  };
}

function createMockDataFlowMessages(slug: string): KafkaDataFlowMessage[] {
  const requestedSlug = normalizeModelKey(slug);
  const exactMatches = legacyPipelineData.pipelines.filter(
    (snapshot) => normalizeModelKey(snapshot.model) === requestedSlug,
  );
  const snapshots = exactMatches.length > 0 ? exactMatches : legacyPipelineData.pipelines;

  return snapshots.map((snapshot) =>
    legacySnapshotToKafkaMessage(
      exactMatches.length > 0 ? snapshot : { ...snapshot, model: requestedSlug || snapshot.model },
      requestedSlug || snapshot.model,
    ),
  );
}

function isKafkaDataFlowMessage(value: unknown): value is KafkaDataFlowMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<KafkaDataFlowMessage>;
  return Boolean(candidate.product?.slug && candidate.run?.date && candidate.run?.turn && Array.isArray(candidate.groups));
}

async function fetchLiveDataFlowMessages(slug: string): Promise<KafkaDataFlowMessage[]> {
  const topic = `${config.kafka.dataFlowTopicPrefix}${normalizeModelKey(slug)}`;
  const groupId = `${config.kafka.groupId}-ui-dataflow-${normalizeModelKey(slug) || "product"}`;
  const instance = await createRestConsumer(groupId, undefined, "earliest");

  try {
    await subscribeRest(instance, [topic]);
    const records = await fetchRecordsRest(instance, 1000);
    return records
      .map((record) => record.value)
      .filter(isKafkaDataFlowMessage);
  } finally {
    await deleteRestConsumer(instance).catch(() => undefined);
  }
}

function shouldUseMockRestProxyData(): boolean {
  return config.kafka.restProxyUseMockData || !config.kafka.restProxyUrl;
}

function mapKafkaTaskToDataFlowTask(
  task: KafkaDataFlowTask,
  group: KafkaDataFlowGroup,
  message: KafkaDataFlowMessage,
): DataFlowTask {
  const status = normalizeProductStatus(task.state, task.status);
  const fallbackStart = toValidDateString(group.startedAt) ?? toValidDateString(message.run.cycleAt) ?? new Date().toISOString();
  const plannedStartAt = toValidDateString(task.plannedStartAt) ?? toValidDateString(task.startedAt) ?? fallbackStart;
  const referenceDurationMinutes =
    typeof task.referenceDurationMinutes === "number" && Number.isFinite(task.referenceDurationMinutes)
      ? task.referenceDurationMinutes
      : message.defaults?.referenceDurationMinutes ?? 15;
  const plannedEndAt =
    toValidDateString(task.plannedEndAt) ??
    toValidDateString(task.finishedAt) ??
    addMinutesIso(plannedStartAt, referenceDurationMinutes);
  const delayMinutes =
    typeof task.delayMinutes === "number" && Number.isFinite(task.delayMinutes) ? task.delayMinutes : 0;

  return {
    id: task.id,
    name: task.name,
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
        : delayMinutes > (message.defaults?.latenessToleranceMinutes ?? 5),
  };
}

function derivePipelineStatus(groups: DataFlowTaskGroup[]): ProductStatus {
  const statuses = groups.flatMap((group) => group.tasks.map((task) => task.status));
  if (statuses.includes("with_problems")) return "with_problems";
  if (statuses.includes("in_progress")) return "in_progress";
  if (statuses.includes("run_again")) return "run_again";
  if (statuses.includes("not_run")) return "not_run";
  if (statuses.includes("under_support")) return "under_support";
  if (statuses.includes("suspended")) return "suspended";
  if (statuses.length > 0 && statuses.every((status) => status === "completed")) return "completed";
  return "pending";
}

function mapKafkaMessageToPipeline(message: KafkaDataFlowMessage): GroupedPipelineData {
  const groups = message.groups
    .map((group): DataFlowTaskGroup => ({
      id: group.id,
      name: group.name,
      tasks: group.tasks.map((task) => mapKafkaTaskToDataFlowTask(task, group, message)),
    }))
    .filter((group) => group.tasks.length > 0);

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

export async function getProductDataFlowPipelinesFromKafkaRest({
  slug,
  date,
  turn,
}: {
  slug: string;
  date?: string | null;
  turn?: string | null;
}): Promise<GroupedPipelineData[]> {
  const messages = await getDataFlowMessages(slug);
  return messages
    .map(mapKafkaMessageToPipeline)
    .filter((pipeline) => (!date || pipeline.date === date) && (!turn || pipeline.turn === String(turn)))
    .sort((a, b) => {
      const dateDiff = b.date.localeCompare(a.date);
      if (dateDiff !== 0) return dateDiff;
      return Number(b.turn) - Number(a.turn);
    });
}

function findMatchingActiveProduct(
  mockProduct: MonitoringProductItem,
  activeProducts: ActiveProduct[],
): ActiveProduct | null {
  const mockId = normalizeModelKey(mockProduct.productId);
  const modelKey = normalizeModelKey(mockProduct.model);

  for (const activeProduct of activeProducts) {
    const activeSlug = normalizeModelKey(activeProduct.slug);
    const activeName = normalizeModelKey(activeProduct.name);

    if (
      activeSlug === mockId ||
      activeSlug === modelKey ||
      activeName === mockId ||
      activeName === modelKey ||
      activeSlug.includes(modelKey) ||
      modelKey.includes(activeSlug) ||
      activeName.includes(modelKey) ||
      modelKey.includes(activeName) ||
      activeSlug.includes(mockId) ||
      mockId.includes(activeSlug)
    ) {
      return activeProduct;
    }
  }

  return null;
}

function getMockMonitoringProducts(activeProducts: ActiveProduct[]): MonitoringProductsFile {
  return {
    referenceDate: legacyMonitoringData.referenceDate,
    products: legacyMonitoringData.products
      .map((mockProduct) => {
        const matchedProduct = findMatchingActiveProduct(mockProduct, activeProducts);
        if (!matchedProduct) return null;

        return {
          ...mockProduct,
          productId: matchedProduct.slug,
          model: matchedProduct.name,
          turns: mockProduct.turns.map((turn) => ({
            ...turn,
            status: normalizeProductStatus(turn.status),
            progress: clampProgress(turn.progress, normalizeProductStatus(turn.status)),
          })),
        } satisfies MonitoringProductItem;
      })
      .filter((product): product is MonitoringProductItem => product !== null),
  };
}

function pipelineToMonitoringProduct(activeProduct: ActiveProduct, pipelines: GroupedPipelineData[]): MonitoringProductItem | null {
  if (pipelines.length === 0) return null;

  const latestDate = pipelines[0].date;
  const turns = pipelines
    .filter((pipeline) => pipeline.date === latestDate)
    .map((pipeline) => {
      const tasks = pipeline.groups.flatMap((group) => group.tasks);
      const progress = tasks.length > 0
        ? Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length)
        : 0;

      return {
        turn: pipeline.turn,
        status: pipeline.status,
        progress,
      };
    });

  return {
    productId: activeProduct.slug,
    model: activeProduct.name,
    turns,
  };
}

export async function getMonitoringProductsFromKafkaRest(activeProducts: ActiveProduct[]): Promise<MonitoringProductsFile> {
  if (!shouldUseMockRestProxyData() && activeProducts.length > 0) {
    try {
      const pipelineGroups = await Promise.all(
        activeProducts.map(async (activeProduct) => ({
          activeProduct,
          pipelines: await getProductDataFlowPipelinesFromKafkaRest({ slug: activeProduct.slug }),
        })),
      );
      const products = pipelineGroups
        .map(({ activeProduct, pipelines }) => pipelineToMonitoringProduct(activeProduct, pipelines))
        .filter((product): product is MonitoringProductItem => product !== null);

      if (products.length > 0) {
        return {
          referenceDate: pipelineGroups[0]?.pipelines[0]?.date ?? new Date().toISOString().slice(0, 10),
          products,
        };
      }
    } catch (error) {
      console.warn("[kafka-rest-monitoring] Falling back to simulated data", error);
    }
  }

  return getMockMonitoringProducts(activeProducts);
}
