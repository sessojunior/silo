import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const threadId = "550e8400-e29b-41d4-a716-446655440100";
const now = new Date("2026-07-21T12:00:00.000Z");

const mocks = vi.hoisted(() => {
  const returning = vi.fn();
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values }));
  const updateReturning = vi.fn();
  const updateWhere = vi.fn(() => ({ returning: updateReturning }));
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));
  const tx = { insert, update };

  return {
    config: {
      ollama: {
        model: "qwen-test",
        url: "http://ollama:11434",
        timeoutMs: 1000,
        maxConcurrentRequests: 1,
      },
    },
    db: {
      transaction: vi.fn(),
      insert,
      update,
      select: vi.fn(),
      execute: vi.fn(),
    },
    tx,
    values,
    returning,
    updateReturning,
    findCachedAssistantResponse: vi.fn(),
    saveAssistantResponseEmbedding: vi.fn(),
    chatWithOllama: vi.fn(),
    chatWithOllamaStream: vi.fn(),
    classifyScopeByEmbedding: vi.fn(),
    buildRagContext: vi.fn(),
    formatRagContextForPrompt: vi.fn(),
    getAvailabilityReport: vi.fn(),
    getExecutiveReport: vi.fn(),
    getProblemsReport: vi.fn(),
    getProjectsReport: vi.fn(),
    generatePdf: vi.fn(),
    getDashboardSummary: vi.fn(),
    getDashboardProblemsCauses: vi.fn(),
    getDashboardProblemsSolutions: vi.fn(),
  };
});

vi.mock("@silo/engine/config", () => ({
  config: mocks.config,
}));

vi.mock("@silo/database", () => ({
  db: mocks.db,
}));

vi.mock("@silo/database/schema", () => ({
  aiAssistantMessage: {
    id: "ai_assistant_message.id",
    threadId: "ai_assistant_message.thread_id",
    createdAt: "ai_assistant_message.created_at",
    metadata: "ai_assistant_message.metadata",
  },
  aiAssistantThread: {
    id: "ai_assistant_thread.id",
    userId: "ai_assistant_thread.user_id",
    title: "ai_assistant_thread.title",
    lastMessageAt: "ai_assistant_thread.last_message_at",
    updatedAt: "ai_assistant_thread.updated_at",
    messageCount: "ai_assistant_thread.message_count",
  },
}));

vi.mock("./ai-assistant-cache-service", () => ({
  findCachedAssistantResponse: mocks.findCachedAssistantResponse,
  saveAssistantResponseEmbedding: mocks.saveAssistantResponseEmbedding,
}));

vi.mock("../infra/llm/ollama-client", () => ({
  chatWithOllama: mocks.chatWithOllama,
  chatWithOllamaStream: mocks.chatWithOllamaStream,
}));

vi.mock("./ai-assistant-scope-embedding", () => ({
  classifyScopeByEmbedding: mocks.classifyScopeByEmbedding,
}));

vi.mock("./ai-assistant-rag-service", () => ({
  buildRagContext: mocks.buildRagContext,
  formatRagContextForPrompt: mocks.formatRagContextForPrompt,
}));

vi.mock("./report-service", () => ({
  getAvailabilityReport: mocks.getAvailabilityReport,
  getExecutiveReport: mocks.getExecutiveReport,
  getProblemsReport: mocks.getProblemsReport,
  getProjectsReport: mocks.getProjectsReport,
}));

vi.mock("./pdf-report-generator", () => ({
  generatePdf: mocks.generatePdf,
}));

vi.mock("./dashboard-service", () => ({
  getDashboardSummary: mocks.getDashboardSummary,
  getDashboardProblemsCauses: mocks.getDashboardProblemsCauses,
  getDashboardProblemsSolutions: mocks.getDashboardProblemsSolutions,
}));

import {
  sendAssistantMessage,
  sendAssistantMessageStream,
} from "./ai-assistant-thread-service";

const user = { id: "user-1", name: "Operador" };
const modelQuestion = "Quais modelos tiveram menor disponibilidade nos ultimos 30 dias?";

const threadRow = {
  id: threadId,
  userId: user.id,
  title: "Quais modelos tiveram menor disponibilidade nos ultimos 30 dias?",
  lastMessagePreview: "Resposta refinada",
  messageCount: 2,
  lastMessageAt: now,
  createdAt: now,
  updatedAt: now,
};

const availabilityFixture = {
  totalProducts: 1,
  avgAvailability: 80,
  totalInterventions: 1,
  products: [
    {
      id: "product-1",
      name: "BAM",
      slug: "bam",
      description: null,
      status: "stable",
      totalActivities: 10,
      completedActivities: 8,
      activeActivities: 1,
      failedActivities: 1,
      interventionsCount: 1,
      latestInterventionAt: "2026-07-21",
      latestInterventionText: "Reprocessamento",
      availabilityPercentage: 80,
      lastActivityDate: "2026-07-21",
    },
  ],
};

const executiveFixture = {
  summary: {
    totalProducts: 1,
    totalProblems: 1,
    totalSolutions: 1,
    totalProjects: 0,
  },
  topProducts: [
    {
      id: "product-1",
      name: "BAM",
      slug: "bam",
      totalProblems: 1,
      totalSolutions: 1,
      activityRate: 80,
    },
  ],
};

const dashboardSummaryFixture = {
  recentCount: 1,
  previousCount: 0,
  trend: null,
  topCategories: [{ name: "Infra", count: 1 }],
};

async function* successfulOllamaStream() {
  yield {
    token: JSON.stringify({
      thinking: "stream progress",
      answer: "Resposta refinada via stream",
      contextSummary: "Resumo via stream",
    }),
    done: false,
  };
  yield { token: "", done: true };
}

const getInsertedAssistantMessages = (): Array<Record<string, unknown>> => {
  const calls = mocks.values.mock.calls as unknown[][];

  return calls
    .flatMap(([value]) => (Array.isArray(value) ? value : [value]))
    .filter(
      (value): value is Record<string, unknown> =>
        typeof value === "object" &&
        value !== null &&
        (value as { senderType?: unknown }).senderType === "assistant",
    );
};

describe("AI assistant Ollama call counts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    mocks.db.transaction.mockImplementation(async (callback) => callback(mocks.tx));
    mocks.returning.mockResolvedValue([threadRow]);
    mocks.updateReturning.mockResolvedValue([threadRow]);
    mocks.findCachedAssistantResponse.mockResolvedValue(null);
    mocks.saveAssistantResponseEmbedding.mockResolvedValue(undefined);
    mocks.classifyScopeByEmbedding.mockResolvedValue(null);
    mocks.buildRagContext.mockResolvedValue({
      similarProblems: [],
      similarSolutions: [],
      manualChunks: [],
      helpContent: null,
    });
    mocks.formatRagContextForPrompt.mockReturnValue("");
    mocks.getAvailabilityReport.mockResolvedValue(availabilityFixture);
    mocks.getExecutiveReport.mockResolvedValue(executiveFixture);
    mocks.getProblemsReport.mockResolvedValue({
      totalProblems: 0,
      avgResolutionHours: 0,
      problemsByCategory: [],
      productsWithProblems: [],
      topProblems: [],
    });
    mocks.getProjectsReport.mockResolvedValue({
      summary: {
        totalProjects: 0,
        totalActivities: 0,
        totalTasks: 0,
        avgProgress: 0,
      },
      projectsWithProgress: [],
      tasksByStatus: {},
    });
    mocks.getDashboardSummary.mockResolvedValue(dashboardSummaryFixture);
    mocks.getDashboardProblemsCauses.mockResolvedValue({
      labels: [],
      values: [],
      colors: [],
    });
    mocks.getDashboardProblemsSolutions.mockResolvedValue({
      categories: [],
      problems: [],
      solutions: [],
    });
    mocks.chatWithOllama.mockResolvedValue({
      content: JSON.stringify({
        thinking: "analise interna",
        answer: "Resposta refinada",
        contextSummary: "Resumo refinado",
      }),
      latencyMs: 10,
      generatedTokens: 12,
      thinkingTimeMs: 3,
    });
    mocks.chatWithOllamaStream.mockImplementation(successfulOllamaStream);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sync path performs one non-streaming Ollama refinement on cache miss", async () => {
    const response = await sendAssistantMessage(user, {
      content: modelQuestion,
      threadId: null,
    });

    expect(response.answer).toBe("Resposta refinada");
    expect(response).not.toHaveProperty("thinking");
    const assistantMessages = getInsertedAssistantMessages();
    expect(assistantMessages).toHaveLength(1);
    expect(assistantMessages[0]?.metadata).not.toHaveProperty("thinking");
    expect(JSON.stringify(response)).not.toContain("analise interna");
    expect(JSON.stringify(assistantMessages)).not.toContain("analise interna");
    const promptText = JSON.stringify(
      mocks.chatWithOllama.mock.calls[0]?.[0]?.messages,
    );
    expect(promptText).not.toContain('"thinking"');
    expect(promptText).not.toContain("raciocínio detalhado");
    expect(promptText).not.toContain("raciocínio COMPLETO");
    expect(mocks.chatWithOllama).toHaveBeenCalledTimes(1);
    expect(mocks.chatWithOllamaStream).not.toHaveBeenCalled();
  });

  it("live SSE path currently performs two refinements: one non-streaming and one streaming", async () => {
    const events: Array<{ event: string; data: unknown }> = [];
    const sendEvent = vi.fn((event: string, data: unknown) => {
      events.push({ event, data });
    });

    await sendAssistantMessageStream(
      user,
      { content: modelQuestion, threadId: null },
      sendEvent,
    );

    const eventNames = events.map((entry) => entry.event);
    expect(eventNames).toContain("result");
    expect(eventNames).not.toContain("connected");
    expect(eventNames.filter((event) => event === "result")).toHaveLength(1);
    expect(eventNames[eventNames.length - 1]).toBe("result");
    expect(JSON.stringify(events)).not.toContain("stream progress");
    expect(JSON.stringify(events)).not.toContain("analise interna");
    expect(events[events.length - 1]?.data).not.toHaveProperty("thinking");
    expect(getInsertedAssistantMessages()[0]?.metadata).not.toHaveProperty("thinking");

    const resultCallIndex = sendEvent.mock.calls.findIndex(
      ([event]) => event === "result",
    );
    const resultOrder = sendEvent.mock.invocationCallOrder[resultCallIndex];
    const lastPersistOrder = Math.max(...mocks.values.mock.invocationCallOrder);
    expect(resultOrder).toBeGreaterThan(lastPersistOrder);
    expect(mocks.chatWithOllama).toHaveBeenCalledTimes(1);
    expect(mocks.chatWithOllamaStream).toHaveBeenCalledTimes(1);
  });

  it("SSE cache hit does not call Ollama", async () => {
    mocks.findCachedAssistantResponse.mockResolvedValueOnce({
      content: "Resposta cacheada",
      thinking: "old private reasoning",
      similarity: 0.95,
      metadata: {
        scope: "models",
        isInScope: true,
        thinking: "old private reasoning",
        suggestedQuestions: [],
        citations: [],
        contextSummary: "Resumo cacheado",
      },
    });
    const events: Array<{ event: string; data: unknown }> = [];
    const sendEvent = vi.fn((event: string, data: unknown) => {
      events.push({ event, data });
    });

    await sendAssistantMessageStream(
      user,
      { content: modelQuestion, threadId: null },
      sendEvent,
    );

    expect(events.map((entry) => entry.event)).toEqual([
      "scope",
      "result",
    ]);
    expect(events.map((entry) => entry.event)).not.toContain("connected");
    expect(events[1]?.data).toMatchObject({
      threadId,
      answer: "Resposta cacheada",
      messageContent: "Resposta cacheada",
      scope: "models",
      isInScope: true,
      contextSummary: "Resumo cacheado",
      generation: {
        provider: "cache",
        model: "semantic-cache",
        status: "success",
        latencyMs: 0,
      },
    });
    expect(events[1]?.data).not.toHaveProperty("thinking");
    expect(JSON.stringify(events)).not.toContain("old private reasoning");
    expect(getInsertedAssistantMessages()[0]?.metadata).not.toHaveProperty("thinking");

    const resultCallIndex = sendEvent.mock.calls.findIndex(
      ([event]) => event === "result",
    );
    const resultOrder = sendEvent.mock.invocationCallOrder[resultCallIndex];
    const lastPersistOrder = Math.max(...mocks.values.mock.invocationCallOrder);
    expect(resultOrder).toBeGreaterThan(lastPersistOrder);
    expect(mocks.chatWithOllama).not.toHaveBeenCalled();
    expect(mocks.chatWithOllamaStream).not.toHaveBeenCalled();
  });

  it("fallback path counts the failed non-streaming Ollama call and keeps the base answer", async () => {
    mocks.chatWithOllama.mockRejectedValueOnce(new Error("Ollama unavailable"));

    const response = await sendAssistantMessage(user, {
      content: modelQuestion,
      threadId: null,
    });

    expect(response.answer).toContain("No recorte");
    expect(mocks.chatWithOllama).toHaveBeenCalledTimes(1);
    expect(mocks.chatWithOllamaStream).not.toHaveBeenCalled();
  });

  it("PDF generation failure omits visualization and still calls the four current report services", async () => {
    mocks.classifyScopeByEmbedding.mockResolvedValueOnce({
      scope: "generate_pdf",
      score: 0.99,
    });
    mocks.generatePdf.mockRejectedValueOnce(new Error("PDF unavailable"));

    const response = await sendAssistantMessage(user, {
      content: "gerar pdf executivo",
      threadId: null,
    });

    expect(response.scope).toBe("generate_pdf");
    expect(response.visualization).toBeUndefined();
    expect(JSON.stringify(response)).not.toContain('"src":""');
    expect(mocks.generatePdf).toHaveBeenCalledTimes(1);
    expect(mocks.getExecutiveReport).toHaveBeenCalledTimes(1);
    expect(mocks.getProblemsReport).toHaveBeenCalledTimes(1);
    expect(mocks.getAvailabilityReport).toHaveBeenCalledTimes(1);
    expect(mocks.getProjectsReport).toHaveBeenCalledTimes(1);
  });
});
