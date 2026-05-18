"use client";

import { useEffect, useState } from "react";

import { parseEcflowKafkaPipelines, type EcflowKafkaNode } from "@silo/engine/dataflow/ecflow-kafka";
import { config } from "@/lib/config";

import type { GroupedPipelineData } from "./types";
import kafkaConsumerApiExampleJson from "../../../../../kafka-consumer-api-example.json";

export const FALLBACK_ECFLOW_TREE_ROOT: EcflowKafkaNode = kafkaConsumerApiExampleJson;
export const MOCK_ECFLOW_TREE_ROOT = FALLBACK_ECFLOW_TREE_ROOT;

function buildFallbackDataFlowPipelines(modelSlug: string): GroupedPipelineData[] {
  const snapshots = parseEcflowKafkaPipelines(FALLBACK_ECFLOW_TREE_ROOT, modelSlug);
  const exactMatches = snapshots.filter((snapshot) => snapshot.model === modelSlug);

  if (exactMatches.length > 0) return exactMatches;

  return snapshots.map((snapshot) => ({
    ...snapshot,
    model: modelSlug || snapshot.model,
  }));
}

export function getFallbackDataFlowPipelines(modelSlug: string): GroupedPipelineData[] {
  return buildFallbackDataFlowPipelines(modelSlug);
}

export const getMockDataFlowPipelines = getFallbackDataFlowPipelines;

export function selectDataFlowSnapshotFromPipelines(
  pipelines: GroupedPipelineData[],
  date?: string | null,
  turn?: string | null,
): GroupedPipelineData | null {
  if (pipelines.length === 0) return null;

  if (date && turn) {
    const exact = pipelines.find((snapshot) => snapshot.date === date && snapshot.turn === turn);
    if (exact) return exact;
  }

  const sorted = [...pipelines].sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date);
    if (dateDiff !== 0) return dateDiff;
    return Number(b.turn) - Number(a.turn);
  });

  return sorted[0] ?? null;
}

export function selectDataFlowSnapshot(
  modelSlug: string,
  date?: string | null,
  turn?: string | null,
): GroupedPipelineData | null {
  return selectDataFlowSnapshotFromPipelines(getFallbackDataFlowPipelines(modelSlug), date, turn);
}

export const selectMockDataFlowSnapshot = selectDataFlowSnapshot;

async function fetchApiDataFlowPipelines(modelSlug: string): Promise<GroupedPipelineData[] | null> {
  const response = await fetch(
    config.getApiUrl(`/api/admin/products/${encodeURIComponent(modelSlug)}/data-flow`),
    { cache: "no-store" },
  );

  if (!response.ok) return null;

  const payload = (await response.json()) as { success?: boolean; data?: { pipelines?: GroupedPipelineData[] } };
  if (payload.success === false) return null;

  const pipelines = Array.isArray(payload.data?.pipelines) ? payload.data.pipelines : [];
  return pipelines.length > 0 ? pipelines : null;
}

export function useDataFlowPipelines(modelSlug?: string) {
  const [pipelines, setPipelines] = useState<GroupedPipelineData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    const requestedSlug = String(modelSlug ?? "").trim();

    if (!requestedSlug) {
      setPipelines([]);
      setLoading(false);
      return () => {
        isCancelled = true;
      };
    }

    setLoading(true);

    void fetchApiDataFlowPipelines(requestedSlug)
      .then((apiPipelines) => {
        if (isCancelled) return;

        if (apiPipelines) {
          setPipelines(apiPipelines);
          return;
        }

        // Fallback: usa o ecFlow de exemplo até o REST Proxy entregar os dados reais.
        setPipelines(buildFallbackDataFlowPipelines(requestedSlug));
      })
      .catch((error: unknown) => {
        if (isCancelled) return;

        console.warn("[dataflow] Falling back to example ecFlow payload", error);
        setPipelines(buildFallbackDataFlowPipelines(requestedSlug));
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [modelSlug]);

  return { pipelines, loading };
}