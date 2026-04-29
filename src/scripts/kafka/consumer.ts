import "dotenv/config";

import { config } from "@/lib/config";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  commitOffsetsRest,
  createRestConsumer,
  deleteRestConsumer,
  fetchRecordsRest,
  produceRecordRest,
  subscribeRest,
  type RestConsumerInstance,
  type RestRecord,
} from "@/lib/kafkaRest";
import { getHandlerForTopic } from "@/lib/kafka/topicHandlers";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTopicsToSubscribe(): string[] {
  const envTopic = (process.env.KAFKA_TOPIC || "").trim();
  const cliTopic = (process.argv[2] || "").trim();
  const singleTopic = envTopic.length > 0 ? envTopic : cliTopic.length > 0 ? cliTopic : undefined;
  if (singleTopic) return [singleTopic];
  return config.kafka.topics;
}

function getMessageId(payload: unknown): string | undefined {
  const payloadObj = (payload as Record<string, unknown> | null) ?? null;
  const source = payloadObj?.source as Record<string, unknown> | undefined;
  const messageId = payloadObj?.message_id ?? payloadObj?.messageId ?? payloadObj?.id ?? source?.messageId;
  return typeof messageId === "undefined" ? undefined : String(messageId);
}

async function commitNextOffset(instance: RestConsumerInstance, record: RestRecord) {
  await commitOffsetsRest(instance, [
    {
      topic: record.topic,
      partition: record.partition,
      offset: (Number(record.offset) + 1).toString(),
    },
  ]);
}

async function sendToDlq(topic: string, raw: string, key?: string) {
  await produceRecordRest(`${config.kafka.dlqPrefix}${topic}`, raw, key);
}

async function handleInvalidRecord(
  instance: RestConsumerInstance,
  record: RestRecord,
  raw: string,
  reason: string,
) {
  console.error(`[KAFKA-REST] ${reason}, sending to DLQ`, record.topic);
  try {
    await sendToDlq(record.topic, raw);
  } catch (error) {
    console.error("[KAFKA-REST] failed to send to DLQ", error);
  }

  try {
    await commitNextOffset(instance, record);
  } catch (error) {
    console.error("[KAFKA-REST] commitOffsets failed", error);
  }
}

async function processRecord(instance: RestConsumerInstance, record: RestRecord) {
  const raw = typeof record.value === "string" ? record.value : JSON.stringify(record.value);

  let payload: unknown = null;
  try {
    payload = raw.length > 0 ? JSON.parse(raw) : null;
  } catch (error) {
    console.error("[KAFKA-REST] invalid JSON payload", error);
    await handleInvalidRecord(instance, record, raw, "invalid JSON payload");
    return;
  }

  const messageId = getMessageId(payload);
  if (!messageId) {
    await handleInvalidRecord(instance, record, raw, "message without message_id/source.messageId");
    return;
  }

  const handler = getHandlerForTopic(record.topic);
  const maxAttempts = config.kafka.processRetryCount || 3;
  const baseBackoff = config.kafka.retryBackoffMs || 1000;
  let attempt = 0;
  let succeeded = false;

  while (attempt < maxAttempts && !succeeded) {
    attempt += 1;

    try {
      await db.transaction(async (tx) => {
        try {
          await tx.insert(schema.kafkaProcessedMessages).values({
            topic: record.topic,
            messageId,
            handler: handler.name || record.topic,
          });
        } catch (error: unknown) {
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            (error as { code?: unknown }).code === "23505"
          ) {
            succeeded = true;
            return;
          }
          throw error;
        }

        await handler({
          topic: record.topic,
          partition: record.partition,
          messageId,
          payload,
          tx,
        });
      });

      succeeded = true;
    } catch (error) {
      console.error(`[KAFKA-REST] error processing message (attempt ${attempt})`, error);
      if (attempt < maxAttempts) {
        await sleep(baseBackoff * Math.pow(2, attempt - 1));
      }
    }
  }

  if (!succeeded) {
    try {
      await sendToDlq(record.topic, raw, messageId);
    } catch (error) {
      console.error("[KAFKA-REST] failed to send to DLQ", error);
    }
  }

  try {
    await commitNextOffset(instance, record);
  } catch (error) {
    console.error("[KAFKA-REST] failed to commit offset", error);
  }
}

async function runConsumer() {
  if (!config.kafka.restProxyUrl) {
    console.error("KAFKA_REST_PROXY_URL must be configured. Kafka access is REST Proxy only.");
    process.exit(1);
  }

  const topicsToSubscribe = getTopicsToSubscribe();
  if (topicsToSubscribe.length === 0) {
    console.error("Configure KAFKA_TOPIC or KAFKA_TOPICS with at least one topic.");
    process.exit(1);
  }

  const groupSuffix = topicsToSubscribe.length === 1 ? `-${topicsToSubscribe[0]}` : "";
  const groupId = `${config.kafka.groupId}${groupSuffix}`;
  const instance = await createRestConsumer(groupId);

  try {
    await subscribeRest(instance, topicsToSubscribe);
    console.log(`Kafka REST consumer started for group ${groupId} topics=${topicsToSubscribe.join(",")}`);

    while (true) {
      let records: RestRecord[] = [];
      try {
        records = await fetchRecordsRest(instance, 10000);
      } catch (error) {
        console.error("[KAFKA-REST] fetchRecords error", error);
        await sleep(1000);
        continue;
      }

      for (const record of records) {
        await processRecord(instance, record);
      }
    }
  } finally {
    try {
      await deleteRestConsumer(instance);
    } catch (error) {
      console.error("[KAFKA-REST] failed to delete consumer", error);
    }
  }
}

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down kafka REST consumer...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down kafka REST consumer...");
  process.exit(0);
});

runConsumer().catch((error) => {
  console.error("Kafka REST consumer failed:", error);
  process.exit(1);
});