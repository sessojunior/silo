"use client";

import { useEffect, useState } from "react";

import {
  parseEcflowKafkaPipelines,
  type EcflowKafkaNode,
} from "@silo/engine/dataflow/ecflow-kafka";
import { config } from "@/lib/config";

import type { GroupedPipelineData } from "./types";

export const SMNA_ECFLOW_TREE_URL =
  "https://unconglomerated-physiologically-grant.ngrok-free.dev/app9/json";

// Todos os modelos usam este feed SMNA compartilhado por enquanto.
// No futuro, cada modelo deve apontar para sua propria URL.
export const FALLBACK_ECFLOW_TREE_ROOT: EcflowKafkaNode = {
  kind: "suite",
  name: "SMNA_PRE_OPER",
  date: "2026-05-13",
  turn: "PRE_OPER",
  node_state: "queued",
  default_state: "queued",
  attributes: [],
  dependencies: [],
  triggerExpression: null,
  groups: [
    {
      kind: "family",
      name: "00",
      id: "SMNA_00_2026-05-13",
      date: "2026-05-13",
      turn: "00",
      node_state: "complete",
      tasks: [
        {
          kind: "task",
          id: "download_gfs_025",
          name: "Download GFS 0.25",
          state: "complete",
          plannedStartAt: "2026-05-13T00:00:00Z",
          plannedEndAt: "2026-05-13T00:30:00Z",
          startedAt: "2026-05-13T00:00:00Z",
          finishedAt: "2026-05-13T00:30:00Z",
          referenceDurationMinutes: 30,
        },
      ],
    },
  ],
};
export const MOCK_ECFLOW_TREE_ROOT = FALLBACK_ECFLOW_TREE_ROOT;

let smnaEcflowTreeRootPromise: Promise<EcflowKafkaNode> | null = null;

function isTreeRootCandidate(value: unknown): value is EcflowKafkaNode {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as {
    groups?: unknown;
    tasks?: unknown;
    kind?: unknown;
    name?: unknown;
    id?: unknown;
  };

  return (
    Array.isArray(candidate.groups) ||
    Array.isArray(candidate.tasks) ||
    typeof candidate.kind === "string" ||
    typeof candidate.name === "string" ||
    typeof candidate.id === "string"
  );
}

function buildFallbackDataFlowPipelinesFromRoot(
  root: EcflowKafkaNode,
  modelSlug: string,
): GroupedPipelineData[] {
  const snapshots = parseEcflowKafkaPipelines(root, modelSlug);
  const exactMatches = snapshots.filter(
    (snapshot) => snapshot.model === modelSlug,
  );

  if (exactMatches.length > 0) return exactMatches;

  return snapshots.map((snapshot) => ({
    ...snapshot,
    model: modelSlug || snapshot.model,
  }));
}

async function fetchSmnaEcflowTreeRoot(): Promise<EcflowKafkaNode> {
  try {
    const response = await fetch(SMNA_ECFLOW_TREE_URL, {
      cache: "no-store",
      credentials: "omit",
    });

    if (response.ok) {
      const payload: unknown = await response.json();
      if (isTreeRootCandidate(payload)) {
        return payload;
      }

      console.warn(
        "[dataflow] SMNA payload is not an ecFlow tree root; using embedded fallback",
      );
    } else {
      console.warn(
        `[dataflow] SMNA payload returned ${response.status}; using embedded fallback`,
      );
    }
  } catch (error) {
    console.warn("[dataflow] Falling back to embedded SMNA payload", error);
  }

  return FALLBACK_ECFLOW_TREE_ROOT;
}

export async function loadFallbackEcflowTreeRoot(): Promise<EcflowKafkaNode> {
  if (!smnaEcflowTreeRootPromise) {
    smnaEcflowTreeRootPromise = fetchSmnaEcflowTreeRoot();
  }

  return smnaEcflowTreeRootPromise;
}

export function getFallbackDataFlowPipelines(
  modelSlug: string,
): GroupedPipelineData[] {
  return buildFallbackDataFlowPipelinesFromRoot(
    FALLBACK_ECFLOW_TREE_ROOT,
    modelSlug,
  );
}

export const getMockDataFlowPipelines = getFallbackDataFlowPipelines;

export function selectDataFlowSnapshotFromPipelines(
  pipelines: GroupedPipelineData[],
  date?: string | null,
  turn?: string | null,
): GroupedPipelineData | null {
  if (pipelines.length === 0) return null;

  if (date && turn) {
    const exact = pipelines.find(
      (snapshot) => snapshot.date === date && snapshot.turn === turn,
    );
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
  return selectDataFlowSnapshotFromPipelines(
    getFallbackDataFlowPipelines(modelSlug),
    date,
    turn,
  );
}

export const selectMockDataFlowSnapshot = selectDataFlowSnapshot;

async function fetchApiDataFlowPipelines(
  modelSlug: string,
): Promise<GroupedPipelineData[] | null> {
  const response = await fetch(
    config.getApiUrl(
      `/api/admin/products/${encodeURIComponent(modelSlug)}/data-flow`,
    ),
    { cache: "no-store" },
  );

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    success?: boolean;
    data?: { pipelines?: GroupedPipelineData[] };
  };
  if (payload.success === false) return null;

  const pipelines = Array.isArray(payload.data?.pipelines)
    ? payload.data.pipelines
    : [];
  return pipelines.length > 0 ? pipelines : null;
}

export function useDataFlowPipelines(modelSlug?: string) {
  const [pipelines, setPipelines] = useState<GroupedPipelineData[]>([]);
  const [ecflowRoot, setEcflowRoot] = useState<EcflowKafkaNode>(
    FALLBACK_ECFLOW_TREE_ROOT,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    const requestedSlug = String(modelSlug ?? "").trim();

    if (!requestedSlug) {
      setPipelines([]);
      setEcflowRoot(FALLBACK_ECFLOW_TREE_ROOT);
      setLoading(false);
      return () => {
        isCancelled = true;
      };
    }

    setLoading(true);

    void Promise.allSettled([
      fetchApiDataFlowPipelines(requestedSlug),
      loadFallbackEcflowTreeRoot(),
    ])
      .then(([apiResult, rootResult]) => {
        if (isCancelled) return;

        const resolvedRoot =
          rootResult.status === "fulfilled"
            ? rootResult.value
            : FALLBACK_ECFLOW_TREE_ROOT;
        const apiPipelines =
          apiResult.status === "fulfilled" ? apiResult.value : null;

        setEcflowRoot(resolvedRoot);
        if (apiPipelines) {
          setPipelines(apiPipelines);
          return;
        }

        // O feed compartilhado do SMNA e temporario.
        // Quando cada modelo tiver sua propria URL, essa normalizacao pode sumir.
        setPipelines(
          buildFallbackDataFlowPipelinesFromRoot(resolvedRoot, requestedSlug),
        );
      })
      .catch((error: unknown) => {
        if (isCancelled) return;

        console.warn("[dataflow] Falling back to embedded SMNA payload", error);
        setEcflowRoot(FALLBACK_ECFLOW_TREE_ROOT);
        setPipelines(
          buildFallbackDataFlowPipelinesFromRoot(
            FALLBACK_ECFLOW_TREE_ROOT,
            requestedSlug,
          ),
        );
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

  return { pipelines, loading, ecflowRoot };
}
