"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  type AiAssistantCreateThreadResponseDto,
  type AiAssistantExampleDto,
  type AiAssistantExamplesResponseDto,
  type AiAssistantMessageResponseDto,
  type AiAssistantThreadDetailResponseDto,
  type AiAssistantThreadMessageDto,
  type AiAssistantThreadSummaryDto,
  type AiAssistantThreadsResponseDto,
} from "@silo/engine/contracts";
import type { ChatMessage } from "@/context/chat-context";
import { useCurrentUser } from "@/hooks/use-current-user";
import { config } from "@/lib/config";
import { readApiResponse, type ApiResponse } from "@/lib/api-response";
import Button from "@/components/ui/button";
import { MessageInput } from "@/components/admin/chat/message-input";
import { MessagesList } from "@/components/admin/chat/messages-list";
import AssistantSidebar from "@/components/admin/ai-assistant/assistant-sidebar";
import AssistantEmptyState from "@/components/admin/ai-assistant/assistant-empty-state";

const ASSISTANT_SENDER_ID = "ai-assistant";
const ASSISTANT_SENDER_NAME = "Assistente de IA";

const FALLBACK_EXAMPLES: AiAssistantExampleDto[] = [
  {
    id: "models",
    title: "Modelos e rodadas",
    prompt: "Quais modelos estão com menor disponibilidade nos últimos 30 dias?",
    description: "Usa disponibilidade, intervenções e sinais de rodada.",
    scope: "models",
  },
  {
    id: "pending",
    title: "Pendências",
    prompt: "Quais pendências estão mais críticas agora?",
    description: "Mostra projetos, tarefas e avanço do trabalho.",
    scope: "pending",
  },
  {
    id: "reports",
    title: "Relatórios",
    prompt: "O que eu preciso olhar primeiro para entender o cenário de hoje?",
    description: "Resume os painéis que trazem visão rápida da operação.",
    scope: "reports",
  },
  {
    id: "problems",
    title: "Problemas",
    prompt: "Quais categorias de problema mais cresceram na última semana?",
    description: "Cruza incidências, categorias e tendência.",
    scope: "problems",
  },
];

const truncateText = (value: string, maxLength: number): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
};

const buildChatMessage = (
  content: string,
  senderUserId: string,
  senderName: string,
): ChatMessage => ({
  id: crypto.randomUUID(),
  content,
  senderUserId,
  senderName,
  receiverGroupId: null,
  receiverUserId: null,
  createdAt: new Date(),
  readAt: null,
  deletedAt: null,
  messageType: "userMessage",
});

const buildAssistantMessage = (content: string): ChatMessage =>
  buildChatMessage(content, ASSISTANT_SENDER_ID, ASSISTANT_SENDER_NAME);

const buildAssistantErrorMessage = (): ChatMessage =>
  buildAssistantMessage(
    "Não consegui processar a pergunta agora. Faça outra pergunta sobre modelos, pendências, relatórios, problemas, soluções ou projetos do Silo.",
  );

const buildAssistantMessageContent = (
  data: AiAssistantMessageResponseDto,
): string => {
  if (data.messageContent && data.messageContent.trim().length > 0) {
    return data.messageContent;
  }

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

const mapThreadMessageToChatMessage = (
  message: AiAssistantThreadMessageDto,
  currentUserId: string,
  currentUserName: string,
): ChatMessage => {
  if (message.senderType === "assistant") {
    return buildAssistantMessage(message.content);
  }

  return buildChatMessage(
    message.content,
    message.senderUserId ?? currentUserId,
    message.senderName || currentUserName,
  );
};

const upsertThread = (
  threads: AiAssistantThreadSummaryDto[],
  nextThread: AiAssistantThreadSummaryDto,
): AiAssistantThreadSummaryDto[] => {
  const withoutCurrent = threads.filter((thread) => thread.id !== nextThread.id);
  return [nextThread, ...withoutCurrent].sort(
    (left, right) =>
      new Date(right.lastMessageAt).getTime() -
      new Date(left.lastMessageAt).getTime(),
  );
};

const buildFallbackThreadSummary = (
  threadId: string,
  prompt: string,
  currentCount: number,
): AiAssistantThreadSummaryDto => {
  const now = new Date().toISOString();
  return {
    id: threadId,
    title: truncateText(prompt, 64),
    lastMessagePreview: truncateText(prompt, 120),
    messageCount: currentCount + 2,
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now,
  };
};

const readTypedApiResponse = async <T,>(
  response: Response,
): Promise<ApiResponse<T>> => {
  return (await readApiResponse(response)) as ApiResponse<T>;
};

export default function AiAssistantPage() {
  const { currentUser, loading: isLoadingUser, error: userError } = useCurrentUser();
  const [threads, setThreads] = useState<AiAssistantThreadSummaryDto[]>([]);
  const [messagesByThread, setMessagesByThread] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [examples, setExamples] = useState<AiAssistantExampleDto[]>(
    FALLBACK_EXAMPLES,
  );
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [isLoadingExamples, setIsLoadingExamples] = useState(true);
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  const currentUserId = currentUser?.id ?? "";
  const currentUserName = currentUser?.name ?? "Você";

  const activeMessages = useMemo(() => {
    if (!selectedThreadId) return [];
    return messagesByThread[selectedThreadId] ?? [];
  }, [messagesByThread, selectedThreadId]);

  const selectedThread = useMemo(() => {
    if (!selectedThreadId) return null;
    return threads.find((thread) => thread.id === selectedThreadId) ?? null;
  }, [selectedThreadId, threads]);

  const loadExamples = useCallback(async () => {
    setIsLoadingExamples(true);
    try {
      const response = await fetch(
        config.getApiUrl("/api/admin/ai-assistant/examples"),
        {
          credentials: "include",
          cache: "no-store",
        },
      );
      const apiResponse = await readTypedApiResponse<AiAssistantExamplesResponseDto>(response);

      if (
        response.ok &&
        apiResponse.success &&
        apiResponse.data &&
        "examples" in apiResponse.data &&
        Array.isArray(apiResponse.data.examples) &&
        apiResponse.data.examples.length > 0
      ) {
        setExamples(apiResponse.data.examples);
      } else {
        setExamples(FALLBACK_EXAMPLES);
      }
    } catch (error) {
      console.error("❌ [AI_ASSISTANT] Erro ao carregar exemplos:", { error });
      setExamples(FALLBACK_EXAMPLES);
    } finally {
      setIsLoadingExamples(false);
    }
  }, []);

  const loadThreads = useCallback(async () => {
    setIsLoadingThreads(true);
    try {
      const response = await fetch(
        config.getApiUrl("/api/admin/ai-assistant/threads"),
        {
          credentials: "include",
          cache: "no-store",
        },
      );
      const apiResponse = await readTypedApiResponse<AiAssistantThreadsResponseDto>(response);

      if (!response.ok || !apiResponse.success || !apiResponse.data) {
        throw new Error(apiResponse.error || "Não foi possível carregar as conversas.");
      }

      const nextThreads = Array.isArray(apiResponse.data.threads)
        ? apiResponse.data.threads
        : [];
      setThreads(nextThreads);
      return nextThreads;
    } catch (error) {
      console.error("❌ [AI_ASSISTANT] Erro ao carregar conversas:", { error });
      setThreads([]);
      return [] as AiAssistantThreadSummaryDto[];
    } finally {
      setIsLoadingThreads(false);
    }
  }, []);

  const loadThreadDetail = useCallback(
    async (threadId: string): Promise<AiAssistantThreadSummaryDto | null> => {
      if (!currentUser) return null;

      setIsLoadingThread(true);
      try {
        const response = await fetch(
          config.getApiUrl(`/api/admin/ai-assistant/threads/${threadId}`),
          {
            credentials: "include",
            cache: "no-store",
          },
        );
        const apiResponse = await readTypedApiResponse<AiAssistantThreadDetailResponseDto>(response);

        if (response.status === 404) {
          setMessagesByThread((current) => {
            const next = { ...current };
            delete next[threadId];
            return next;
          });
          setSelectedThreadId(null);
          return null;
        }

        if (!response.ok || !apiResponse.success || !apiResponse.data) {
          throw new Error(apiResponse.error || "Não foi possível abrir a conversa.");
        }

        const { thread, messages } = apiResponse.data;
        setThreads((current) => upsertThread(current, thread));
        setSelectedThreadId(thread.id);
        setMessagesByThread((current) => ({
          ...current,
          [thread.id]: messages.map((message) =>
            mapThreadMessageToChatMessage(message, currentUserId, currentUserName),
          ),
        }));

        return thread;
      } catch (error) {
        console.error("❌ [AI_ASSISTANT] Erro ao carregar conversa:", { error });
        return null;
      } finally {
        setIsLoadingThread(false);
      }
    },
    [currentUser, currentUserId, currentUserName],
  );

  const createConversationThread = useCallback(async () => {
    if (!currentUser) return null;

    setIsCreatingConversation(true);
    try {
      const response = await fetch(
        config.getApiUrl("/api/admin/ai-assistant/threads"),
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      const apiResponse = await readTypedApiResponse<AiAssistantCreateThreadResponseDto>(response);

      if (!response.ok || !apiResponse.success || !apiResponse.data) {
        throw new Error(apiResponse.error || "Não foi possível criar a conversa.");
      }

      const thread = apiResponse.data.thread;
      setThreads((current) => upsertThread(current, thread));
      setMessagesByThread((current) => ({ ...current, [thread.id]: [] }));
      setSelectedThreadId(thread.id);
      return thread;
    } catch (error) {
      console.error("❌ [AI_ASSISTANT] Erro ao criar conversa:", { error });
      return null;
    } finally {
      setIsCreatingConversation(false);
    }
  }, [currentUser]);

  const ensureActiveThread = useCallback(async () => {
    if (selectedThreadId) return selectedThreadId;
    const createdThread = await createConversationThread();
    return createdThread?.id ?? null;
  }, [createConversationThread, selectedThreadId]);

  const handleSelectThread = useCallback(
    async (threadId: string) => {
      setSelectedThreadId(threadId);
      if (messagesByThread[threadId]) {
        return;
      }

      await loadThreadDetail(threadId);
    },
    [loadThreadDetail, messagesByThread],
  );

  const handleAssistantMessage = useCallback(
    async (messageText: string) => {
      const trimmedMessage = messageText.trim();
      if (!trimmedMessage || isSending || isLoadingUser || !currentUser) return;

      const threadId = await ensureActiveThread();
      if (!threadId) return;

      const userMessage = buildChatMessage(
        trimmedMessage,
        currentUserId,
        currentUserName,
      );

      setMessagesByThread((current) => ({
        ...current,
        [threadId]: [...(current[threadId] ?? []), userMessage],
      }));
      setIsSending(true);

      try {
        const response = await fetch(
          config.getApiUrl("/api/admin/ai-assistant/messages"),
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ content: trimmedMessage, threadId }),
          },
        );
        const apiResponse = await readTypedApiResponse<AiAssistantMessageResponseDto>(response);

        if (!response.ok || !apiResponse.success || !apiResponse.data) {
          throw new Error(
            apiResponse.error || "Não foi possível consultar o assistente.",
          );
        }

        const responseThread = apiResponse.data.thread ??
          buildFallbackThreadSummary(
            apiResponse.data.threadId,
            trimmedMessage,
            (messagesByThread[threadId] ?? []).length,
          );
        const assistantMessage = buildAssistantMessage(
          buildAssistantMessageContent(apiResponse.data),
        );

        setThreads((current) => upsertThread(current, responseThread));
        setMessagesByThread((current) => ({
          ...current,
          [threadId]: [...(current[threadId] ?? []), assistantMessage],
        }));
        setSelectedThreadId(responseThread.id);
      } catch (error) {
        console.error("❌ [AI_ASSISTANT] Erro ao responder mensagem:", { error });
        setMessagesByThread((current) => ({
          ...current,
          [threadId]: [...(current[threadId] ?? []), buildAssistantErrorMessage()],
        }));
      } finally {
        setIsSending(false);
      }
    },
    [
      currentUser,
      currentUserId,
      currentUserName,
      ensureActiveThread,
      isLoadingUser,
      isSending,
      messagesByThread,
    ],
  );

  const handleExampleClick = useCallback(
    async (prompt: string) => {
      await handleAssistantMessage(prompt);
    },
    [handleAssistantMessage],
  );

  useEffect(() => {
    if (isLoadingUser || !currentUser) return;

    void loadExamples();
    void loadThreads();
  }, [currentUser, isLoadingUser, loadExamples, loadThreads]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    setShowSidebar(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setShowSidebar(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (isLoadingUser || !currentUser) return;
    if (isLoadingThreads || selectedThreadId || threads.length === 0) return;

    void loadThreadDetail(threads[0].id);
  }, [
    currentUser,
    isLoadingThreads,
    isLoadingUser,
    loadThreadDetail,
    selectedThreadId,
    threads,
  ]);

  if (isLoadingUser) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-zinc-50 px-6 text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        Carregando usuário...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-zinc-50 px-6 text-center dark:bg-zinc-900">
        <div className="max-w-md rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Usuário não autenticado
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {userError || "Faça login novamente para acessar o assistente."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-900 lg:flex-row">
      {showSidebar && (
        <aside className="flex h-full min-h-0 w-full shrink-0 border-b border-zinc-200 dark:border-zinc-700 lg:w-96 lg:border-b-0 lg:border-r">
          <AssistantSidebar
            examples={examples}
            threads={threads}
            selectedThreadId={selectedThreadId}
            onExampleSelect={handleExampleClick}
            onThreadSelect={handleSelectThread}
            onNewConversation={createConversationThread}
            isLoadingExamples={isLoadingExamples}
            isLoadingThreads={isLoadingThreads}
            isCreatingConversation={isCreatingConversation}
          />
        </aside>
      )}

      <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="button"
              onClick={() => setShowSidebar((current) => !current)}
              className="md:hidden bg-transparent p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              style="unstyled"
              title="Alternar lateral"
            >
              <span className="icon-[mdi--menu] h-5 w-5" />
            </Button>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600/10 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
              <span className="icon-[lucide--bot] h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {selectedThread?.title ?? "Assistente de IA"}
              </h1>
              <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                Perguntas focadas em modelos, pendências, relatórios, problemas,
                soluções e projetos.
              </p>
            </div>
          </div>

          {selectedThread ? (
            <div className="hidden shrink-0 items-center lg:flex">
              <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-blue-50 px-2 text-xs font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                {selectedThread.messageCount}
              </span>
            </div>
          ) : null}

        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {isLoadingThreads || isLoadingThread ? (
            <MessagesList
              messages={activeMessages}
              isLoading={true}
              isLoadingOlder={false}
              isLoadingNewer={false}
              hasMoreOlderMessages={false}
              hasMoreNewerMessages={false}
              olderMessagesRemaining={0}
              newerMessagesRemaining={0}
              currentUserId={currentUserId}
              activeTargetId={selectedThreadId ?? undefined}
              variant="assistant"
              assistantStatusText={null}
              onLoadOlderMessages={() => undefined}
              onLoadNewerMessages={() => undefined}
            />
          ) : activeMessages.length === 0 ? (
            <AssistantEmptyState
              examples={examples}
              onExampleSelect={handleExampleClick}
            />
          ) : (
            <MessagesList
              messages={activeMessages}
              isLoading={false}
              isLoadingOlder={false}
              isLoadingNewer={false}
              hasMoreOlderMessages={false}
              hasMoreNewerMessages={false}
              olderMessagesRemaining={0}
              newerMessagesRemaining={0}
              currentUserId={currentUserId}
              activeTargetId={selectedThreadId ?? undefined}
              variant="assistant"
              assistantStatusText={isSending ? "Pensando..." : null}
              onLoadOlderMessages={() => undefined}
              onLoadNewerMessages={() => undefined}
            />
          )}

          <MessageInput
            key={selectedThreadId ?? "new-thread"}
            onSendMessage={handleAssistantMessage}
            isSending={isSending}
            placeholder="Pergunte sobre modelos, pendências, relatórios, problemas, soluções ou projetos do Silo..."
            autoFocus={Boolean(selectedThreadId)}
          />
        </div>
      </div>
    </div>
  );
}