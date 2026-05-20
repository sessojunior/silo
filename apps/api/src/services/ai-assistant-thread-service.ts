import { randomUUID } from "node:crypto";

import { db } from "@silo/database";
import {
  aiAssistantMessage,
  aiAssistantThread,
} from "@silo/database/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";
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
import type { OllamaChatMessage } from "../infra/llm/ollama-client.js";

const ASSISTANT_SENDER_NAME = "Assistente de IA";
const DEFAULT_THREAD_TITLE = "Nova conversa";
const THREAD_TITLE_MAX_LENGTH = 64;
const MESSAGE_PREVIEW_MAX_LENGTH = 120;
const ASSISTANT_SCOPE_SET = new Set<string>(AI_ASSISTANT_SCOPES);

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

  return {
    historyMessages,
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

      await tx.insert(aiAssistantMessage).values([
        {
          threadId: insertedThread.id,
          senderType: "user",
          senderUserId: user.id,
          senderName: user.name,
          content: request.content.trim(),
          createdAt: userMessageCreatedAt,
          metadata: {},
        },
        {
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

    await tx.insert(aiAssistantMessage).values([
      {
        threadId: existingThread.id,
        senderType: "user",
        senderUserId: user.id,
        senderName: user.name,
        content: request.content.trim(),
        createdAt: userMessageCreatedAt,
        metadata: {},
      },
      {
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

  return {
    ...generatedResponse,
    threadId: thread.id,
    thread: toThreadSummary(thread),
    messageContent,
  };
}