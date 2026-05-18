import type { ProductStatus } from "../domain/product-status";
import type { DataFlowNodeType } from "./types";

// Token de cor neutro por lane — a UI mapeia o token para classes Tailwind.
export type PertLaneColorToken =
  | "slate"
  | "emerald"
  | "sky"
  | "amber"
  | "violet"
  | "fuchsia"
  | "rose";

export interface PertLane {
  id: string;
  label: string;
  colorToken: PertLaneColorToken;
  iconToken: string;
  taskIds: string[];
}

export interface PertTaskNode {
  id: string;
  name: string;
  laneId: string;
  status: ProductStatus;
  type: DataFlowNodeType;
  // Janela planejada/real em ISO string (ou null se ausente).
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  // Duração em minutos derivada de start/end ou de referenceDurationMinutes.
  durationMinutes: number;
  progress: number;
  dependencies: string[]; // Ids resolvidos (referenceKey) das tasks predecessoras.
  // Layout determinístico: profundidade (coluna) + slot dentro da lane.
  depth: number;
  laneSlot: number;
  // Resultado do PERT (em minutos relativos ao primeiro ES = 0).
  esMinutes: number;
  efMinutes: number;
  lsMinutes: number;
  lfMinutes: number;
  slackMinutes: number;
  isCritical: boolean;
  // Marcador derivado: dependência com falha bloqueia este nó.
  isBlocked: boolean;
}

export interface PertEdge {
  id: string;
  source: string;
  target: string;
  isCrossLane: boolean;
  isCritical: boolean;
  isBlocked: boolean;
}

export interface PertSummary {
  total: number;
  byStatus: Record<ProductStatus, number>;
  successRate: number; // 0..100
  failedTaskIds: string[];
  affectedTaskIds: string[];
  criticalFailedCount: number;
}

export interface PertRunMeta {
  productSlug: string;
  productLabel: string;
  date: string;
  turn: string;
  runLabel: string;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  actualStartAt: string | null;
  actualEndAt: string | null;
  lastUpdatedAt: string | null;
}

export interface PertGraph {
  nodes: PertTaskNode[];
  edges: PertEdge[];
  lanes: PertLane[];
  summary: PertSummary;
  runMeta: PertRunMeta;
}
