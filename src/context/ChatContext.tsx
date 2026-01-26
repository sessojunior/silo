"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { config } from "@/lib/config";

// === TIPOS ULTRA SIMPLIFICADOS ===

export type ChatGroup = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  active: boolean;
  unreadCount: number;
  lastMessage: string | null;
  lastMessageAt: Date | null;
};

export type ChatUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  isActive: boolean;
  presenceStatus: "visible" | "invisible";
  lastActivity: Date | null;
  unreadCount: number;
  lastMessage: string | null;
  lastMessageAt: Date | null;
};

export type ChatMessage = {
  id: string;
  content: string;
  senderUserId: string;
  senderName: string;
  receiverGroupId: string | null;
  receiverUserId: string | null;
  createdAt: Date;
  readAt: Date | null;
  deletedAt: Date | null;
  messageType: "groupMessage" | "userMessage";
};

export type PresenceStatus = "visible" | "invisible";

type ChatContextType = {
  // Estados principais
  groups: ChatGroup[];
  users: ChatUser[];
  messages: Record<string, ChatMessage[]>; // Key: groupId ou userId
  totalUnread: number;
  currentPresence: PresenceStatus;
  isLoading: boolean;
  lastSync: string | null;

  // Funções principais
  loadSidebarData: () => Promise<void>;
  loadMessages: (
    targetId: string,
    type: "group" | "user",
  ) => Promise<{ messages: ChatMessage[]; hasMore: boolean }>;
  loadOlderMessages: (
    targetId: string,
    type: "group" | "user",
    page: number,
  ) => Promise<{ messages: ChatMessage[]; hasMore: boolean }>;
  loadNewerMessages: (
    targetId: string,
    type: "group" | "user",
    page: number,
  ) => Promise<{ messages: ChatMessage[]; hasMore: boolean }>;
  getMessagesCount: (
    targetId: string,
    type: "group" | "user",
  ) => Promise<number>;
  getUnreadMessages: (
    targetId: string,
    type: "group" | "user",
    limit?: number,
  ) => Promise<ChatMessage[]>;
  loadMessagesBeforeUnread: (
    targetId: string,
    type: "group" | "user",
    beforeDate: string,
    limit?: number,
  ) => Promise<{ messages: ChatMessage[]; hasMore: boolean }>;
  loadMessagesAfterUnread: (
    targetId: string,
    type: "group" | "user",
    afterDate: string,
    limit?: number,
  ) => Promise<{ messages: ChatMessage[]; hasMore: boolean }>;
  sendMessage: (
    content: string,
    receiverGroupId?: string,
    receiverUserId?: string,
  ) => Promise<void>;
  markMessageAsRead: (messageId: string) => Promise<void>;
  markMessagesAsRead: (
    targetId: string,
    type: "group" | "user",
  ) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  setMessages: React.Dispatch<
    React.SetStateAction<Record<string, ChatMessage[]>>
  >;

  // Sistema de presença
  updatePresence: (status: PresenceStatus) => Promise<void>;
  sendHeartbeat: () => Promise<void>;

  // Controles
  startPolling: () => void;
  stopPolling: () => void;
};

// Constantes exportadas
export const MESSAGES_PER_PAGE = 15;
export const SYNC_INITIAL_MINUTES = 5; // Minutos para buscar mensagens na primeira sincronização
export const POLLING_INTERVAL = 10000; // 10 segundos para polling

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useCurrentUser();

  // Estados principais
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [totalUnread, setTotalUnread] = useState(0);
  const [currentPresence, setCurrentPresence] =
    useState<PresenceStatus>("invisible");
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Controles de polling
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const isPollingActive = useRef(false);
  const sidebarRequestInFlight = useRef(false);
  const heartbeatInFlight = useRef(false);
  const hasUnauthorizedRedirected = useRef(false);

  const handleUnauthorized = useCallback((status: number): boolean => {
    if (status !== 401) return false;
    if (hasUnauthorizedRedirected.current) return true;
    hasUnauthorizedRedirected.current = true;
    window.location.href = config.getApiUrl("/api/logout");
    return true;
  }, []);

  // === FUNÇÕES PRINCIPAIS ===

  const loadSidebarData = useCallback(async () => {
    if (sidebarRequestInFlight.current) return;
    sidebarRequestInFlight.current = true;
    try {
      setIsLoading(true);
      const delay = (ms: number): Promise<void> =>
        new Promise((resolve) => window.setTimeout(resolve, ms));

      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = window.setTimeout(() => controller.abort(), 15000);
          const response = await fetch(
            config.getApiUrl("/api/admin/chat/sidebar"),
            {
              signal: controller.signal,
              credentials: "include",
              cache: "no-store",
            },
          ).finally(() => window.clearTimeout(timeoutId));

          if (response.ok) {
            const data = (await response.json()) as {
              groups?: ChatGroup[];
              users?: ChatUser[];
              totalUnread?: number;
            };

            setGroups(data.groups || []);
            setUsers(data.users || []);
            setTotalUnread(data.totalUnread || 0);
            setLastSync(new Date().toISOString());
            break;
          }

          if (handleUnauthorized(response.status)) return;

          const shouldRetry = response.status >= 500 && attempt < maxAttempts;
          if (shouldRetry) {
            await delay(250 * attempt);
            continue;
          }

          console.error("❌ [CONTEXT_CHAT] Erro ao carregar sidebar:", {
            status: response.status,
          });
          break;
        } catch (error) {
          const shouldRetry = attempt < maxAttempts;
          if (shouldRetry) {
            await delay(250 * attempt);
            continue;
          }
          console.error("❌ [CONTEXT_CHAT] Erro na requisição sidebar:", {
            error,
          });
        }
      }
    } catch (error) {
      console.error("❌ [CONTEXT_CHAT] Erro na requisição sidebar:", { error });
    } finally {
      setIsLoading(false);
      sidebarRequestInFlight.current = false;
    }
  }, [handleUnauthorized]);

  const loadMessages = useCallback(
    async (targetId: string, type: "group" | "user") => {
      try {
        // Carregar as últimas mensagens (mais recentes primeiro)
        const params = new URLSearchParams({
          limit: MESSAGES_PER_PAGE.toString(),
          order: "desc", // Mais recentes primeiro
        });
        if (type === "group") {
          params.set("groupId", targetId);
        } else {
          params.set("userId", targetId);
        }

        const response = await fetch(
          config.getApiUrl(`/api/admin/chat/messages?${params}`),
        );

        if (response.ok) {
          const data = await response.json();
          const newMessages = data.messages || [];
          const hasMore = data.hasMore || false; // Usar hasMore da API

          // Verificar duplicatas e ordenar por data (mais antigas primeiro para exibição)
          const uniqueMessages = newMessages.filter(
            (msg: ChatMessage, index: number, self: ChatMessage[]) =>
              index === self.findIndex((m: ChatMessage) => m.id === msg.id),
          );

          // Ordenar cronologicamente (mais antigas primeiro) para exibição no chat
          const sortedMessages = uniqueMessages.sort(
            (a: ChatMessage, b: ChatMessage) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );

          setMessages((prev) => ({
            ...prev,
            [targetId]: sortedMessages,
          }));

          return { messages: sortedMessages, hasMore };
        } else {
          console.error("❌ [CONTEXT_CHAT] Erro ao carregar mensagens:", {
            status: response.status,
          });
          return { messages: [], hasMore: false };
        }
      } catch (error) {
        console.error("❌ [CONTEXT_CHAT] Erro na requisição mensagens:", {
          error,
        });
        return { messages: [], hasMore: false };
      }
    },
    [],
  );

  const loadOlderMessages = useCallback(
    async (targetId: string, type: "group" | "user", page: number) => {
      try {
        // Buscar mensagens mais antigas que as já carregadas
        const existingMessages = messages[targetId] || [];
        const oldestMessage = existingMessages[0]; // Primeira mensagem (mais antiga)

        const params = new URLSearchParams({
          limit: MESSAGES_PER_PAGE.toString(),
          page: page.toString(),
          order: "desc", // Buscar mensagens mais antigas
          ...(oldestMessage && {
            before: new Date(oldestMessage.createdAt).toISOString(),
          }), // Buscar mensagens anteriores à mais antiga
        });
        if (type === "group") {
          params.set("groupId", targetId);
        } else {
          params.set("userId", targetId);
        }

        const response = await fetch(
          config.getApiUrl(`/api/admin/chat/messages?${params}`),
        );

        if (response.ok) {
          const data = await response.json();
          const newMessages = data.messages || [];
          const hasMore = data.hasMore || false; // Usar hasMore da API

          // Ordenar cronologicamente (mais antigas primeiro)
          const sortedNewMessages = newMessages.sort(
            (a: ChatMessage, b: ChatMessage) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );

          // Adicionar mensagens antigas no início da lista (preservando ordem cronológica)
          setMessages((prev) => {
            const existingMessages = prev[targetId] || [];
            const uniqueNewMessages = sortedNewMessages.filter(
              (newMsg: ChatMessage) =>
                !existingMessages.some(
                  (existingMsg) => existingMsg.id === newMsg.id,
                ),
            );

            return {
              ...prev,
              [targetId]: [...uniqueNewMessages, ...existingMessages],
            };
          });

          return { messages: sortedNewMessages, hasMore };
        } else {
          console.error(
            "❌ [CONTEXT_CHAT] Erro ao carregar mensagens anteriores:",
            { status: response.status },
          );
          return { messages: [], hasMore: false };
        }
      } catch (error) {
        console.error(
          "❌ [CONTEXT_CHAT] Erro na requisição mensagens anteriores:",
          { error },
        );
        return { messages: [], hasMore: false };
      }
    },
    [messages],
  );

  const loadNewerMessages = useCallback(
    async (targetId: string, type: "group" | "user", page: number) => {
      try {
        // Buscar mensagens mais recentes que as já carregadas
        const existingMessages = messages[targetId] || [];
        const newestMessage = existingMessages[existingMessages.length - 1]; // Última mensagem (mais recente)

        const params = new URLSearchParams({
          limit: MESSAGES_PER_PAGE.toString(),
          page: page.toString(),
          order: "desc", // Buscar mensagens mais recentes
          ...(newestMessage && {
            after: new Date(newestMessage.createdAt).toISOString(),
          }), // Buscar mensagens posteriores à mais recente
        });
        if (type === "group") {
          params.set("groupId", targetId);
        } else {
          params.set("userId", targetId);
        }

        const response = await fetch(
          config.getApiUrl(`/api/admin/chat/messages?${params}`),
        );

        if (response.ok) {
          const data = await response.json();
          const newMessages = data.messages || [];
          const hasMore = data.hasMore || false; // Usar hasMore da API

          // Ordenar cronologicamente (mais antigas primeiro)
          const sortedNewMessages = newMessages.sort(
            (a: ChatMessage, b: ChatMessage) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );

          // Adicionar mensagens posteriores no final da lista (preservando ordem cronológica)
          setMessages((prev) => {
            const existingMessages = prev[targetId] || [];
            const uniqueNewMessages = sortedNewMessages.filter(
              (newMsg: ChatMessage) =>
                !existingMessages.some(
                  (existingMsg) => existingMsg.id === newMsg.id,
                ),
            );

            return {
              ...prev,
              [targetId]: [...existingMessages, ...uniqueNewMessages],
            };
          });

          return { messages: sortedNewMessages, hasMore };
        } else {
          console.error(
            "❌ [CONTEXT_CHAT] Erro ao carregar mensagens posteriores:",
            { status: response.status },
          );
          return { messages: [], hasMore: false };
        }
      } catch (error) {
        console.error(
          "❌ [CONTEXT_CHAT] Erro na requisição mensagens posteriores:",
          { error },
        );
        return { messages: [], hasMore: false };
      }
    },
    [messages],
  );

  const getMessagesCount = useCallback(
    async (targetId: string, type: "group" | "user") => {
      try {
        const params = new URLSearchParams();
        if (type === "group") {
          params.set("groupId", targetId);
        } else {
          params.set("userId", targetId);
        }

        const response = await fetch(
          config.getApiUrl(`/api/admin/chat/messages/count?${params}`),
        );

        if (response.ok) {
          const data = await response.json();
          return data.totalCount || 0;
        } else {
          console.error("❌ [CONTEXT_CHAT] Erro ao contar mensagens:", {
            status: response.status,
          });
          return 0;
        }
      } catch (error) {
        console.error("❌ [CONTEXT_CHAT] Erro na requisição contagem:", {
          error,
        });
        return 0;
      }
    },
    [],
  );

  // Buscar mensagens não lidas
  const getUnreadMessages = useCallback(
    async (targetId: string, type: "group" | "user", limit: number = 15) => {
      try {
        const params = new URLSearchParams({
          limit: limit.toString(),
        });
        if (type === "group") {
          params.set("groupId", targetId);
        } else {
          params.set("userId", targetId);
        }

        const response = await fetch(
          config.getApiUrl(`/api/admin/chat/unread-messages?${params}`),
        );

        if (response.ok) {
          const data = await response.json();
          return data.messages || [];
        } else {
          console.error(
            "❌ [CONTEXT_CHAT] Erro ao buscar mensagens não lidas:",
            { status: response.status },
          );
          return [];
        }
      } catch (error) {
        console.error(
          "❌ [CONTEXT_CHAT] Erro na requisição mensagens não lidas:",
          { error },
        );
        return [];
      }
    },
    [],
  );

  // Buscar mensagens anteriores às não lidas
  const loadMessagesBeforeUnread = useCallback(
    async (
      targetId: string,
      type: "group" | "user",
      beforeDate: string,
      limit: number = 15,
    ) => {
      try {
        const params = new URLSearchParams({
          limit: limit.toString(),
          before: beforeDate,
          order: "desc", // Ordenação consistente
        });
        if (type === "group") {
          params.set("groupId", targetId);
        } else {
          params.set("userId", targetId);
        }

        const response = await fetch(
          config.getApiUrl(`/api/admin/chat/messages?${params}`),
        );

        if (response.ok) {
          const data = await response.json();
          const newMessages = data.messages || [];
          const hasMore = data.hasMore || false;

          // Ordenar cronologicamente (mais antigas primeiro)
          const sortedNewMessages = newMessages.sort(
            (a: ChatMessage, b: ChatMessage) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );

          // Adicionar mensagens antigas no início da lista (preservando ordem cronológica)
          setMessages((prev) => {
            const existingMessages = prev[targetId] || [];
            const uniqueNewMessages = sortedNewMessages.filter(
              (newMsg: ChatMessage) =>
                !existingMessages.some(
                  (existingMsg) => existingMsg.id === newMsg.id,
                ),
            );

            return {
              ...prev,
              [targetId]: [...uniqueNewMessages, ...existingMessages],
            };
          });

          return { messages: sortedNewMessages, hasMore };
        } else {
          console.error(
            "❌ [CONTEXT_CHAT] Erro ao buscar mensagens anteriores às não lidas:",
            { status: response.status },
          );
          return { messages: [], hasMore: false };
        }
      } catch (error) {
        console.error(
          "❌ [CONTEXT_CHAT] Erro na requisição mensagens anteriores às não lidas:",
          { error },
        );
        return { messages: [], hasMore: false };
      }
    },
    [],
  );

  // Buscar mensagens posteriores às não lidas
  const loadMessagesAfterUnread = useCallback(
    async (
      targetId: string,
      type: "group" | "user",
      afterDate: string,
      limit: number = 15,
    ) => {
      try {
        const params = new URLSearchParams({
          limit: limit.toString(),
          after: afterDate,
          order: "desc", // Ordenação consistente
        });
        if (type === "group") {
          params.set("groupId", targetId);
        } else {
          params.set("userId", targetId);
        }

        const response = await fetch(
          config.getApiUrl(`/api/admin/chat/messages?${params}`),
        );

        if (response.ok) {
          const data = await response.json();
          const newMessages = data.messages || [];
          const hasMore = data.hasMore || false;

          // Ordenar cronologicamente (mais antigas primeiro)
          const sortedNewMessages = newMessages.sort(
            (a: ChatMessage, b: ChatMessage) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );

          // Adicionar mensagens posteriores no final da lista (preservando ordem cronológica)
          setMessages((prev) => {
            const existingMessages = prev[targetId] || [];
            const uniqueNewMessages = sortedNewMessages.filter(
              (newMsg: ChatMessage) =>
                !existingMessages.some(
                  (existingMsg) => existingMsg.id === newMsg.id,
                ),
            );

            return {
              ...prev,
              [targetId]: [...existingMessages, ...uniqueNewMessages],
            };
          });

          return { messages: sortedNewMessages, hasMore };
        } else {
          console.error(
            "❌ [CONTEXT_CHAT] Erro ao buscar mensagens posteriores às não lidas:",
            { status: response.status },
          );
          return { messages: [], hasMore: false };
        }
      } catch (error) {
        console.error(
          "❌ [CONTEXT_CHAT] Erro na requisição mensagens posteriores às não lidas:",
          { error },
        );
        return { messages: [], hasMore: false };
      }
    },
    [],
  );

  const sendMessage = useCallback(
    async (
      content: string,
      receiverGroupId?: string,
      receiverUserId?: string,
    ) => {
      try {
        const response = await fetch(
          config.getApiUrl("/api/admin/chat/messages"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content,
              receiverGroupId,
              receiverUserId,
            }),
          },
        );

        if (response.ok) {
          const newMessage = await response.json();

          // Atualizar estado local imediatamente (optimistic update)
          const targetId = receiverGroupId || receiverUserId;
          if (targetId) {
            setMessages((prev) => {
              const existingMessages = prev[targetId] || [];
              // Verificar se a mensagem já existe para evitar duplicatas
              const messageExists = existingMessages.some(
                (msg) => msg.id === newMessage.id,
              );

              if (!messageExists) {
                return {
                  ...prev,
                  [targetId]: [...existingMessages, newMessage],
                };
              }
              return prev;
            });
          }

          // Atualizar contadores localmente ao invés de recarregar toda sidebar
          // (evita perda de focus no input do chat)
        } else {
          const errorData = await response.json();
          console.error("❌ [CONTEXT_CHAT] Erro ao enviar mensagem:", {
            error: errorData.error,
          });
        }
      } catch (error) {
        console.error("❌ [CONTEXT_CHAT] Erro na requisição enviar mensagem:", {
          error,
        });
      }
    },
    [], // Removida dependência loadSidebarData para evitar re-renderizações
  );

  const markMessageAsRead = useCallback(
    async (messageId: string) => {
      try {
        const response = await fetch(
          config.getApiUrl(`/api/admin/chat/messages/${messageId}/read`),
          {
            method: "POST",
          },
        );

        if (response.ok) {
          // Atualizar estado local
          setMessages((prev) => {
            const updated = { ...prev };
            Object.keys(updated).forEach((targetId) => {
              updated[targetId] = updated[targetId].map((msg) =>
                msg.id === messageId ? { ...msg, readAt: new Date() } : msg,
              );
            });
            return updated;
          });

          // Recarregar sidebar para atualizar contadores
          loadSidebarData();

          // Disparar evento para atualizar dropdown de notificações
          window.dispatchEvent(new CustomEvent("messagesRead"));
        }
      } catch (error) {
        console.error(
          "❌ [CONTEXT_CHAT] Erro na requisição marcar como lida:",
          { error },
        );
      }
    },
    [loadSidebarData],
  );

  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      const response = await fetch(
        config.getApiUrl(`/api/admin/chat/messages/${messageId}`),
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        // Remover do estado local
        setMessages((prev) => {
          const updated = { ...prev };
          Object.keys(updated).forEach((targetId) => {
            updated[targetId] = updated[targetId].filter(
              (msg) => msg.id !== messageId,
            );
          });
          return updated;
        });
      } else {
        const errorData = await response.json();
        console.error("❌ [CONTEXT_CHAT] Erro ao excluir mensagem:", {
          error: errorData.error,
        });
      }
    } catch (error) {
      console.error("❌ [CONTEXT_CHAT] Erro na requisição excluir mensagem:", {
        error,
      });
    }
  }, []);

  // Marcar todas as mensagens de uma conversa como lidas
  const markMessagesAsRead = useCallback(
    async (targetId: string, type: "group" | "user") => {
      try {
        const response = await fetch(
          config.getApiUrl("/api/admin/chat/messages/read"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetId, type }),
          },
        );

        if (response.ok) {
          // const data = await response.json()

          // Atualizar estado local - marcar mensagens como lidas
          setMessages((prev) => {
            const updated = { ...prev };
            const targetMessages = updated[targetId] || [];

            updated[targetId] = targetMessages.map((msg) => {
              // Marcar como lida apenas mensagens de outros usuários que não estão lidas
              if (!msg.readAt && msg.senderUserId !== currentUser?.id) {
                return { ...msg, readAt: new Date() };
              }
              return msg;
            });

            return updated;
          });

          // Atualizar contadores da sidebar dinamicamente
          if (type === "user") {
            // Para usuários, reduzir contagem do sender
            const targetUser = users.find((u) => u.id === targetId);
            const unreadToSubtract = targetUser?.unreadCount || 0;

            setUsers((prev) =>
              prev.map((user) => {
                if (user.id === targetId) {
                  return { ...user, unreadCount: 0 };
                }
                return user;
              }),
            );

            // Atualizar totalUnread
            setTotalUnread((prev) => prev - unreadToSubtract);
          } else if (type === "group") {
            // Para grupos, reduzir contagem do grupo
            const targetGroup = groups.find((g) => g.id === targetId);
            const unreadToSubtract = targetGroup?.unreadCount || 0;

            setGroups((prev) =>
              prev.map((group) => {
                if (group.id === targetId) {
                  return { ...group, unreadCount: 0 };
                }
                return group;
              }),
            );

            // Atualizar totalUnread
            setTotalUnread((prev) => prev - unreadToSubtract);
          }

          // Recarregar dados da sidebar para sincronizar
          await loadSidebarData();

          // Disparar evento para atualizar dropdown de notificações
          window.dispatchEvent(new CustomEvent("messagesRead"));
        } else {
          const errorData = await response.json();
          console.error(
            "❌ [CONTEXT_CHAT] Erro ao marcar mensagens como lidas:",
            { error: errorData.error },
          );
        }
      } catch (error) {
        console.error(
          "❌ [CONTEXT_CHAT] Erro na requisição marcar todas como lidas:",
          { error },
        );
      }
    },
    [currentUser, users, groups, loadSidebarData],
  );

  // Sistema de presença
  const updatePresence = useCallback(async (status: PresenceStatus) => {
    try {
      setCurrentPresence(status);

      // Atualizar na API
      const response = await fetch(config.getApiUrl("/api/admin/chat/presence"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      handleUnauthorized(response.status);
    } catch (error) {
      console.error("❌ [CONTEXT_CHAT] Erro ao atualizar presença:", { error });
    }
  }, [handleUnauthorized]);

  const sendHeartbeat = useCallback(async () => {
    if (heartbeatInFlight.current) return;
    heartbeatInFlight.current = true;
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 10000);
      const response = await fetch(config.getApiUrl("/api/admin/chat/presence"), {
        method: "PATCH",
        signal: controller.signal,
        credentials: "include",
        keepalive: true,
      }).finally(() => window.clearTimeout(timeoutId));
      handleUnauthorized(response.status);
    } catch (error) {
      console.error("❌ [CONTEXT_CHAT] Erro no heartbeat de presença:", {
        error,
      });
    } finally {
      heartbeatInFlight.current = false;
    }
  }, [handleUnauthorized]);

  // === POLLING ===

  const startPolling = useCallback(() => {
    if (isPollingActive.current) return;

    isPollingActive.current = true;
    pollingInterval.current = setInterval(() => {
      loadSidebarData();
      sendHeartbeat();
    }, POLLING_INTERVAL);
  }, [loadSidebarData, sendHeartbeat]);

  const stopPolling = useCallback(() => {
    isPollingActive.current = false;
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  }, []);

  // === EFEITOS ===

  // Inicializar chat e polling
  useEffect(() => {
    if (currentUser) {
      loadSidebarData();
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [currentUser, loadSidebarData, startPolling, stopPolling]);

  // === VALUE ===

  const value: ChatContextType = {
    groups,
    users,
    messages,
    totalUnread,
    currentPresence,
    isLoading,
    lastSync,
    loadSidebarData,
    loadMessages,
    loadOlderMessages,
    loadNewerMessages,
    getMessagesCount,
    getUnreadMessages,
    loadMessagesBeforeUnread,
    loadMessagesAfterUnread,
    sendMessage,
    markMessageAsRead,
    markMessagesAsRead,
    deleteMessage,
    setMessages,
    updatePresence,
    sendHeartbeat,
    startPolling,
    stopPolling,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat deve ser usado dentro de um ChatProvider");
  }
  return context;
}
