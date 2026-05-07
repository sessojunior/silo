import type { ProductStatus } from "../domain/product-status";

export type DataFlowNodeType = "task" | "product";

export interface DataFlowTask {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  dependencies: string[];
  status: ProductStatus;
  type: DataFlowNodeType;
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  referenceDurationMinutes?: number;
  delayMinutes?: number;
  isDelayed?: boolean;
}

export interface DataFlowTaskGroup {
  id: string;
  name: string;
  tasks: DataFlowTask[];
}

export interface GroupedPipelineData {
  model: string;
  date: string;
  turn: string;
  status: ProductStatus;
  groups: DataFlowTaskGroup[];
}

export interface GroupedPipelineDataFile {
  pipelines: GroupedPipelineData[];
}

export type MonitoringTurnProgress = {
  turn: string;
  status: ProductStatus;
  progress: number;
};

export type MonitoringProductItem = {
  productId: string;
  model: string;
  description?: string;
  turns: MonitoringTurnProgress[];
};

export type MonitoringProductsFile = {
  referenceDate: string;
  products: MonitoringProductItem[];
};

export type KafkaDataFlowTask = {
  id: string;
  kind?: "task" | string;
  name: string;
  state?: string | null;
  status?: string | null;
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
};

export type KafkaDataFlowGroup = {
  id: string;
  parentId?: string | null;
  kind?: "family" | string;
  name: string;
  status?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  referenceDurationMinutes?: number | null;
  tasks: KafkaDataFlowTask[];
};

export type KafkaDataFlowMessage = {
  schemaVersion: number;
  source: {
    type: string;
    transport: "kafka" | string;
    topic: string;
    messageId: string;
    generatedAt: string;
  };
  product: {
    slug: string;
    name: string;
  };
  run: {
    date: string;
    turn: string;
    cycleAt?: string | null;
    status?: string | null;
  };
  defaults?: {
    timezone?: string;
    latenessToleranceMinutes?: number;
    referenceDurationMinutes?: number;
  };
  groups: KafkaDataFlowGroup[];
  raw?: Record<string, unknown>;
};
