import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  RestConsumerInstance,
  RestRecord,
} from "@silo/engine/kafka/rest-client";

const mocks = vi.hoisted(() => ({
  config: {
    kafka: {
      restProxyUrl: "http://kafka",
      topic: "",
      topics: ["model.status"],
      groupId: "silo-worker",
    },
  },
  createRestConsumer: vi.fn(),
  subscribeRest: vi.fn(),
  fetchRecordsRest: vi.fn(),
  deleteRestConsumer: vi.fn(),
  processRecord: vi.fn(),
  sleep: vi.fn(),
  initOllama: vi.fn(),
}));

vi.mock("@silo/engine/config", () => ({
  config: mocks.config,
}));

vi.mock("@silo/engine/kafka/rest-client", () => ({
  createRestConsumer: mocks.createRestConsumer,
  subscribeRest: mocks.subscribeRest,
  fetchRecordsRest: mocks.fetchRecordsRest,
  deleteRestConsumer: mocks.deleteRestConsumer,
}));

vi.mock("./processor", () => ({
  processRecord: mocks.processRecord,
  sleep: mocks.sleep,
}));

vi.mock("./lib/ollama-init", () => ({
  initOllama: mocks.initOllama,
}));

import {
  createShutdownState,
  installShutdownHandlers,
  runConsumer,
} from "./index";

const instance: RestConsumerInstance = {
  groupId: "silo-worker-model.status",
  instanceId: "worker-instance",
  baseUri: "http://kafka/consumers/silo-worker-model.status/instances/worker-instance",
};

const record: RestRecord = {
  topic: "model.status",
  partition: 0,
  offset: "1",
  value: { message_id: "message-1" },
};

describe("worker shutdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    mocks.config.kafka.restProxyUrl = "http://kafka";
    mocks.config.kafka.topic = "";
    mocks.config.kafka.topics = ["model.status"];
    mocks.config.kafka.groupId = "silo-worker";
    mocks.createRestConsumer.mockResolvedValue(instance);
    mocks.subscribeRest.mockResolvedValue(undefined);
    mocks.fetchRecordsRest.mockResolvedValue([]);
    mocks.deleteRestConsumer.mockResolvedValue(undefined);
    mocks.processRecord.mockResolvedValue(undefined);
    mocks.sleep.mockResolvedValue(undefined);
  });

  it("removes the REST consumer after SIGTERM instead of exiting before finally", async () => {
    const shutdownState = createShutdownState();
    const signalTarget = new EventEmitter();
    const removeHandlers = installShutdownHandlers(
      shutdownState,
      signalTarget as never,
    );

    mocks.fetchRecordsRest.mockImplementationOnce(async () => {
      signalTarget.emit("SIGTERM");
      return [record];
    });

    try {
      await runConsumer(shutdownState);
    } finally {
      removeHandlers();
    }

    expect(mocks.processRecord).toHaveBeenCalledWith(instance, record);
    expect(mocks.deleteRestConsumer).toHaveBeenCalledWith(instance);
  });
});
