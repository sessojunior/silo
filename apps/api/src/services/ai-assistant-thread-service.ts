import { randomUUID } from "node:crypto";

import { db } from "@silo/database";
import {
  aiAssistantMessage,
  aiAssistantThread,
} from "@silo/database/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type {
  AiAssistantCreateThreadResponseDto,
  AiAssistantMessageRequestDto,
  AiAssistantMessageResponseDto,
  AiAssistantThreadDetailResponseDto,
  AiAssistantThreadMessageDto,
  AiAssistantThreadSummaryDto,
  AiAssistantThreadsResponseDto,
} from "@silo/engine/contracts";
import {
  answerAssistantMessage as generateAssistantMessage,
  getAssistantExamples,
} from "./ai-assistant-service.js";

const ASSISTANT_SENDER_ID = "ai-assistant";
const ASSISTANT_SENDER_NAME = "Assistente de IA";
const DEFAULT_THREAD_TITLE = "Nova conversa";
const THREAD_TITLE_MAX_LENGTH = 64;
const MESSAGE_PREVIEW_MAX_LENGTH = 120;

export class AssistantThreadNotFoundError extends Error {
  constructor() {
    super("Conversa não encontrada.");
    this.name = "AssistantThreadNotFoundError";
  }
}

const normalizeText = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

const truncateText = (value: string, maxLength: number): string => {
  const normalized = normalizeText(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
};

const buildThreadTitle = (content: string): string => {
  const title = truncateText(content, THREAD_TITLE_MAX_LENGTH);
  return title.length > 0 ? title : DEFAULT_THREAD_TITLE;
};

const buildMessagePreview = (content: string): string =>
  truncateText(content, MESSAGE_PREVIEW_MAX_LENGTH);

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

  const generatedResponse = await generateAssistantMessage({
    threadId: requestedThreadId,
    content: request.content,
  });
  const messageContent = formatAssistantReply(generatedResponse);
  const now = new Date();
  const nextThreadTitle = existingThread
    ? existingThread.messageCount === 0 || existingThread.title === DEFAULT_THREAD_TITLE
      ? buildThreadTitle(request.content)
      : existingThread.title
    : buildThreadTitle(request.content);

  const thread = await db.transaction(async (tx) => {
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
          metadata: {},
        },
        {
          threadId: insertedThread.id,
          senderType: "assistant",
          senderUserId: null,
          senderName: ASSISTANT_SENDER_NAME,
          content: messageContent,
          metadata: {
            scope: generatedResponse.scope,
            isInScope: generatedResponse.isInScope,
            refusalReason: generatedResponse.refusalReason,
            suggestedQuestions: generatedResponse.suggestedQuestions,
            citations: generatedResponse.citations,
            contextSummary: generatedResponse.contextSummary,
          },
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
        metadata: {},
      },
      {
        threadId: existingThread.id,
        senderType: "assistant",
        senderUserId: null,
        senderName: ASSISTANT_SENDER_NAME,
        content: messageContent,
        metadata: {
          scope: generatedResponse.scope,
          isInScope: generatedResponse.isInScope,
          refusalReason: generatedResponse.refusalReason,
          suggestedQuestions: generatedResponse.suggestedQuestions,
          citations: generatedResponse.citations,
          contextSummary: generatedResponse.contextSummary,
        },
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