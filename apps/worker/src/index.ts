import "dotenv/config";

import { config } from "@silo/engine/config";
import {
  createRestConsumer,
  deleteRestConsumer,
  fetchRecordsRest,
  subscribeRest,
  type RestRecord,
} from "@silo/engine/kafka/rest-client";
import { processRecord, sleep } from "./processor";

console.log("[worker] Starting Silo Worker...");

function getTopicsToSubscribe(): string[] {
  const envTopic = config.kafka.topic;
  const cliTopic = (process.argv[2] || "").trim();
  const singleTopic =
    envTopic.length > 0
      ? envTopic
      : cliTopic.length > 0
        ? cliTopic
        : undefined;
  if (singleTopic) return [singleTopic];
  return config.kafka.topics;
}

async function runConsumer() {
  if (!config.kafka.restProxyUrl) {
    console.error(
      "KAFKA_REST_PROXY_URL must be configured. Kafka access is REST Proxy only.",
    );
    process.exit(1);
  }

  const topicsToSubscribe = getTopicsToSubscribe();
  if (topicsToSubscribe.length === 0) {
    console.error(
      "Configure KAFKA_TOPIC or KAFKA_TOPICS with at least one topic.",
    );
    process.exit(1);
  }

  const groupSuffix =
    topicsToSubscribe.length === 1 ? `-${topicsToSubscribe[0]}` : "";
  const groupId = `${config.kafka.groupId}${groupSuffix}`;
  const instance = await createRestConsumer(groupId);

  try {
    await subscribeRest(instance, topicsToSubscribe);
    console.log(
      `Kafka REST consumer started for group ${groupId} topics=${topicsToSubscribe.join(",")}`,
    );

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

