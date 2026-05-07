/**
 * Tópicos Kafka do sistema SILO.
 * Naming convention: <domain>.<action>
 */
export const KAFKA_TOPICS = {
  // Model events — published when a product model runs
  MODEL_COMPLETED: "model.completed",
  MODEL_FAILED: "model.failed",
  MODEL_STARTED: "model.started",

  // Monitoring events
  MONITORING_ALERT: "monitoring.alert",
  MONITORING_STATUS: "monitoring.status",

  // Product activity events
  PRODUCT_ACTIVITY_CREATED: "product.activity.created",
  PRODUCT_ACTIVITY_UPDATED: "product.activity.updated",
} as const;

export type KafkaTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];

// === Domain Event Union ===

export interface BaseEvent {
  eventId: string;
  topic: KafkaTopic;
  occurredAt: string; // ISO 8601
}

export interface ModelCompletedEvent extends BaseEvent {
  topic: typeof KAFKA_TOPICS.MODEL_COMPLETED;
  productId: string;
  slug: string;
  data?: Record<string, unknown>;
}

export interface ModelFailedEvent extends BaseEvent {
  topic: typeof KAFKA_TOPICS.MODEL_FAILED;
  productId: string;
  slug: string;
  error?: string;
}

export interface ModelStartedEvent extends BaseEvent {
  topic: typeof KAFKA_TOPICS.MODEL_STARTED;
  productId: string;
  slug: string;
}

export interface MonitoringAlertEvent extends BaseEvent {
  topic: typeof KAFKA_TOPICS.MONITORING_ALERT;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  metadata?: Record<string, unknown>;
}

export interface MonitoringStatusEvent extends BaseEvent {
  topic: typeof KAFKA_TOPICS.MONITORING_STATUS;
  status: "up" | "down" | "degraded";
  service: string;
}

export interface ProductActivityCreatedEvent extends BaseEvent {
  topic: typeof KAFKA_TOPICS.PRODUCT_ACTIVITY_CREATED;
  productActivityId: string;
  productId: string;
  userId: string;
}

export interface ProductActivityUpdatedEvent extends BaseEvent {
  topic: typeof KAFKA_TOPICS.PRODUCT_ACTIVITY_UPDATED;
  productActivityId: string;
  productId: string;
  userId: string;
  changes?: Record<string, unknown>;
}

export type DomainEvent =
  | ModelCompletedEvent
  | ModelFailedEvent
  | ModelStartedEvent
  | MonitoringAlertEvent
  | MonitoringStatusEvent
  | ProductActivityCreatedEvent
  | ProductActivityUpdatedEvent;
