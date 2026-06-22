import { randomUUID } from "node:crypto";
import { unlink } from "node:fs";
import path from "node:path";

import { db } from "@silo/database";
import {
  aiAssistantMessage,
  aiAssistantThread,
} from "@silo/database/schema";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import {
  AI_ASSISTANT_SCOPES,
  AiAssistantCreateThreadResponseDto,
  AiAssistantGenerationDto,
  AiAssistantMessageRequestDto,
  AiAssistantMessageResponseDto,
  AiAssistantScope,
  AiAssistantThreadDetailResponseDto,
  AiAssistantThreadMessageDto,
  AiAssistantThreadSummaryDto,
  AiAssistantThreadsResponseDto,
  AiAssistantVisualizationDto,
  AiAssistantVisualizationSchema,
} from "@silo/engine/contracts/dto/ai-assistant";
import {
  answerAssistantMessage as generateAssistantMessage,
  getAssistantExamples,
} from "./ai-assistant-service.js";
import {
  findCachedAssistantResponse,
  saveAssistantResponseEmbedding,
} from "./ai-assistant-cache-service.js";
import type { OllamaChatMessage } from "../infra/llm/ollama-client.js";

const ASSISTANT_SENDER_NAME = "Assistente de IA";
const DEFAULT_THREAD_TITLE = "Nova conversa";
const THREAD_TITLE_MAX_LENGTH = 64;
const MESSAGE_PREVIEW_MAX_LENGTH = 120;
const ASSISTANT_SCOPE_SET = new Set<string>(AI_ASSISTANT_SCOPES);

/**
 * Número máximo de mensagens do histórico enviadas para o LLM como contexto.
 * Mantém apenas as trocas mais recentes, evitando estouro de tokens
 * e mantendo o foco na conversa atual.
 */
const MAX_CONTEXT_MESSAGES = 25; // aumentado para incluir mais contexto de memória

type ConversationContext = {
  historyMessages: OllamaChatMessage[];
  conversationMemory: string | null;
  lastKnownScope: AiAssistantScope | null;
};

export class AssistantThreadNotFoundError extends Error {
  constructor() {
    super("Conversa não encontrada.");
    this.name = "AssistantThreadNotFoundError";
  }
}

const normalizeDisplayText = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

const truncateText = (value: string, maxLength: number): string => {
  const normalized = normalizeDisplayText(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
};

const buildThreadTitle = (content: string): string => {
  const title = truncateText(content, THREAD_TITLE_MAX_LENGTH);
  return title.length > 0 ? title : DEFAULT_THREAD_TITLE;
};

const buildMessagePreview = (content: string): string =>
  truncateText(content, MESSAGE_PREVIEW_MAX_LENGTH);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readStringValue = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const readNumberValue = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
};

const readStoredGenerationMetadata = (
  metadata: unknown,
): Record<string, unknown> | null => {
  if (!isRecord(metadata)) {
    return null;
  }

  const generation = metadata.generation;
  if (!isRecord(generation)) {
    return null;
  }

  return generation;
};

const isAssistantScope = (value: string): value is AiAssistantScope =>
  ASSISTANT_SCOPE_SET.has(value);

const readAssistantScopeValue = (value: unknown): AiAssistantScope | null => {
  const candidate = readStringValue(value);
  return candidate && isAssistantScope(candidate) ? candidate : null;
};

const readConversationMemoryValue = (metadata: unknown): string | null => {
  if (!isRecord(metadata)) {
    return null;
  }

  return readStringValue(metadata.contextSummary);
};

const normalizeGenerationMetadata = (
  generation: AiAssistantGenerationDto | undefined,
): {
  provider: string | null;
  model: string | null;
  generationStatus: string | null;
  latencyMs: number | null;
  generatedTokens: number | null;
  thinkingTimeMs: number | null;
  errorMessage: string | null;
} => ({
  provider: generation?.provider ?? null,
  model: generation?.model ?? null,
  generationStatus: generation?.status ?? null,
  latencyMs: generation?.latencyMs ?? null,
  generatedTokens: generation?.generatedTokens ?? null,
  thinkingTimeMs: generation?.thinkingTimeMs ?? null,
  errorMessage: generation?.errorMessage ?? null,
});

const normalizeThreadMessageVisualization = (
  message: typeof aiAssistantMessage.$inferSelect,
): AiAssistantVisualizationDto | undefined => {
  const storedVisualization = isRecord(message.metadata)
    ? message.metadata.visualization
    : undefined;

  const parsedVisualization = AiAssistantVisualizationSchema.safeParse(
    storedVisualization,
  );

  return parsedVisualization.success ? parsedVisualization.data : undefined;
};

const buildAssistantMessageMetadata = (
  response: AiAssistantMessageResponseDto,
  generationMetadata: ReturnType<typeof normalizeGenerationMetadata>,
): Record<string, unknown> => {
  const metadata: Record<string, unknown> = {
    scope: response.scope,
    isInScope: response.isInScope,
    refusalReason: response.refusalReason,
    suggestedQuestions: response.suggestedQuestions,
    citations: response.citations,
    generation: generationMetadata,
    contextSummary: response.contextSummary,
  };

  if (response.thinking) {
    metadata.thinking = response.thinking;
  }

  if (response.visualization) {
    metadata.visualization = response.visualization;
  }

  return metadata;
};

const normalizeThreadMessageGeneration = (
  message: typeof aiAssistantMessage.$inferSelect,
): AiAssistantGenerationDto | undefined => {
  const storedGeneration = readStoredGenerationMetadata(message.metadata);

  const provider =
    readStringValue(storedGeneration?.provider) ?? readStringValue(message.provider);
  const model =
    readStringValue(storedGeneration?.model) ?? readStringValue(message.model);
  const status =
    readStringValue(storedGeneration?.status) ?? readStringValue(message.generationStatus);
  const latencyMs =
    readNumberValue(storedGeneration?.latencyMs) ?? message.latencyMs ?? null;

  if (!provider || !model || !status || latencyMs == null) {
    return undefined;
  }

  if (status !== "success" && status !== "fallback" && status !== "error") {
    return undefined;
  }

  const generatedTokens =
    status === "success" ? readNumberValue(storedGeneration?.generatedTokens) : null;
  const thinkingTimeMs =
    status === "success" ? readNumberValue(storedGeneration?.thinkingTimeMs) : null;

  const errorMessage =
    readStringValue(storedGeneration?.errorMessage) ?? message.errorMessage ?? null;

  return {
    provider,
    model,
    status,
    latencyMs,
    generatedTokens,
    thinkingTimeMs,
    errorMessage,
  };
};

const loadConversationContext = async (
  threadId: string,
): Promise<ConversationContext> => {
  const threadMessages = await db
    .select()
    .from(aiAssistantMessage)
    .where(eq(aiAssistantMessage.threadId, threadId))
    .orderBy(asc(aiAssistantMessage.createdAt), asc(aiAssistantMessage.id));

  const historyMessages: OllamaChatMessage[] = [];
  let conversationMemory: string | null = null;
  let lastKnownScope: AiAssistantScope | null = null;

  for (const message of threadMessages) {
    if (message.senderType === "assistant") {
      const storedScope = readAssistantScopeValue(
        isRecord(message.metadata) ? message.metadata.scope : null,
      );
      if (storedScope) {
        lastKnownScope = storedScope;
      }

      const memory = readConversationMemoryValue(message.metadata);
      if (memory) {
        conversationMemory = memory;
      }
    }

    historyMessages.push({
      role: message.senderType === "assistant" ? "assistant" : "user",
      content: message.content,
    });
  }

  /* 
   * Limita o histórico ao máximo de mensagens configurado.
   * Mantém apenas as trocas mais recentes para evitar estouro de tokens
   * e manter a janela de contexto focada na conversa atual do Silo.
   */
  const trimmedHistory = historyMessages.slice(-MAX_CONTEXT_MESSAGES);

  return {
    historyMessages: trimmedHistory,
    conversationMemory,
    lastKnownScope,
  };
};

const formatAssistantReply = (data: AiAssistantMessageResponseDto): string => {
  const lines = [data.answer.trim()];

  if (data.citations.length > 0) {
    lines.push("");
    lines.push("Baseado em:");
    for (const citation of data.citations) {
      lines.push(
        `- ${citation.label}${citation.detail ? `: ${citation.detail}` : ""}`,
      );
    }
  }

  if (data.suggestedQuestions.length > 0) {
    lines.push("");
    lines.push("Perguntas que eu posso continuar respondendo:");
    for (const suggestion of data.suggestedQuestions.slice(0, 3)) {
      lines.push(`- ${suggestion}`);
    }
  }

  return lines.join("\n");
};

const toThreadSummary = (
  thread: typeof aiAssistantThread.$inferSelect,
): AiAssistantThreadSummaryDto => ({
  id: thread.id,
  title: thread.title,
  lastMessagePreview: thread.lastMessagePreview,
  messageCount: thread.messageCount,
  lastMessageAt: thread.lastMessageAt.toISOString(),
  createdAt: thread.createdAt.toISOString(),
  updatedAt: thread.updatedAt.toISOString(),
});

const toThreadMessage = (
  message: typeof aiAssistantMessage.$inferSelect,
): AiAssistantThreadMessageDto => ({
  id: message.id,
  threadId: message.threadId,
  senderType: message.senderType === "assistant" ? "assistant" : "user",
  senderUserId: message.senderUserId,
  senderName: message.senderName,
  content: message.content,
  thinking: isRecord(message.metadata) ? (readStringValue(message.metadata.thinking) ?? undefined) : undefined,
  generation: normalizeThreadMessageGeneration(message),
  visualization: normalizeThreadMessageVisualization(message),
  createdAt: message.createdAt.toISOString(),
});

const getThreadById = async (
  userId: string,
  threadId: string,
): Promise<AiAssistantThreadSummaryDto | null> => {
  const [thread] = await db
    .select()
    .from(aiAssistantThread)
    .where(and(eq(aiAssistantThread.id, threadId), eq(aiAssistantThread.userId, userId)))
    .limit(1);

  if (!thread) return null;
  return toThreadSummary(thread);
};

const getThreadRowById = async (
  userId: string,
  threadId: string,
): Promise<typeof aiAssistantThread.$inferSelect | null> => {
  const [thread] = await db
    .select()
    .from(aiAssistantThread)
    .where(and(eq(aiAssistantThread.id, threadId), eq(aiAssistantThread.userId, userId)))
    .limit(1);

  return thread ?? null;
};

export function getAssistantExamplesResponse() {
  return getAssistantExamples();
}

export async function listAssistantThreads(
  userId: string,
): Promise<AiAssistantThreadsResponseDto> {
  const threads = await db
    .select()
    .from(aiAssistantThread)
    .where(eq(aiAssistantThread.userId, userId))
    .orderBy(desc(aiAssistantThread.lastMessageAt), desc(aiAssistantThread.updatedAt));

  return {
    threads: threads.map(toThreadSummary),
  };
}

export async function createAssistantThread(
  userId: string,
): Promise<AiAssistantCreateThreadResponseDto> {
  const threadId = randomUUID();
  const [thread] = await db
    .insert(aiAssistantThread)
    .values({
      id: threadId,
      userId,
      title: DEFAULT_THREAD_TITLE,
      lastMessagePreview: "",
      messageCount: 0,
    })
    .returning();

  return { thread: toThreadSummary(thread) };
}

export async function getAssistantThreadDetails(
  userId: string,
  threadId: string,
): Promise<AiAssistantThreadDetailResponseDto | null> {
  const thread = await getThreadById(userId, threadId);
  if (!thread) return null;

  const messages = await db
    .select()
    .from(aiAssistantMessage)
    .where(eq(aiAssistantMessage.threadId, thread.id))
    .orderBy(asc(aiAssistantMessage.createdAt), asc(aiAssistantMessage.id));

  return {
    thread,
    messages: messages.map(toThreadMessage),
  };
}

export async function sendAssistantMessage(
  user: { id: string; name: string },
  request: AiAssistantMessageRequestDto,
): Promise<AiAssistantMessageResponseDto> {
  const requestedThreadId = request.threadId ?? randomUUID();
  const existingThread = request.threadId
    ? await getThreadRowById(user.id, request.threadId)
    : null;

  if (request.threadId && !existingThread) {
    throw new AssistantThreadNotFoundError();
  }

  // Cache semântico: verifica se já existe resposta para pergunta similar.
  // Se hit, retorna imediatamente sem chamar Ollama nem coletar dados.
  if (!existingThread || existingThread.messageCount <= 4) {
    // Só usa cache em threads novas ou com poucas mensagens
    // (conversas longas têm contexto que o cache não captura)
    const cached = await findCachedAssistantResponse(request.content);
    if (cached) {
      const now = new Date();
      const threadTitle = buildThreadTitle(request.content);

      const thread = await db.transaction(async (tx) => {
        if (!existingThread) {
          const [insertedThread] = await tx
            .insert(aiAssistantThread)
            .values({
              id: requestedThreadId,
              userId: user.id,
              title: threadTitle,
              lastMessagePreview: buildMessagePreview(cached.content),
              messageCount: 2,
              lastMessageAt: now,
              createdAt: now,
              updatedAt: now,
            })
            .returning();
          return insertedThread;
        }

        const [updatedThread] = await tx
          .update(aiAssistantThread)
          .set({
            title: existingThread.title === DEFAULT_THREAD_TITLE ? threadTitle : existingThread.title,
            lastMessagePreview: buildMessagePreview(cached.content),
            messageCount: sql`${aiAssistantThread.messageCount} + 2`,
            lastMessageAt: now,
            updatedAt: now,
          })
          .where(and(eq(aiAssistantThread.id, existingThread.id), eq(aiAssistantThread.userId, user.id)))
          .returning();

        return updatedThread;
      });

      // Salva a mensagem do usuário e a resposta cacheada como mensagem do assistente
      await db.insert(aiAssistantMessage).values([
        {
          threadId: thread.id,
          senderType: "user",
          senderUserId: user.id,
          senderName: user.name,
          content: request.content.trim(),
          createdAt: now,
          metadata: {},
        },
        {
          threadId: thread.id,
          senderType: "assistant",
          senderUserId: null,
          senderName: ASSISTANT_SENDER_NAME,
          createdAt: new Date(now.getTime() + 1),
          provider: "cache",
          model: "semantic-cache",
          generationStatus: "success",
          latencyMs: 0,
          content: cached.content,
          metadata: {
            ...cached.metadata,
            cached: true,
            cacheSimilarity: cached.similarity,
          },
        },
      ]);

      return {
        threadId: thread.id,
        thread: toThreadSummary(thread),
        scope: (cached.metadata.scope as AiAssistantScope) ?? "general",
        isInScope: (cached.metadata.isInScope as boolean) ?? true,
        refusalReason: (cached.metadata.refusalReason as string) ?? null,
        answer: cached.content,
        thinking: cached.thinking ?? undefined,
        messageContent: cached.content,
        suggestedQuestions: (cached.metadata.suggestedQuestions as string[]) ?? [],
        citations: (cached.metadata.citations as AiAssistantMessageResponseDto["citations"]) ?? [],
        contextSummary: (cached.metadata.contextSummary as string) ?? "",
        generation: {
          provider: "cache",
          model: "semantic-cache",
          status: "success",
          latencyMs: 0,
          errorMessage: null,
        } satisfies AiAssistantGenerationDto,
      };
    }
  }

  const conversationContext = existingThread
    ? await loadConversationContext(existingThread.id)
    : {
        historyMessages: [],
        conversationMemory: null,
        lastKnownScope: null,
      };

  const generatedResponse = await generateAssistantMessage({
    threadId: requestedThreadId,
    content: request.content,
    historyMessages: conversationContext.historyMessages,
    conversationMemory: conversationContext.conversationMemory,
    lastKnownScope: conversationContext.lastKnownScope,
  });
  const generationMetadata = normalizeGenerationMetadata(generatedResponse.generation);
  const assistantMetadata = buildAssistantMessageMetadata(
    generatedResponse,
    generationMetadata,
  );
  const messageContent = formatAssistantReply(generatedResponse);
  const now = new Date();
  const nextThreadTitle = existingThread
    ? existingThread.messageCount === 0 || existingThread.title === DEFAULT_THREAD_TITLE
      ? buildThreadTitle(request.content)
      : existingThread.title
    : buildThreadTitle(request.content);

  let assistantMessageId: string | null = null;

  const thread = await db.transaction(async (tx) => {
    const userMessageCreatedAt = now;
    const assistantMessageCreatedAt = new Date(now.getTime() + 1);

    if (!existingThread) {
      const [insertedThread] = await tx
        .insert(aiAssistantThread)
        .values({
          id: requestedThreadId,
          userId: user.id,
          title: nextThreadTitle,
          lastMessagePreview: buildMessagePreview(generatedResponse.answer),
          messageCount: 2,
          lastMessageAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      // Gera IDs explícitos para capturar o ID da mensagem do assistente
      const generatedId = randomUUID();
      assistantMessageId = generatedId;

      await tx.insert(aiAssistantMessage).values([
        {
          id: randomUUID(),
          threadId: insertedThread.id,
          senderType: "user",
          senderUserId: user.id,
          senderName: user.name,
          content: request.content.trim(),
          createdAt: userMessageCreatedAt,
          metadata: {},
        },
        {
          id: generatedId,
          threadId: insertedThread.id,
          senderType: "assistant",
          senderUserId: null,
          senderName: ASSISTANT_SENDER_NAME,
          createdAt: assistantMessageCreatedAt,
          provider: generationMetadata.provider,
          model: generationMetadata.model,
          generationStatus: generationMetadata.generationStatus,
          latencyMs: generationMetadata.latencyMs,
          errorMessage: generationMetadata.errorMessage,
          content: messageContent,
          metadata: assistantMetadata,
        },
      ]);

      return insertedThread;
    }

    // Gera IDs explícitos para capturar o ID da mensagem do assistente
    const generatedId = randomUUID();
    assistantMessageId = generatedId;

    await tx.insert(aiAssistantMessage).values([
      {
        id: randomUUID(),
        threadId: existingThread.id,
        senderType: "user",
        senderUserId: user.id,
        senderName: user.name,
        content: request.content.trim(),
        createdAt: userMessageCreatedAt,
        metadata: {},
      },
      {
        id: generatedId,
        threadId: existingThread.id,
        senderType: "assistant",
        senderUserId: null,
        senderName: ASSISTANT_SENDER_NAME,
        createdAt: assistantMessageCreatedAt,
        provider: generationMetadata.provider,
        model: generationMetadata.model,
        generationStatus: generationMetadata.generationStatus,
        latencyMs: generationMetadata.latencyMs,
        errorMessage: generationMetadata.errorMessage,
        content: messageContent,
        metadata: assistantMetadata,
      },
    ]);

    const [updatedThread] = await tx
      .update(aiAssistantThread)
      .set({
        title: nextThreadTitle,
        lastMessagePreview: buildMessagePreview(generatedResponse.answer),
        messageCount: sql`${aiAssistantThread.messageCount} + 2`,
        lastMessageAt: now,
        updatedAt: now,
      })
      .where(and(eq(aiAssistantThread.id, existingThread.id), eq(aiAssistantThread.userId, user.id)))
      .returning();

    return updatedThread;
  });

  // Salva o embedding da resposta para cache semântico futuro.
  // Fire-and-forget: não bloqueia a resposta para o cliente.
  if (assistantMessageId && generatedResponse.answer) {
    saveAssistantResponseEmbedding(assistantMessageId, generatedResponse.answer).catch((err) => {
      console.warn("⚠️ [CACHE] Falha ao persistir embedding:", err instanceof Error ? err.message : String(err));
    });
  }

  return {
    ...generatedResponse,
    threadId: thread.id,
    thread: toThreadSummary(thread),
    messageContent,
  };
}

/**
 * Versão streaming do sendAssistantMessage.
 * Envia eventos SSE enquanto o modelo gera a resposta.
 */
export async function sendAssistantMessageStream(
  user: { id: string; name: string },
  request: AiAssistantMessageRequestDto,
  sendEvent: (event: string, data: unknown) => void,
): Promise<void> {
  const requestedThreadId = request.threadId ?? randomUUID();
  const existingThread = request.threadId
    ? await getThreadRowById(user.id, request.threadId)
    : null;

  if (request.threadId && !existingThread) {
    throw new AssistantThreadNotFoundError();
  }

  // Cache semântico: verifica se já existe resposta para pergunta similar.
  if (!existingThread || existingThread.messageCount <= 4) {
    const cached = await findCachedAssistantResponse(request.content);
    if (cached) {
      sendEvent("connected", {});
      sendEvent("scope", { scope: cached.metadata.scope ?? "general" });
      sendEvent("data", {
        answer: cached.content,
        thinking: cached.thinking,
        scope: cached.metadata.scope ?? "general",
        isInScope: cached.metadata.isInScope ?? true,
        suggestedQuestions: cached.metadata.suggestedQuestions ?? [],
        citations: cached.metadata.citations ?? [],
      });
      sendEvent("complete", {});

      // Persiste a mensagem cacheada
      const now = new Date();
      const threadTitle = buildThreadTitle(request.content);

      const thread = await db.transaction(async (tx) => {
        if (!existingThread) {
          const [insertedThread] = await tx
            .insert(aiAssistantThread)
            .values({
              id: requestedThreadId,
              userId: user.id,
              title: threadTitle,
              lastMessagePreview: buildMessagePreview(cached.content),
              messageCount: 2,
              lastMessageAt: now,
              createdAt: now,
              updatedAt: now,
            })
            .returning();
          return insertedThread;
        }

        const [updatedThread] = await tx
          .update(aiAssistantThread)
          .set({
            title: existingThread.title === DEFAULT_THREAD_TITLE ? threadTitle : existingThread.title,
            lastMessagePreview: buildMessagePreview(cached.content),
            messageCount: sql`${aiAssistantThread.messageCount} + 2`,
            lastMessageAt: now,
            updatedAt: now,
          })
          .where(and(eq(aiAssistantThread.id, existingThread.id), eq(aiAssistantThread.userId, user.id)))
          .returning();

        return updatedThread;
      });

      await db.insert(aiAssistantMessage).values([
        {
          threadId: thread.id,
          senderType: "user",
          senderUserId: user.id,
          senderName: user.name,
          content: request.content.trim(),
          createdAt: now,
          metadata: {},
        },
        {
          threadId: thread.id,
          senderType: "assistant",
          senderUserId: null,
          senderName: ASSISTANT_SENDER_NAME,
          createdAt: new Date(now.getTime() + 1),
          provider: "cache",
          model: "semantic-cache",
          generationStatus: "success",
          latencyMs: 0,
          content: cached.content,
          metadata: {
            ...cached.metadata,
            cached: true,
            cacheSimilarity: cached.similarity,
          },
        },
      ]);

      return;
    }
  }

  const conversationContext = existingThread
    ? await loadConversationContext(existingThread.id)
    : {
        historyMessages: [],
        conversationMemory: null,
        lastKnownScope: null,
      };

  sendEvent("connected", {});

  // Etapa 1: Classificação de escopo + coleta de dados (não-streaming)
  const generatedResponse = await generateAssistantMessage({
    threadId: requestedThreadId,
    content: request.content,
    historyMessages: conversationContext.historyMessages,
    conversationMemory: conversationContext.conversationMemory,
    lastKnownScope: conversationContext.lastKnownScope,
  });

  sendEvent("scope", {
    scope: generatedResponse.scope,
    isInScope: generatedResponse.isInScope,
  });

  // Etapa 2: Refinamento via Ollama (streaming)
  const { composeAssistantAnswerWithOllamaStream } = await import("./ai-assistant-llm-service.js");

  const streamInput = {
    scope: generatedResponse.scope,
    question: request.content,
    fallbackAnswer: generatedResponse.answer,
    contextSummary: generatedResponse.contextSummary,
    citations: generatedResponse.citations,
    suggestedQuestions: generatedResponse.suggestedQuestions,
    conversationHistory: conversationContext.historyMessages,
    conversationMemory: conversationContext.conversationMemory,
  };

  let streamingAnswer = generatedResponse.answer;
  let streamingContextSummary = generatedResponse.contextSummary;
  let streamingGeneration = generatedResponse.generation;
  let finalThinking: string | undefined;
  let streamingHadError = false;

  try {
    for await (const event of composeAssistantAnswerWithOllamaStream(streamInput)) {
      if (event.type === "thinking") {
        finalThinking = event.content;
        sendEvent("thinking", { content: event.content });
      } else if (event.type === "answer") {
        streamingAnswer = event.content;
        streamingContextSummary = event.contextSummary;
        streamingGeneration = event.generation;
        /* 
         * O evento answer carrega o thinking final do JSON completo,
         * que pode ser mais preciso que o thinking extraído durante o streaming.
         * Prefere o thinking final do parsing completo.
         */
        if (event.thinking) {
          finalThinking = event.thinking;
        }
      } else if (event.type === "error") {
        console.warn("⚠️ [AI_ASSISTANT_STREAM] Ollama refinement failed, using data-collected answer:", event.content);
        streamingHadError = true;
        break;
      }
    }
  } catch (error) {
    console.warn("⚠️ [AI_ASSISTANT_STREAM] Stream error, using data-collected answer:", error instanceof Error ? error.message : String(error));
    streamingHadError = true;
  }

  // Se houve erro no refinamento, mantém a resposta original da coleta de dados
  if (streamingHadError) {
    streamingAnswer = generatedResponse.answer;
    streamingContextSummary = generatedResponse.contextSummary;
    streamingGeneration = generatedResponse.generation;
    /* Se o stream falhou antes de produzir thinking, usa o thinking da coleta inicial */
    if (!finalThinking && generatedResponse.thinking) {
      finalThinking = generatedResponse.thinking;
    }
  }

  /* Fallback: se o stream não produziu thinking, usa o da coleta inicial */
  const persistedThinking = finalThinking ?? generatedResponse.thinking;

  // Envia o resultado final
  sendEvent("result", {
    threadId: requestedThreadId,
    answer: streamingAnswer,
    contextSummary: streamingContextSummary,
    generation: streamingGeneration,
    thinking: persistedThinking ?? null,
    scope: generatedResponse.scope,
    isInScope: generatedResponse.isInScope,
    suggestedQuestions: generatedResponse.suggestedQuestions,
    citations: generatedResponse.citations,
    visualization: generatedResponse.visualization ?? null,
  });

  // Salva no banco
  const generationMetadata = normalizeGenerationMetadata(streamingGeneration);
  const assistantMetadata = buildAssistantMessageMetadata(
    { ...generatedResponse, answer: streamingAnswer, thinking: persistedThinking },
    generationMetadata,
  );
  const messageContent = formatAssistantReply({
    ...generatedResponse,
    answer: streamingAnswer,
  });
  const now = new Date();
  const nextThreadTitle = existingThread
    ? existingThread.messageCount === 0 || existingThread.title === DEFAULT_THREAD_TITLE
      ? buildThreadTitle(request.content)
      : existingThread.title
    : buildThreadTitle(request.content);

  let streamedAssistantMessageId: string | null = null;

  await db.transaction(async (tx) => {
    const userMessageCreatedAt = now;
    const assistantMessageCreatedAt = new Date(now.getTime() + 1);

    if (!existingThread) {
      const [insertedThread] = await tx
        .insert(aiAssistantThread)
        .values({
          id: requestedThreadId,
          userId: user.id,
          title: nextThreadTitle,
          lastMessagePreview: buildMessagePreview(streamingAnswer),
          messageCount: 2,
          lastMessageAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      // Gera IDs explícitos para capturar o ID da mensagem do assistente
      const generatedId = randomUUID();
      streamedAssistantMessageId = generatedId;

      await tx.insert(aiAssistantMessage).values([
        {
          id: randomUUID(),
          threadId: insertedThread.id,
          senderType: "user",
          senderUserId: user.id,
          senderName: user.name,
          content: request.content.trim(),
          createdAt: userMessageCreatedAt,
          metadata: {},
        },
        {
          id: generatedId,
          threadId: insertedThread.id,
          senderType: "assistant",
          senderUserId: null,
          senderName: ASSISTANT_SENDER_NAME,
          createdAt: assistantMessageCreatedAt,
          provider: generationMetadata.provider,
          model: generationMetadata.model,
          generationStatus: generationMetadata.generationStatus,
          latencyMs: generationMetadata.latencyMs,
          errorMessage: generationMetadata.errorMessage,
          content: messageContent,
          metadata: assistantMetadata,
        },
      ]);
      return;
    }

    // Gera IDs explícitos para capturar o ID da mensagem do assistente
    const generatedId2 = randomUUID();
    streamedAssistantMessageId = generatedId2;

    await tx.insert(aiAssistantMessage).values([
      {
        id: randomUUID(),
        threadId: existingThread.id,
        senderType: "user",
        senderUserId: user.id,
        senderName: user.name,
        content: request.content.trim(),
        createdAt: userMessageCreatedAt,
        metadata: {},
      },
      {
        id: generatedId2,
        threadId: existingThread.id,
        senderType: "assistant",
        senderUserId: null,
        senderName: ASSISTANT_SENDER_NAME,
        createdAt: assistantMessageCreatedAt,
        provider: generationMetadata.provider,
        model: generationMetadata.model,
        generationStatus: generationMetadata.generationStatus,
        latencyMs: generationMetadata.latencyMs,
        errorMessage: generationMetadata.errorMessage,
        content: messageContent,
        metadata: assistantMetadata,
      },
    ]);

    await tx
      .update(aiAssistantThread)
      .set({
        title: nextThreadTitle,
        lastMessagePreview: buildMessagePreview(streamingAnswer),
        messageCount: sql`${aiAssistantThread.messageCount} + 2`,
        lastMessageAt: now,
        updatedAt: now,
      })
      .where(and(eq(aiAssistantThread.id, existingThread.id), eq(aiAssistantThread.userId, user.id)));
  });

  // Salva o embedding da resposta para cache semântico futuro.
  // Fire-and-forget: não bloqueia o streaming.
  if (streamedAssistantMessageId && streamingAnswer) {
    saveAssistantResponseEmbedding(streamedAssistantMessageId, streamingAnswer).catch((err) => {
      console.warn("⚠️ [CACHE] Falha ao persistir embedding (stream):", err instanceof Error ? err.message : String(err));
    });
  }
}

// ─── Delete / Exclusão de mensagens e threads ───────────────────

/**
 * Tenta excluir um arquivo do storage se ele existir.
 * Apenas arquivos em /uploads/serve/ são elegíveis por segurança.
 */
function tryDeleteArtifactFile(src: string): void {
  try {
    if (!src.startsWith("/uploads/serve/")) return;

    // Converte URL relativa para path absoluto
    // /uploads/serve/reports/file.pdf → {uploadsDir}/reports/file.pdf
    const relativePath = src.replace("/uploads/serve/", "");
    const { config } = require("@silo/engine/config");
    const fullPath = path.join(config.uploadsDir, relativePath);

    unlink(fullPath, (err) => {
      if (err && err.code !== "ENOENT") {
        console.error(`⚠️ [AI_ASSISTANT] Erro ao excluir artefato: ${fullPath}`, err.message);
      }
    });
  } catch {
    // Falha silenciosa — não deve quebrar a exclusão da mensagem
  }
}

/**
 * Exclui uma mensagem do usuário e todas as mensagens posteriores.
 *
 * Regras:
 * - Só permite excluir mensagens do usuário (senderType = "user")
 * - Exclui todas as mensagens com createdAt >= ao da mensagem alvo
 * - Remove artefatos (imagens, PDFs) das mensagens excluídas
 * - Se o thread ficar vazio, exclui o thread também
 */
export async function deleteAssistantMessage(
  userId: string,
  threadId: string,
  messageId: string,
): Promise<{ success: boolean }> {
  // Verifica se o thread pertence ao usuário
  const [thread] = await db
    .select({ id: aiAssistantThread.id })
    .from(aiAssistantThread)
    .where(and(eq(aiAssistantThread.id, threadId), eq(aiAssistantThread.userId, userId)))
    .limit(1);

  if (!thread) {
    throw new AssistantThreadNotFoundError();
  }

  // Busca a mensagem e verifica se é do usuário
  const [message] = await db
    .select({
      senderType: aiAssistantMessage.senderType,
      createdAt: aiAssistantMessage.createdAt,
      metadata: aiAssistantMessage.metadata,
    })
    .from(aiAssistantMessage)
    .where(and(eq(aiAssistantMessage.id, messageId), eq(aiAssistantMessage.threadId, threadId)))
    .limit(1);

  if (!message) {
    throw new Error("Mensagem não encontrada.");
  }

  // Apenas mensagens do usuário podem ser excluídas
  if (message.senderType !== "user") {
    throw new Error("Apenas mensagens do usuário podem ser excluídas.");
  }

  // Busca todas as mensagens a partir desta (incluindo ela) para remover artefatos
  const messagesToDelete = await db
    .select({ id: aiAssistantMessage.id, metadata: aiAssistantMessage.metadata })
    .from(aiAssistantMessage)
    .where(
      and(
        eq(aiAssistantMessage.threadId, threadId),
        gte(aiAssistantMessage.createdAt, message.createdAt),
      ),
    )
    .orderBy(asc(aiAssistantMessage.createdAt));

  // Remove artefatos do storage
  for (const msg of messagesToDelete) {
    const metadata = isRecord(msg.metadata) ? msg.metadata : {};
    const visualization = metadata.visualization as { kind: string; src?: string } | undefined;
    if (visualization?.src) {
      tryDeleteArtifactFile(visualization.src);
    }
  }

  // Exclui todas as mensagens a partir da marcada (inclusive)
  await db
    .delete(aiAssistantMessage)
    .where(
      and(
        eq(aiAssistantMessage.threadId, threadId),
        gte(aiAssistantMessage.createdAt, message.createdAt),
      ),
    );

  // Atualiza contagem e preview do thread
  const [remaining] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiAssistantMessage)
    .where(eq(aiAssistantMessage.threadId, threadId));

  const count = Number(remaining?.count ?? 0);

  if (count === 0) {
    await db.delete(aiAssistantThread).where(eq(aiAssistantThread.id, threadId));
  } else {
    const [lastMsg] = await db
      .select({ content: aiAssistantMessage.content, createdAt: aiAssistantMessage.createdAt })
      .from(aiAssistantMessage)
      .where(eq(aiAssistantMessage.threadId, threadId))
      .orderBy(desc(aiAssistantMessage.createdAt))
      .limit(1);

    await db
      .update(aiAssistantThread)
      .set({
        messageCount: count,
        lastMessagePreview: lastMsg ? buildMessagePreview(lastMsg.content) : "",
        lastMessageAt: lastMsg?.createdAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(aiAssistantThread.id, threadId));
  }

  return { success: true };
}

/**
 * Exclui um thread inteiro e todos os artefatos das mensagens.
 */
export async function deleteAssistantThread(
  userId: string,
  threadId: string,
): Promise<{ success: boolean }> {
  // Verifica se o thread pertence ao usuário
  const thread = await db
    .select({ id: aiAssistantThread.id })
    .from(aiAssistantThread)
    .where(and(eq(aiAssistantThread.id, threadId), eq(aiAssistantThread.userId, userId)))
    .limit(1);

  if (thread.length === 0) {
    throw new AssistantThreadNotFoundError();
  }

  // Remove todos os artefatos
  const messages = await db
    .select({ metadata: aiAssistantMessage.metadata })
    .from(aiAssistantMessage)
    .where(eq(aiAssistantMessage.threadId, threadId));

  for (const msg of messages) {
    const metadata = isRecord(msg.metadata) ? msg.metadata : {};
    const visualization = metadata.visualization as { kind: string; src?: string } | undefined;
    if (visualization?.src) {
      tryDeleteArtifactFile(visualization.src);
    }
  }

  // Exclui mensagens e thread
  await db.delete(aiAssistantMessage).where(eq(aiAssistantMessage.threadId, threadId));
  await db.delete(aiAssistantThread).where(eq(aiAssistantThread.id, threadId));

  return { success: true };
}