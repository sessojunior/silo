import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dbExecute: vi.fn(),
  generateEmbedding: vi.fn(),
}));

vi.mock("@silo/database", () => ({
  db: {
    execute: mocks.dbExecute,
  },
}));

vi.mock("../infra/llm/embedding-client", () => ({
  generateEmbedding: mocks.generateEmbedding,
}));

import {
  findCachedAssistantResponse,
  saveAssistantResponseEmbedding,
} from "./ai-assistant-cache-service";

function serializeSql(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const chunks = (value as { queryChunks?: unknown[] }).queryChunks;
  if (Array.isArray(chunks)) {
    return chunks.map(serializeSql).join(" ");
  }

  return Object.values(value as Record<string, unknown>)
    .map(serializeSql)
    .join(" ");
}

describe("AI assistant semantic cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    mocks.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("scopes lookup by user id through ai_assistant_thread", async () => {
    const question = "mesma pergunta";
    mocks.dbExecute
      .mockResolvedValueOnce({
        rows: [
          {
            content: "resposta do user-a",
            metadata: { scope: "models", thinking: "antigo" },
            similarity: 0.96,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const userAResult = await findCachedAssistantResponse("user-a", question);
    const userBResult = await findCachedAssistantResponse("user-b", question);

    expect(userAResult?.content).toBe("resposta do user-a");
    expect(userBResult).toBeNull();
    expect(mocks.generateEmbedding).toHaveBeenCalledWith(question);
    expect(mocks.generateEmbedding).toHaveBeenCalledTimes(2);
    expect(mocks.dbExecute).toHaveBeenCalledTimes(2);

    const sqlText = serializeSql(mocks.dbExecute.mock.calls[0]?.[0]);
    expect(sqlText).toContain("INNER JOIN ai_assistant_thread");
    expect(sqlText).toContain("t.user_id");
  });

  it("parameterizes message id when saving response embedding", async () => {
    mocks.dbExecute.mockResolvedValueOnce({ rows: [] });

    await saveAssistantResponseEmbedding(
      "550e8400-e29b-41d4-a716-446655440000",
      "resposta",
    );

    expect(mocks.dbExecute).toHaveBeenCalledOnce();
    const sqlText = serializeSql(mocks.dbExecute.mock.calls[0]?.[0]);
    expect(sqlText).toContain("UPDATE ai_assistant_message");
    expect(sqlText).toContain("WHERE id =");
  });

  it("does not use sql.raw in the cache service", () => {
    const source = readFileSync(
      new URL("./ai-assistant-cache-service.ts", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain("sql.raw");
  });
});
