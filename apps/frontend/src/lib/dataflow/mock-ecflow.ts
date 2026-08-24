"use client";

import { useEffect, useMemo, useState } from "react";

import {
  parseEcflowKafkaPipelines,
  type EcflowKafkaNode,
} from "@silo/engine/dataflow/ecflow-kafka";
import type { DataFlowTask, DataFlowTaskGroup } from "@silo/engine/dataflow/types";
import { config } from "@/lib/config";

import type { GroupedPipelineData } from "./types";

export const SMNA_ECFLOW_TREE_URL =
  "https://unconglomerated-physiologically-grant.ngrok-free.dev/app9/json";
// A URL acima é apenas referência: o consumo do feed SMNA vivo é feito pelo
// backend (GET /api/products/{slug}/data-flow). O navegador não busca essa URL
// diretamente porque o feed não permite CORS.

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

/** Conta o numero total de tasks dentro de uma arvore ecFlow. */
function countTasksInTree(node: EcflowKafkaNode): number {
  const kind = typeof node.kind === "string" ? node.kind.toLowerCase() : "";
  if (kind === "task") return 1;

  let count = 0;
  for (const child of node.tasks ?? []) count += countTasksInTree(child);
  for (const child of node.groups ?? []) count += countTasksInTree(child);
  return count;
}

/** Converte um snapshot de pipeline (GroupedPipelineData) em uma arvore ecFlow.
 *  Usado como fallback quando o feed SMNA esta indisponivel mas a API retorna
 *  dados de pipeline. */
export function convertPipelineSnapshotToEcflowTree(
  snapshot: GroupedPipelineData,
): EcflowKafkaNode {
  function taskToEcflowNode(task: DataFlowTask): EcflowKafkaNode {
    return {
      kind: "task",
      id: task.id,
      name: task.name,
      state: task.status,
      default_state: "queued",
      date: snapshot.date,
      turn: snapshot.turn,
      attributes: [],
      dependencies: task.dependencies ?? [],
      triggerExpression: null,
      plannedStartAt: task.plannedStartAt ?? task.start,
      plannedEndAt: task.plannedEndAt ?? task.end,
      startedAt: task.startedAt ?? task.start,
      finishedAt:
        task.finishedAt ??
        (task.status === "completed" ? task.end : null),
      referenceDurationMinutes: task.referenceDurationMinutes,
      progress: task.progress,
    };
  }

  function groupToEcflowNode(group: DataFlowTaskGroup): EcflowKafkaNode {
    return {
      kind: "family",
      name: group.name,
      id: group.id,
      date: snapshot.date,
      turn: snapshot.turn,
      node_state: "queued",
      default_state: "queued",
      attributes: [],
      dependencies: [],
      triggerExpression: null,
      tasks: group.tasks.map(taskToEcflowNode),
    };
  }

  return {
    kind: "suite",
    name: "SMNA_PRE_OPER",
    date: snapshot.date,
    turn: "PRE_OPER",
    node_state: "queued",
    default_state: "queued",
    attributes: [],
    dependencies: [],
    triggerExpression: null,
    groups: snapshot.groups.map(groupToEcflowNode),
  };
}
export const MOCK_ECFLOW_TREE_ROOT = FALLBACK_ECFLOW_TREE_ROOT;

let smnaEcflowTreeRootPromise: Promise<EcflowKafkaNode> | null = null;

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
  // O feed SMNA vivo é consumido pelo backend (GET /api/products/{slug}/data-flow)
  // e chega aqui como pipelines. Não fazemos fetch direto do navegador para o
  // feed externo: ele não permite CORS e causava erro de console em toda carga.
  // Quando a API não retorna pipelines, usamos o snapshot embutido abaixo.
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
  // Indica se a arvore ecFlow foi construida a partir dos pipelines da API
  // (true) ou veio do feed SMNA / fallback estatico (false).
  const [ecflowFromPipeline, setEcflowFromPipeline] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    const requestedSlug = String(modelSlug ?? "").trim();

    if (!requestedSlug) {
      setPipelines([]);
      setEcflowRoot(FALLBACK_ECFLOW_TREE_ROOT);
      setEcflowFromPipeline(false);
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

        // Se temos pipelines da API mas a arvore ecFlow e minima (fallback),
        // constroi a arvore a partir dos pipelines para que a tabela mostre
        // todas as tasks corretamente.
        let effectiveRoot = resolvedRoot;
        let fromPipeline = false;
        if (
          apiPipelines &&
          apiPipelines.length > 0 &&
          countTasksInTree(resolvedRoot) <= 1
        ) {
          const latestSnapshot =
            selectDataFlowSnapshotFromPipelines(apiPipelines);
          if (latestSnapshot) {
            effectiveRoot = convertPipelineSnapshotToEcflowTree(latestSnapshot);
            fromPipeline = true;
          }
        }

        setEcflowRoot(effectiveRoot);
        setEcflowFromPipeline(fromPipeline);
        if (apiPipelines) {
          setPipelines(apiPipelines);
          return;
        }

        // O feed compartilhado do SMNA e temporario.
        // Quando cada modelo tiver sua propria URL, essa normalizacao pode sumir.
        setPipelines(
          buildFallbackDataFlowPipelinesFromRoot(effectiveRoot, requestedSlug),
        );
      })
      .catch((error: unknown) => {
        if (isCancelled) return;

        console.warn("[dataflow] Falling back to embedded SMNA payload", error);
        setEcflowRoot(FALLBACK_ECFLOW_TREE_ROOT);
        setEcflowFromPipeline(false);
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

  return { pipelines, loading, ecflowRoot, ecflowFromPipeline };
}

/**
 * Hook que retorna a arvore ecFlow para o snapshot ativo.
 * Quando a arvore principal foi construida a partir de pipelines (fallback),
 * reconstroi a arvore a partir do snapshot selecionado para refletir a
 * data/turno correta.
 */
export function useActiveEcflowRoot(
  ecflowRoot: EcflowKafkaNode,
  ecflowFromPipeline: boolean,
  activeSnapshot: GroupedPipelineData | null,
): EcflowKafkaNode {
  return useMemo(() => {
    if (!activeSnapshot) return ecflowRoot;

    // Se a arvore ecFlow foi construida a partir de pipelines, reconstroi
    // sempre a partir do snapshot ativo para refletir a data/turno correta.
    if (ecflowFromPipeline) {
      return convertPipelineSnapshotToEcflowTree(activeSnapshot);
    }

    // Se a arvore ecFlow tem 1 ou menos tasks, e uma arvore fallback.
    // Reconstroi a partir do snapshot ativo.
    if (countTasksInTree(ecflowRoot) <= 1) {
      return convertPipelineSnapshotToEcflowTree(activeSnapshot);
    }

    return ecflowRoot;
  }, [ecflowRoot, ecflowFromPipeline, activeSnapshot]);
}
