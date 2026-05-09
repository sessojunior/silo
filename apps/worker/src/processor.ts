import { db } from "@silo/database";
import * as schema from "@silo/database/schema";
import { config } from "@silo/engine/config";
import {
  commitOffsetsRest,
  produceRecordRest,
  type RestConsumerInstance,
  type RestRecord,
} from "@silo/engine/kafka/rest-client";
import { getHandlerForTopic } from "./handlers/topic-handlers";

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function getMessageId(payload: unknown): string | undefined {
  const payloadObj = (payload as Record<string, unknown> | null) ?? null;
  const source = payloadObj?.source as Record<string, unknown> | undefined;
  const messageId =
    payloadObj?.message_id ??
    payloadObj?.messageId ??
    payloadObj?.id ??
    source?.messageId;
  return typeof messageId === "undefined" ? undefined : String(messageId);
}

async function commitNextOffset(
  instance: RestConsumerInstance,
  record: RestRecord,
): Promise<void> {
  await commitOffsetsRest(instance, [
    {
      topic: record.topic,
      partition: record.partition,
      offset: (Number(record.offset) + 1).toString(),
    },
  ]);
}

async function sendToDlq(topic: string, raw: string, key?: string): Promise<void> {
  await produceRecordRest(`${config.kafka.dlqPrefix}${topic}`, raw, key);
}

async function handleInvalidRecord(
  instance: RestConsumerInstance,
  record: RestRecord,
  raw: string,
  reason: string,
): Promise<void> {
  console.error(
    `[KAFKA-REST] ${reason}, sending to DLQ`,
    record.topic,
  );
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

export async function processRecord(
  instance: RestConsumerInstance,
  record: RestRecord,
): Promise<void> {
  const raw =
    typeof record.value === "string"
      ? record.value
      : JSON.stringify(record.value);

  let payload: unknown = null;
  try {
    payload = raw.length > 0 ? JSON.parse(raw) : null;
  } catch (error) {
    console.error("[KAFKA-REST] invalid JSON payload", error);
    await handleInvalidRecord(
      instance,
      record,
      raw,
      "invalid JSON payload",
    );
    return;
  }

  const messageId = getMessageId(payload);
  if (!messageId) {
    await handleInvalidRecord(
      instance,
      record,
      raw,
      "message without message_id/source.messageId",
    );
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
      console.error(
        `[KAFKA-REST] error processing message (attempt ${attempt})`,
        error,
      );
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