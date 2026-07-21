import { describe, expect, it } from "vitest";
import type { AiAssistantMessageResponseDto } from "@silo/engine/contracts/dto/ai-assistant";

import {
  buildLegacyAssistantSseResult,
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
      contextSummary: "Resumo legado",
    });
  });

  it("does not fabricate a legacy final answer without answer content", () => {
    expect(buildLegacyAssistantSseResult({}, "thread-atual", "")).toBeNull();
  });
});
