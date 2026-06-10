"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type AiAssistantCreateThreadResponseDto,
  type AiAssistantExampleDto,
  type AiAssistantExamplesResponseDto,
  type AiAssistantMessageResponseDto,
  type AiAssistantRuntimeStatusDto,
  type AiAssistantThreadDetailResponseDto,
  type AiAssistantThreadMessageDto,
  type AiAssistantThreadSummaryDto,
  type AiAssistantThreadsResponseDto,
} from "@silo/engine/contracts/dto/ai-assistant";
import type { ChatMessage } from "@/context/chat-context";
import { useCurrentUser } from "@/hooks/use-current-user";
import { config } from "@/lib/config";
import Button from "@/components/ui/button";
import { MessageInput } from "@/components/admin/chat/message-input";
import { MessagesList } from "@/components/admin/chat/messages-list";
import AssistantSidebar from "@/components/admin/ai-assistant/assistant-sidebar";
import AssistantEmptyState from "@/components/admin/ai-assistant/assistant-empty-state";
import Dialog from "@/components/ui/dialog";
import { toast } from "@silo/engine/format/toast";
import { readApiResponse, type ApiResponse } from "@silo/engine/contracts/api-response";

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
    id: "model-issues",
    title: "Problemas por modelo",
    prompt: "Qual modelo está acumulando mais problemas nesta semana?",
    description: "Cruza problemas recorrentes, disponibilidade e impacto recente.",
    scope: "problems",
  },
  {
    id: "pending",
    title: "Pendências",
    prompt: "Quais pendências estão mais críticas agora?",
    description: "Mostra projetos, tarefas e avanço do trabalho.",
    scope: "pending",
  },
  {
    id: "effectiveness",
    title: "Eficácia de intervenção",
    prompt: "A intervenção realizada foi eficaz e eficiente?",
    description: "Compara o período atual com o anterior e indica a tendência.",
    scope: "models",
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
  {
    id: "projects",
    title: "Projetos em andamento",
    prompt: "Quais projetos estão em andamento e como acelerar os mais lentos?",
    description: "Aponta gargalos, progresso e ações prioritárias.",
    scope: "projects",
  },
];

const truncateText = (value: string, maxLength: number): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
};

const serializeClientError = (
  error: unknown,
): { name?: string; message: string; stack?: string | null } => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
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

const buildAssistantMessage = (
  content: string,
  assistantGeneration?: ChatMessage["assistantGeneration"],
  assistantVisualization?: ChatMessage["assistantVisualization"],
  assistantThinking?: string | null,
  messageId?: string,
): ChatMessage => {
  const msg = buildChatMessage(content, ASSISTANT_SENDER_ID, ASSISTANT_SENDER_NAME);
  if (messageId) msg.id = messageId;
  return {
    ...msg,
    assistantGeneration: assistantGeneration ?? null,
    assistantVisualization: assistantVisualization ?? null,
    assistantThinking: assistantThinking?.trim() || null,
  };
};

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
    return buildAssistantMessage(
      message.content,
      message.generation,
      message.visualization,
      message.thinking,
      message.id, // ← ID real do banco
    );
  }

  const chatMsg = buildChatMessage(
    message.content,
    message.senderUserId ?? currentUserId,
    message.senderName || currentUserName,
  );
  chatMsg.id = message.id; // ← ID real do banco
  return chatMsg;
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
  const smokeMode = config.isSmokeMode;
  const [threads, setThreads] = useState<AiAssistantThreadSummaryDto[]>([]);
  const [messagesByThread, setMessagesByThread] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [examples, setExamples] = useState<AiAssistantExampleDto[]>(
    FALLBACK_EXAMPLES,
  );
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [isLoadingExamples, setIsLoadingExamples] = useState(() => !smokeMode);
  const [isLoadingThreads, setIsLoadingThreads] = useState(() => !smokeMode);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendingStatus, setSendingStatus] = useState("");
  const sendingStatusTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendingStartTimeRef = useRef(0);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [runtimeStatus, setRuntimeStatus] = useState<AiAssistantRuntimeStatusDto | null>(null);
  const [isLoadingRuntimeStatus, setIsLoadingRuntimeStatus] = useState(() => !smokeMode);
  const [showSidebar, setShowSidebar] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteHasArtifacts, setConfirmDeleteHasArtifacts] = useState(false);
  const [confirmDeleteThreadId, setConfirmDeleteThreadId] = useState<string | null>(null);
  const [confirmDeleteThreadHasArtifacts, setConfirmDeleteThreadHasArtifacts] = useState(false);

  // Ciclo de status enquanto aguarda resposta do assistente
  useEffect(() => {
    if (!isSending) {
      setSendingStatus("");
      return;
    }

    setSendingStatus("Pensando...");
    sendingStatusTimerRef.current = setInterval(() => {
      // Mantém o status simples — o placeholder do assistente já mostra o raciocínio
    }, 10_000);

    return () => {
      if (sendingStatusTimerRef.current) {
        clearInterval(sendingStatusTimerRef.current);
        sendingStatusTimerRef.current = null;
      }
    };
  }, [isSending]);

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
      console.error("❌ [AI_ASSISTANT] Erro ao carregar exemplos:", serializeClientError(error));
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
      console.error("❌ [AI_ASSISTANT] Erro ao carregar conversas:", serializeClientError(error));
      setThreads([]);
      return [] as AiAssistantThreadSummaryDto[];
    } finally {
      setIsLoadingThreads(false);
    }
  }, []);

  const loadRuntimeStatus = useCallback(async () => {
    setIsLoadingRuntimeStatus(true);
    try {
      const response = await fetch(
        config.getAssistantApiUrl("/api/admin/ai-assistant/status"),
        {
          credentials: "include",
          cache: "no-store",
        },
      );
      const apiResponse = await readTypedApiResponse<AiAssistantRuntimeStatusDto>(response);

      if (!response.ok || !apiResponse.success || !apiResponse.data) {
        throw new Error(apiResponse.error || "Não foi possível verificar o status do assistente.");
      }

      setRuntimeStatus(apiResponse.data);
    } catch (error) {
      console.error("❌ [AI_ASSISTANT] Erro ao verificar status do runtime:", serializeClientError(error));
      setRuntimeStatus({
        provider: "ollama",
        model: "indisponível",
        mode: "fallback",
        latencyMs: 0,
        checkedAt: new Date().toISOString(),
        fallbackReason: "Não foi possível verificar o status do assistente.",
      });
    } finally {
      setIsLoadingRuntimeStatus(false);
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
        console.error("❌ [AI_ASSISTANT] Erro ao carregar conversa:", serializeClientError(error));
        return null;
      } finally {
        setIsLoadingThread(false);
      }
    },
    [currentUser, currentUserId, currentUserName],
  );

  const createConversationThread = useCallback(async () => {
    if (!currentUser) return null;

    // Se a conversa atual está vazia (sem mensagens do usuário), reutiliza em vez de criar outra
    const currentMessages = selectedThreadId ? (messagesByThread[selectedThreadId] ?? []) : [];
    const hasUserMessage = currentMessages.some((msg) => msg.senderUserId !== ASSISTANT_SENDER_ID);
    if (selectedThreadId && !hasUserMessage) {
      return { id: selectedThreadId } as AiAssistantThreadSummaryDto;
    }

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
      console.error("❌ [AI_ASSISTANT] Erro ao criar conversa:", serializeClientError(error));
      return null;
    } finally {
      setIsCreatingConversation(false);
    }
  }, [currentUser, selectedThreadId, messagesByThread]);

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

      // Placeholder da resposta do assistente — será preenchido em tempo real via streaming SSE
      const assistantPlaceholder = buildAssistantMessage("", undefined, undefined, null);

      setMessagesByThread((current) => ({
        ...current,
        [threadId]: [...(current[threadId] ?? []), userMessage, assistantPlaceholder],
      }));
      setIsSending(true);
      sendingStartTimeRef.current = Date.now();

      try {
        const apiUrl = config.getAssistantApiUrl("/api/admin/ai-assistant/messages/stream");
        const abortController = new AbortController();

        // Timeout de segurança: 5 minutos para o streaming completo
        const timeoutId = setTimeout(() => abortController.abort(), 300_000);

        const response = await fetch(apiUrl, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: trimmedMessage, threadId }),
          signal: abortController.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error("Erro ao conectar com o assistente.");
        }

        if (!response.body) {
          throw new Error("Resposta do servidor sem corpo de stream.");
        }

        // Processa o stream SSE
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let currentEvent = "";
        let currentThinking = "";
        let hasReceivedResult = false;

        const updatePlaceholder = (
          thinking: string | null,
          content?: string,
          generation?: ChatMessage["assistantGeneration"],
        ) => {
          setMessagesByThread((current) => {
            const msgs = [...(current[threadId] ?? [])];
            if (msgs.length >= 2) {
              const prev = msgs[msgs.length - 1];
              msgs[msgs.length - 1] = {
                ...prev,
                assistantThinking: thinking ?? prev.assistantThinking,
                content: content !== undefined ? content : prev.content,
                assistantGeneration: generation !== undefined ? generation : prev.assistantGeneration,
              };
            }
            return { ...current, [threadId]: msgs };
          });
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            // Linha vazia: fim de um evento SSE, reseta tipo
            if (trimmedLine.length === 0) {
              currentEvent = "";
              continue;
            }
            // Comentário SSE (heartbeat)
            if (trimmedLine.startsWith(":")) continue;

            if (trimmedLine.startsWith("event: ")) {
              currentEvent = trimmedLine.slice(7).trim();
              continue;
            }

            if (!trimmedLine.startsWith("data: ")) continue;

            const eventData = trimmedLine.slice(6).trim();
            if (!eventData) continue;

            try {
              const parsed = JSON.parse(eventData) as Record<string, unknown>;

              if (currentEvent === "connected" || !currentEvent) {
                // Conexão estabelecida — placeholder já está visível
                continue;
              }

              if (currentEvent === "thinking") {
                const thinkingText = typeof parsed.content === "string" ? parsed.content : "";
                currentThinking = thinkingText;
                updatePlaceholder(thinkingText);
                continue;
              }

              if (currentEvent === "result") {
                hasReceivedResult = true;
                const data = parsed as unknown as AiAssistantMessageResponseDto;
                const assistantMessage = buildAssistantMessage(
                  buildAssistantMessageContent(data),
                  data.generation,
                  data.visualization,
                  data.thinking ?? currentThinking,
                );

                // Substitui o placeholder pela resposta final
                setMessagesByThread((current) => {
                  const msgs = [...(current[threadId] ?? [])];
                  if (msgs.length >= 2) {
                    msgs[msgs.length - 1] = assistantMessage;
                  }
                  return { ...current, [threadId]: msgs };
                });

                const responseThread = data.thread ??
                  buildFallbackThreadSummary(data.threadId, trimmedMessage, (messagesByThread[threadId] ?? []).length);
                setThreads((current) => upsertThread(current, responseThread));
                setSelectedThreadId(responseThread.id);
                continue;
              }

              if (currentEvent === "error") {
                // Remove o placeholder e mostra toast de erro
                const errorMsg = typeof parsed.content === "string" ? parsed.content : "Erro ao gerar resposta.";
                throw new Error(errorMsg);
              }

              // Evento desconhecido: ignora
            } catch (_err) {
              // JSON parcial ou inválido: ignora silenciosamente
            }
          }
        }

        // Se o stream terminou sem evento "result", considera erro
        if (!hasReceivedResult) {
          throw new Error("Stream encerrado sem resposta final.");
        }
      } catch (error) {
        console.error("❌ [AI_ASSISTANT] Erro ao responder mensagem:", serializeClientError(error));

        const isAbortError = error instanceof DOMException && error.name === "AbortError";

        // Remove o placeholder
        setMessagesByThread((current) => {
          const msgs = [...(current[threadId] ?? [])];
          if (msgs.length >= 2) {
            msgs.pop();
          }
          return { ...current, [threadId]: msgs };
        });

        // Mostra toast de erro
        const errorMsg = isAbortError
          ? "O assistente de IA não está disponível no momento. Tente novamente em instantes."
          : "Não foi possível consultar o assistente. Verifique sua conexão e tente novamente.";
        setAssistantError(errorMsg);

        // Auto-limpa o erro após 8 segundos
        setTimeout(() => setAssistantError(null), 8000);
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

  // Handler de exclusão de mensagem — verifica artefatos e abre confirmação
  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      // Verifica se há artefatos nas mensagens posteriores
      const threadMessages = selectedThreadId ? messagesByThread[selectedThreadId] ?? [] : [];
      const msgIndex = threadMessages.findIndex((m) => m.id === messageId);
      const hasArtifacts = threadMessages
        .slice(msgIndex)
        .some((m) => m.assistantVisualization?.kind === "image" && !!m.assistantVisualization.src)
        || threadMessages.slice(msgIndex).some((m) => m.assistantVisualization?.kind === "mermaid");
      setConfirmDeleteHasArtifacts(hasArtifacts);
      setConfirmDeleteId(messageId);
    },
    [selectedThreadId, messagesByThread],
  );

  // Confirma exclusão — remove do banco, artefatos e mensagens posteriores
  const confirmDelete = useCallback(async () => {
    if (!selectedThreadId || !confirmDeleteId) return;

    const messageId = confirmDeleteId;
    setConfirmDeleteId(null);

    try {
      const url = config.getApiUrl(`/api/admin/ai-assistant/threads/${selectedThreadId}/messages/${messageId}`);
      const response = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });

      const apiResponse = await readApiResponse(response);
      if (!response.ok || !apiResponse.success) {
        throw new Error(apiResponse.error || "Erro ao excluir mensagem");
      }

      toast({
        type: "success",
        title: "Mensagem excluída",
        description: "A mensagem e as respostas seguintes foram removidas.",
      });

      // Recarrega a thread inteira para refletir as exclusões em cascata
      if (selectedThreadId) {
        void loadThreadDetail(selectedThreadId);
      }
      void loadThreads();
    } catch (error) {
      console.error("❌ [AI_ASSISTANT] Erro ao excluir mensagem:", serializeClientError(error));
      toast({
        type: "error",
        title: "Erro ao excluir",
        description: error instanceof Error ? error.message : "Erro interno ao excluir mensagem.",
      });
    }
  }, [selectedThreadId, confirmDeleteId, loadThreadDetail, loadThreads]);

  // Abre confirmação para excluir thread inteiro da sidebar
  const handleDeleteThread = useCallback(
    (threadId: string) => {
      // Verifica se há artefatos no thread
      const threadMessages = messagesByThread[threadId] ?? [];
      const hasArtifacts = threadMessages
        .some((m) => 
          (m.assistantVisualization?.kind === "image" && !!m.assistantVisualization.src) ||
          m.assistantVisualization?.kind === "mermaid"
        );
      setConfirmDeleteThreadHasArtifacts(hasArtifacts);
      setConfirmDeleteThreadId(threadId);
    },
    [messagesByThread],
  );

  // Confirma exclusão do thread
  const confirmDeleteThread = useCallback(async () => {
    if (!confirmDeleteThreadId) return;
    const threadId = confirmDeleteThreadId;
    setConfirmDeleteThreadId(null);

    try {
      const url = config.getApiUrl(`/api/admin/ai-assistant/threads/${threadId}`);
      const response = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });

      const apiResponse = await readApiResponse(response);
      if (!response.ok || !apiResponse.success) {
        throw new Error(apiResponse.error || "Erro ao excluir conversa");
      }

      // Se a thread excluída era a selecionada, limpa seleção
      if (selectedThreadId === threadId) {
        setSelectedThreadId(null);
        setMessagesByThread((prev) => {
          const next = { ...prev };
          delete next[threadId];
          return next;
        });
      }

      toast({
        type: "success",
        title: "Conversa excluída",
        description: "A conversa e todos os artefatos foram removidos.",
      });

      void loadThreads();
    } catch (error) {
      console.error("❌ [AI_ASSISTANT] Erro ao excluir conversa:", serializeClientError(error));
      toast({
        type: "error",
        title: "Erro ao excluir",
        description: error instanceof Error ? error.message : "Erro interno.",
      });
    }
  }, [confirmDeleteThreadId, selectedThreadId, loadThreads]);

  useEffect(() => {
    if (smokeMode || isLoadingUser || !currentUser) return;

    void loadRuntimeStatus();
    void loadExamples();
    void loadThreads();
  }, [currentUser, isLoadingUser, loadExamples, loadRuntimeStatus, loadThreads, smokeMode]);

  useEffect(() => {
    if (smokeMode) {
      setShowSidebar(false);
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    setShowSidebar(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setShowSidebar(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [smokeMode]);

  useEffect(() => {
    if (smokeMode || isLoadingUser || !currentUser) return;
    if (isLoadingThreads || selectedThreadId || threads.length === 0) return;

    void loadThreadDetail(threads[0].id);
  }, [
    currentUser,
    isLoadingThreads,
    isLoadingUser,
    loadThreadDetail,
    selectedThreadId,
    smokeMode,
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
      {showSidebar && !smokeMode && (
        <aside className="flex h-full min-h-0 w-full shrink-0 border-b border-zinc-200 dark:border-zinc-700 lg:w-96 lg:border-b-0 lg:border-r">
          <AssistantSidebar
            threads={threads}
            selectedThreadId={selectedThreadId}
            onThreadSelect={handleSelectThread}
            onNewConversation={createConversationThread}
            isLoadingThreads={isLoadingThreads}
            isCreatingConversation={isCreatingConversation}
            runtimeStatus={runtimeStatus}
            isLoadingRuntimeStatus={isLoadingRuntimeStatus}
            onDeleteThread={handleDeleteThread}
          />
        </aside>
      )}

      <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden">
        {!smokeMode && (
          <div className="flex items-center border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-700 dark:bg-zinc-900 md:hidden">
            <Button
              type="button"
              onClick={() => setShowSidebar((current) => !current)}
              className="bg-transparent p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              style="unstyled"
              title="Alternar lateral"
            >
              <span className="icon-[mdi--menu] h-5 w-5" />
            </Button>
          </div>
        )}

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
              onDeleteMessage={handleDeleteMessage}
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
              assistantStatusText={null}
              onLoadOlderMessages={() => undefined}
              onLoadNewerMessages={() => undefined}
              onDeleteMessage={handleDeleteMessage}
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

      {/* Diálogo de confirmação de exclusão de mensagem */}
      <Dialog
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        title="Excluir mensagem?"
      >
        <div className="p-6">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
            Esta ação vai apagar sua mensagem e todas as respostas do assistente a partir dela.
          </p>
          {confirmDeleteHasArtifacts && (
            <div className="flex items-start gap-2 mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <span className="icon-[lucide--alert-triangle] size-4 mt-0.5 shrink-0" />
              <span>Imagens, PDFs e outros arquivos gerados nestas mensagens também serão excluídos permanentemente.</span>
            </div>
          )}
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5">
            Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              style="bordered"
              onClick={() => setConfirmDeleteId(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 focus:bg-red-700"
            >
              <span className="icon-[lucide--trash-2] size-4 mr-2" />
              Excluir
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Diálogo de confirmação de exclusão de conversa inteira — mesmo design do Confirmar saída */}
      <Dialog
        open={!!confirmDeleteThreadId}
        onClose={() => setConfirmDeleteThreadId(null)}
        title="Excluir conversa?"
      >
        <div className="p-6">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
            Tem certeza que deseja excluir esta conversa? Todas as mensagens serão removidas.
          </p>
          {confirmDeleteThreadHasArtifacts && (
            <div className="flex items-start gap-2 mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <span className="icon-[lucide--alert-triangle] size-4 mt-0.5 shrink-0" />
              <span>Imagens, PDFs e outros arquivos gerados nesta conversa também serão excluídos permanentemente.</span>
            </div>
          )}
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5">
            Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              style="bordered"
              onClick={() => setConfirmDeleteThreadId(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={confirmDeleteThread}
              className="bg-red-600 hover:bg-red-700 focus:bg-red-700"
            >
              <span className="icon-[lucide--trash-2] size-4 mr-2" />
              Excluir conversa
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Toast de erro do assistente */}
      {assistantError && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 px-4 w-full max-w-lg">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            <div className="flex items-center gap-2">
              <span className="icon-[lucide--alert-triangle] size-4 shrink-0 text-red-500" />
              <p className="flex-1">{assistantError}</p>
              <button
                type="button"
                onClick={() => setAssistantError(null)}
                className="shrink-0 text-red-400 hover:text-red-600 dark:hover:text-red-300"
              >
                <span className="icon-[lucide--x] size-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}