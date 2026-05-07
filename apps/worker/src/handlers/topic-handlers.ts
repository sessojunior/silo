import { modelHandler } from "./model-handler";
import { monitoringHandler } from "./monitoring-handler";

export type KafkaHandler = (params: {
  topic: string;
  partition: number;
  messageId: string | number;
  payload: unknown;
  tx?: unknown;
  db?: unknown;
}) => Promise<void>;

export function getHandlerForTopic(topic: string): KafkaHandler {
  if (topic.startsWith("model.")) return modelHandler;
  if (topic.startsWith("monitoring.")) return monitoringHandler;

  // default fallback: no-op handler
  return async () => undefined;
}
