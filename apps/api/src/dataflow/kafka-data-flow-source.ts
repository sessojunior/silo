import { config } from "@silo/engine/config";
import { parseEcflowKafkaPipelines } from "@silo/engine/dataflow/ecflow-kafka";
import { clampProgress, normalizeModelKey, normalizeProductStatus } from "@silo/engine/dataflow/helpers";
import pipelineDataJson from "@silo/engine/dataflow/pipeline-data";
import { createRestConsumer, deleteRestConsumer, fetchRecordsRest, subscribeRest } from "@silo/engine/kafka/rest-client";
import { seedMonitoringProducts } from "@silo/engine/dataflow/seed-monitoring-products";

import type { GroupedPipelineData, GroupedPipelineDataFile, MonitoringProductItem, MonitoringProductsFile } from "./types.js";

const legacyPipelineData = pipelineDataJson as GroupedPipelineDataFile;
const legacyMonitoringData = seedMonitoringProducts;

type ActiveProduct = {
  slug: string;
  name: string;
};

function getMockDataFlowPipelines(slug: string): GroupedPipelineData[] {
  const requestedSlug = normalizeModelKey(slug);
  const exactMatches = legacyPipelineData.pipelines.filter(
    (snapshot) => normalizeModelKey(snapshot.model) === requestedSlug,
  );
  const snapshots = exactMatches.length > 0 ? exactMatches : legacyPipelineData.pipelines;

  return snapshots.map((snapshot) =>
    exactMatches.length > 0
      ? snapshot
      : { ...snapshot, model: requestedSlug || snapshot.model },
  );
}

function toParsedJsonValue(value: unknown): unknown {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function fetchLiveDataFlowPipelines(slug: string): Promise<GroupedPipelineData[]> {
  const topic = `${config.kafka.dataFlowTopicPrefix}${normalizeModelKey(slug)}`;
  const groupId = `${config.kafka.groupId}-ui-dataflow-${normalizeModelKey(slug) || "product"}`;
  const instance = await createRestConsumer(groupId, undefined, "earliest");

  try {
    await subscribeRest(instance, [topic]);
    const records = await fetchRecordsRest(instance, 1000);
    return records.flatMap((record) =>
      parseEcflowKafkaPipelines(toParsedJsonValue(record.value), slug),
    );
  } finally {
    await deleteRestConsumer(instance).catch(() => undefined);
  }
}

function shouldUseMockRestProxyData(): boolean {
  return config.kafka.restProxyUseMockData || !config.kafka.restProxyUrl;
}

async function getDataFlowPipelines(slug: string): Promise<GroupedPipelineData[]> {
  if (!shouldUseMockRestProxyData()) {
    try {
      const livePipelines = await fetchLiveDataFlowPipelines(slug);
      if (livePipelines.length > 0) return livePipelines;
    } catch (error) {
      console.warn("[kafka-rest-dataflow] Falling back to simulated data", error);
    }
  }

  return getMockDataFlowPipelines(slug);
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
  const pipelines = await getDataFlowPipelines(slug);
  return pipelines
    .filter((pipeline) => (!date || pipeline.date === date) && (!turn || pipeline.turn === String(turn)))
    .sort((a, b) => {
      const dateDiff = b.date.localeCompare(a.date);
      if (dateDiff !== 0) return dateDiff;
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
