import { config } from "@silo/engine/config";
import { parseEcflowKafkaPipelines } from "@silo/engine/dataflow/ecflow-kafka";
import { clampProgress, normalizeModelKey, normalizeProductStatus } from "@silo/engine/dataflow/helpers";
import pipelineDataJson from "@silo/engine/dataflow/pipeline-data";
import { createRestConsumer, deleteRestConsumer, fetchRecordsRest, subscribeRest } from "@silo/engine/kafka/rest-client";
import { seedMonitoringProducts } from "@silo/engine/dataflow/seed-monitoring-products";

import type { GroupedPipelineData, GroupedPipelineDataFile, MonitoringProductItem, MonitoringProductsFile } from "./types";

type ActiveProduct = {
  slug: string;
  name: string;
};

const kafkaConfig = config.kafka;

const legacyPipelineData = pipelineDataJson as GroupedPipelineDataFile;
const legacyMonitoringData = seedMonitoringProducts;

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
  const topic = `${kafkaConfig.dataFlowTopicPrefix}${normalizeModelKey(slug)}`;
  const groupId = `${kafkaConfig.groupId}-ui-dataflow-${normalizeModelKey(slug) || "product"}`;
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
  return kafkaConfig.restProxyUseMockData || !kafkaConfig.restProxyUrl;
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
    products: legacyMonitoringData.products.flatMap((mockProduct) => {
      const matchedProduct = findMatchingActiveProduct(mockProduct, activeProducts);
      if (!matchedProduct) return [];

      return [
        {
          ...mockProduct,
          productId: matchedProduct.slug,
          model: matchedProduct.name,
          turns: mockProduct.turns.map((turn) => ({
            ...turn,
            status: normalizeProductStatus(turn.status),
            progress: clampProgress(turn.progress, normalizeProductStatus(turn.status)),
          })),
        } satisfies MonitoringProductItem,
      ];
    }),
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
      const products = pipelineGroups.flatMap(({ activeProduct, pipelines }) => {
        const product = pipelineToMonitoringProduct(activeProduct, pipelines);
        return product ? [product] : [];
      });

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
