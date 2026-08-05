import { describe, expect, it } from "vitest";
import type { AiAssistantMessageResponseDto } from "@silo/engine/contracts/dto/ai-assistant";

import {
  AssistantSseStreamParser,
  buildLegacyAssistantSseResult,
  parseAssistantSseFrame,
  parseAssistantSseEvent,
} from "./ai-assistant-sse";

describe("AI assistant SSE compatibility parser", () => {
  it("accepts the repaired result terminal event", () => {
    const payload = {
      threadId: "thread-1",
      answer: "Resposta final",
      messageContent: "Resposta final",
      scope: "models" as const,
      isInScope: true,
      suggestedQuestions: [],
      citations: [],
      artifacts: [
        {
          kind: "pdf",
          url: "/api/upload/serve/reports/ai-executive-test.pdf",
          filename: "ai-executive-test.pdf",
          title: "Relatório executivo",
          mimeType: "application/pdf",
          reportType: "executive",
          checksum: "abc123",
          byteSize: 1024,
        },
      ],
      contextSummary: "Resumo",
      generation: {
        provider: "cache",
        model: "semantic-cache",
        status: "success",
        latencyMs: 0,
        errorMessage: null,
      },
    } as const;

    expect(parseAssistantSseEvent("result", payload)).toEqual({
      type: "result",
      data: payload,
    });
  });

  it("accepts legacy data followed by complete as a final answer", () => {
    const legacyData: Partial<AiAssistantMessageResponseDto> = {
      answer: "Resposta cacheada",
      thinking: "Progresso legado",
      scope: "models",
      isInScope: true,
      suggestedQuestions: ["Pergunta seguinte"],
      citations: [{ label: "Fonte", detail: "Detalhe" }],
      artifacts: [
        {
          kind: "pdf",
          url: "/api/upload/serve/reports/ai-executive-test.pdf",
          filename: "ai-executive-test.pdf",
          title: "Relatório executivo",
          mimeType: "application/pdf",
          reportType: "executive",
          checksum: "abc123",
          byteSize: 1024,
        },
      ],
      contextSummary: "Resumo legado",
    };

    expect(parseAssistantSseEvent("data", legacyData)).toEqual({
      type: "legacy-data",
      data: legacyData,
    });
    expect(parseAssistantSseEvent("complete", {})).toEqual({
      type: "legacy-complete",
    });

    expect(
      buildLegacyAssistantSseResult(legacyData, "thread-atual", ""),
    ).toMatchObject({
      threadId: "thread-atual",
      answer: "Resposta cacheada",
      messageContent: "Resposta cacheada",
      thinking: "Progresso legado",
      scope: "models",
      isInScope: true,
      suggestedQuestions: ["Pergunta seguinte"],
      citations: [{ label: "Fonte", detail: "Detalhe" }],
      artifacts: legacyData.artifacts,
      contextSummary: "Resumo legado",
    });
  });

  it("reassembles fragmented frames and ignores heartbeat comments", () => {
    const parser = new AssistantSseStreamParser();

    const payload = {
      threadId: "thread-1",
      answer: "Resposta final",
      messageContent: "Resposta final",
      scope: "models",
      isInScope: true,
      suggestedQuestions: [],
      citations: [],
      contextSummary: "Resumo",
    };

    const actions = [
      ...parser.pushChunk("event: connected\ndata: {\"status\":\"processing\"}\n\n"),
      ...parser.pushChunk(": heartbeat\n\n"),
      ...parser.pushChunk("event: result\n"),
      ...parser.pushChunk("data: {\n"),
      ...parser.pushChunk('data:   "threadId": "thread-1",\n'),
      ...parser.pushChunk('data:   "answer": "Resposta final",\n'),
      ...parser.pushChunk('data:   "messageContent": "Resposta final",\n'),
      ...parser.pushChunk('data:   "scope": "models",\n'),
      ...parser.pushChunk('data:   "isInScope": true,\n'),
      ...parser.pushChunk('data:   "suggestedQuestions": [],\n'),
      ...parser.pushChunk('data:   "citations": [],\n'),
      ...parser.pushChunk('data:   "contextSummary": "Resumo"\n'),
      ...parser.pushChunk("data: }\n\n"),
      ...parser.flush(),
    ].filter((action) => action.type !== "ignore");

    expect(actions).toEqual([
      { type: "result", data: payload },
    ]);
  });

  it("turns malformed error frames into terminal errors", () => {
    expect(
      parseAssistantSseFrame(["event: error", "data: { not-json"]),
    ).toEqual({
      type: "error",
      message: "{ not-json",
    });
  });

  it("preserves an explicit empty artifacts array in legacy fallback", () => {
    const legacyData: Partial<AiAssistantMessageResponseDto> = {
      answer: "Resposta cacheada",
      scope: "models",
      isInScope: true,
      suggestedQuestions: [],
      citations: [],
      artifacts: [],
      contextSummary: "Resumo legado",
    };

    expect(
      buildLegacyAssistantSseResult(legacyData, "thread-atual", ""),
    ).toMatchObject({
      artifacts: [],
    });
  });

  it("does not fabricate a legacy final answer without answer content", () => {
    expect(buildLegacyAssistantSseResult({}, "thread-atual", "")).toBeNull();
  });
});
