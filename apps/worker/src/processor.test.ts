import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  RestConsumerInstance,
  RestRecord,
} from "@silo/engine/kafka/rest-client";

const mocks = vi.hoisted(() => {
  const insertValues = vi.fn();
  const tx = {
    insert: vi.fn(() => ({ values: insertValues })),
  };

  return {
    config: {
      kafka: {
        dlqPrefix: "dlq.",
        processRetryCount: 2,
        retryBackoffMs: 1,
      },
    },
    dbTransaction: vi.fn(),
    tx,
    insertValues,
    handler: vi.fn(),
    getHandlerForTopic: vi.fn(),
    commitOffsetsRest: vi.fn(),
    produceRecordRest: vi.fn(),
  };
});

vi.mock("@silo/engine/config", () => ({
  config: mocks.config,
}));

vi.mock("@silo/database", () => ({
  db: {
    transaction: mocks.dbTransaction,
  },
}));

vi.mock("@silo/database/schema", () => ({
  kafkaProcessedMessages: {},
}));

vi.mock("@silo/engine/kafka/rest-client", () => ({
  commitOffsetsRest: mocks.commitOffsetsRest,
  produceRecordRest: mocks.produceRecordRest,
}));

vi.mock("./handlers/topic-handlers", () => ({
  getHandlerForTopic: mocks.getHandlerForTopic,
}));

import { processRecord } from "./processor";

const instance: RestConsumerInstance = {
  groupId: "worker-group",
  instanceId: "worker-instance",
  baseUri: "http://kafka/consumers/worker-group/instances/worker-instance",
};

function buildRecord(value: unknown, offset = "41"): RestRecord {
  return {
    topic: "model.status",
    partition: 3,
    offset,
    key: "record-key",
    value,
  };
}

function expectCommitNextOffset(offset = "42") {
  expect(mocks.commitOffsetsRest).toHaveBeenCalledWith(instance, [
    {
      topic: "model.status",
      partition: 3,
      offset,
    },
  ]);
}

describe("worker processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.config.kafka.dlqPrefix = "dlq.";
    mocks.config.kafka.processRetryCount = 2;
    mocks.config.kafka.retryBackoffMs = 1;
    mocks.dbTransaction.mockImplementation(async (callback) => callback(mocks.tx));
    mocks.insertValues.mockResolvedValue(undefined);
    mocks.getHandlerForTopic.mockReturnValue(mocks.handler);
    mocks.handler.mockResolvedValue(undefined);
    mocks.commitOffsetsRest.mockResolvedValue(undefined);
    mocks.produceRecordRest.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends invalid JSON to DLQ and commits the next offset", async () => {
    await processRecord(instance, buildRecord("{invalid-json"));

    expect(mocks.produceRecordRest).toHaveBeenCalledWith(
      "dlq.model.status",
      "{invalid-json",
      undefined,
    );
    expect(mocks.dbTransaction).not.toHaveBeenCalled();
    expectCommitNextOffset();
  });

  it("sends records without message id to DLQ and commits the next offset", async () => {
    await processRecord(instance, buildRecord({ payload: "without-id" }));

    expect(mocks.produceRecordRest).toHaveBeenCalledWith(
      "dlq.model.status",
      JSON.stringify({ payload: "without-id" }),
      undefined,
    );
    expect(mocks.dbTransaction).not.toHaveBeenCalled();
    expectCommitNextOffset();
  });

  it("treats duplicate processed messages as handled and commits", async () => {
    mocks.insertValues.mockRejectedValueOnce({ code: "23505" });

    await processRecord(instance, buildRecord({ message_id: "message-1" }));

    expect(mocks.handler).not.toHaveBeenCalled();
    expect(mocks.produceRecordRest).not.toHaveBeenCalled();
    expectCommitNextOffset();
  });

  it("processes a valid record inside a transaction and commits", async () => {
    await processRecord(instance, buildRecord({ message_id: "message-1" }));

    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "model.status",
        messageId: "message-1",
      }),
    );
    expect(mocks.handler).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "model.status",
        partition: 3,
        messageId: "message-1",
        payload: { message_id: "message-1" },
        tx: mocks.tx,
      }),
    );
    expect(mocks.produceRecordRest).not.toHaveBeenCalled();
    expectCommitNextOffset();
  });

  it("retries a failing handler before committing success", async () => {
    mocks.handler
      .mockRejectedValueOnce(new Error("transient handler failure"))
      .mockResolvedValueOnce(undefined);

    await processRecord(instance, buildRecord({ messageId: "message-2" }));

    expect(mocks.dbTransaction).toHaveBeenCalledTimes(2);
    expect(mocks.handler).toHaveBeenCalledTimes(2);
    expect(mocks.produceRecordRest).not.toHaveBeenCalled();
    expectCommitNextOffset();
  });

  it("sends a permanently failing message to DLQ and commits", async () => {
    mocks.handler.mockRejectedValue(new Error("permanent handler failure"));

    await processRecord(instance, buildRecord({ id: "message-3" }));

    expect(mocks.handler).toHaveBeenCalledTimes(2);
    expect(mocks.produceRecordRest).toHaveBeenCalledWith(
      "dlq.model.status",
      JSON.stringify({ id: "message-3" }),
      "message-3",
    );
    expectCommitNextOffset();
  });

  it("does not commit when DLQ fails for an invalid record", async () => {
    mocks.produceRecordRest.mockRejectedValueOnce(new Error("DLQ unavailable"));

    await processRecord(instance, buildRecord("{invalid-json"));

    expect(mocks.produceRecordRest).toHaveBeenCalledOnce();
    expect(mocks.commitOffsetsRest).not.toHaveBeenCalled();
  });

  it("does not commit when DLQ fails after processing retries are exhausted", async () => {
    mocks.handler.mockRejectedValue(new Error("permanent handler failure"));
    mocks.produceRecordRest.mockRejectedValueOnce(new Error("DLQ unavailable"));

    await processRecord(instance, buildRecord({ message_id: "message-4" }));

    expect(mocks.handler).toHaveBeenCalledTimes(2);
    expect(mocks.produceRecordRest).toHaveBeenCalledOnce();
    expect(mocks.commitOffsetsRest).not.toHaveBeenCalled();
  });
});
