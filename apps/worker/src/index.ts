import "dotenv/config";

import { pathToFileURL } from "node:url";

import { config } from "@silo/engine/config";
import {
  createRestConsumer,
  deleteRestConsumer,
  fetchRecordsRest,
  subscribeRest,
  type RestRecord,
} from "@silo/engine/kafka/rest-client";
import { processRecord, sleep } from "./processor";
import { initOllama } from "./lib/ollama-init";

export type ShutdownState = {
  stopRequested: boolean;
};

type SignalTarget = {
  once(event: "SIGINT" | "SIGTERM", listener: () => void): unknown;
  off(event: "SIGINT" | "SIGTERM", listener: () => void): unknown;
};

export function createShutdownState(): ShutdownState {
  return { stopRequested: false };
}

export function requestShutdown(state: ShutdownState): void {
  state.stopRequested = true;
}

export function installShutdownHandlers(
  state: ShutdownState,
  target: SignalTarget = process,
): () => void {
  const onSigint = () => {
    console.log("SIGINT received, shutting down kafka REST consumer...");
    requestShutdown(state);
  };
  const onSigterm = () => {
    console.log("SIGTERM received, shutting down kafka REST consumer...");
    requestShutdown(state);
  };

  target.once("SIGINT", onSigint);
  target.once("SIGTERM", onSigterm);

  return () => {
    target.off("SIGINT", onSigint);
    target.off("SIGTERM", onSigterm);
  };
}

export function getTopicsToSubscribe(): string[] {
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

export async function runConsumer(
  shutdownState: ShutdownState = createShutdownState(),
) {
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

    while (!shutdownState.stopRequested) {
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

export async function main() {
  console.log("[worker] Starting Silo Worker...");
  const shutdownState = createShutdownState();
  const removeShutdownHandlers = installShutdownHandlers(shutdownState);

  try {
    try {
      await initOllama();
    } catch (error) {
      console.error("[WORKER] Falha na inicialização do Ollama:", error);
      console.warn("[WORKER] Continuando sem Ollama — o assistente AI operará em fallback.");
    }

    await runConsumer(shutdownState);
  } finally {
    removeShutdownHandlers();
  }
}

const entrypoint = process.argv[1];
const isMainModule =
  typeof entrypoint === "string" &&
  import.meta.url === pathToFileURL(entrypoint).href;

if (isMainModule) {
  main().catch((error) => {
    console.error("Kafka REST consumer failed:", error);
    process.exit(1);
  });
}
