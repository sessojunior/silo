import { describe, expect, it } from "vitest";
import {
  AiAssistantMessageResponseSchema,
  AiAssistantScopeSchema,
  type AiAssistantMessageResponseDto,
} from "@silo/engine/contracts/dto/ai-assistant";

import {
  AssistantSseStreamParser,
  buildLegacyAssistantSseResult,
  parseAssistantSseFrame,
  parseAssistantSseEvent,
} from "./ai-assistant-sse";

describe("AI assistant SSE compatibility parser", () => {
  it("accepts the products scope and incremental deltas", () => {
    expect(AiAssistantScopeSchema.parse("products")).toBe("products");
    expect(parseAssistantSseEvent("delta", { content: "parcial" })).toEqual({
      type: "delta",
      content: "parcial",
    });
  });

  it("rejects malformed terminal result payloads", () => {
    expect(parseAssistantSseEvent("result", { answer: "incompleta" })).toEqual({
      type: "error",
      message: "Resposta inválida recebida do assistente.",
    });
  });

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
    expect(AiAssistantMessageResponseSchema.safeParse(payload).success).toBe(true);
  });

  it("accepts the full result emitted by the running API", () => {
    const payload = {
      threadId: "73e5e1d6-5de4-456b-8c03-ff0a94e3f20b",
      userMessageId: "6af51e58-97ac-49ee-93c0-d952e03ff136",
      thread: {
        id: "73e5e1d6-5de4-456b-8c03-ff0a94e3f20b",
        title: "teste",
        lastMessagePreview: "O recorte 2026-09-16 a 2026-10-15 mostra 4 projetos.",
        messageCount: 2,
        lastMessageAt: "2026-10-15T12:13:55.232Z",
        createdAt: "2026-09-01T19:05:15.127Z",
        updatedAt: "2026-10-15T12:13:55.239Z",
      },
      messageContent: null,
      scope: "products" as const,
      isInScope: true,
      refusalReason: null,
      answer: "O SILO possui 5 produtos cadastrados.",
      thinking: "Preparei a resposta final.",
      suggestedQuestions: ["Quais produtos estão ativos no momento?"],
      citations: [
        {
          label: "Catálogo de produtos",
          detail: "2026-09-16 a 2026-10-15",
          source: null,
          sourceId: null,
          snippet: null,
          score: null,
        },
      ],
      visualization: null,
      artifacts: null,
      generation: {
        provider: "vllm",
        model: "Qwen/Qwen2.5-0.5B-Instruct",
        status: "fallback" as const,
        latencyMs: 1441,
        generatedTokens: null,
        thinkingTimeMs: null,
        errorMessage: "Não foi possível acessar o modelo vLLM neste momento.",
      },
      contextSummary: "scope=products; range=2026-09-16..2026-10-15",
    };

    expect(parseAssistantSseEvent("result", payload)).toMatchObject({
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
      citations: [
        {
          label: "Manual",
          detail: "Trecho autorizado",
          source: "manual",
          sourceId: "manual-1",
          snippet: "Trecho autorizado do manual.",
          score: 0.91,
        },
      ],
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
      citations: [
        {
          label: "Manual",
          detail: "Trecho autorizado",
          source: "manual",
          sourceId: "manual-1",
          snippet: "Trecho autorizado do manual.",
          score: 0.91,
        },
      ],
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
