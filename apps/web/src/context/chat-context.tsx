"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUser } from "@/context/user-context";
import { config } from "@/lib/config";
import { readApiResponse, type ApiResponse } from "@silo/engine/contracts/api-response";
import type {
  AiAssistantGenerationDto,
  AiAssistantVisualizationDto,
} from "@silo/engine/contracts/dto/ai-assistant";
import {
  type ChatRealtimeMessageDto,
  type ChatRealtimeServerMessage,
} from "@silo/engine/contracts/dto/chat-realtime";

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
  assistantGeneration?: AiAssistantGenerationDto | null;
  assistantVisualization?: AiAssistantVisualizationDto | null;
};

export type PresenceStatus = "visible" | "invisible";
export type RealtimeStatus = "disconnected" | "connecting" | "connected" | "error";

type ChatContextType = {
  // Estados principais
  groups: ChatGroup[];
  users: ChatUser[];
  messages: Record<string, ChatMessage[]>; // Key: groupId ou userId
  totalUnread: number;
  currentPresence: PresenceStatus;
  realtimeStatus: RealtimeStatus;
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
};

// Constantes exportadas
export const MESSAGES_PER_PAGE = 15;
export const SYNC_INITIAL_MINUTES = 5; // Minutos para buscar mensagens na primeira sincronização

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const readChatApiData = async <T,>(response: Response): Promise<T | null> => {
  const apiResponse = await readApiResponse(response);
  if (!apiResponse.success || !apiResponse.data || typeof apiResponse.data !== "object") {
    return null;
  }

  return apiResponse.data as T;
};

const toChatMessage = (message: ChatRealtimeMessageDto): ChatMessage => ({
  id: message.id,
  content: message.content,
  senderUserId: message.senderUserId,
  senderName: message.senderName,
  receiverGroupId: message.receiverGroupId,
  receiverUserId: message.receiverUserId,
  createdAt: new Date(message.createdAt),
  readAt: message.readAt ? new Date(message.readAt) : null,
  deletedAt: message.deletedAt ? new Date(message.deletedAt) : null,
  messageType: message.messageType,
});

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useCurrentUser();
  const { userPreferences, loading: userPreferencesLoading } = useUser();

  // Estados principais
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [totalUnread, setTotalUnread] = useState(0);
  const [currentPresence, setCurrentPresence] =
    useState<PresenceStatus>("invisible");
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("disconnected");
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const sidebarRequestInFlight = useRef(false);
  const hasUnauthorizedRedirected = useRef(false);
  const realtimeSocket = useRef<WebSocket | null>(null);
  const realtimeReconnectTimer = useRef<number | null>(null);
  const realtimeReconnectAttempt = useRef(0);
  const shouldReconnectRealtime = useRef(true);
  const loadSidebarDataRef = useRef<(() => Promise<void>) | null>(null);

  const getConversationTargetId = useCallback(
    (message: ChatMessage): string | null => {
      if (message.receiverGroupId) {
        return message.receiverGroupId;
      }

      if (!message.receiverUserId) {
        return null;
      }

      if (!currentUser?.id) {
        return message.receiverUserId;
      }

      return message.senderUserId === currentUser.id
        ? message.receiverUserId
        : message.senderUserId;
    },
    [currentUser?.id],
  );

  const applyRealtimeEvent = useCallback(
    (event: ChatRealtimeServerMessage): void => {
      if (event.type === "chat.connected") {
        void loadSidebarDataRef.current?.();
        return;
      }

      if (event.type === "chat.message.created") {
        const message = toChatMessage(event.data.message);
        const targetId = getConversationTargetId(message);
        if (targetId) {
          setMessages((prev) => {
            const existingMessages = prev[targetId] || [];
            if (existingMessages.some((currentMessage) => currentMessage.id === message.id)) {
              return prev;
            }

            return {
              ...prev,
              [targetId]: [...existingMessages, message],
            };
          });
        }

        void loadSidebarDataRef.current?.();
        return;
      }

      if (event.type === "chat.message.read" || event.type === "chat.messages.read") {
        const readDate = new Date(event.data.readAt);
        const { targetId, targetType } = event.data;

        setMessages((prev) => {
          const targetMessages = prev[targetId];
          if (!targetMessages) return prev;

          return {
            ...prev,
            [targetId]: targetMessages.map((message) => {
              if (message.senderUserId === currentUser?.id) {
                return message;
              }

              if (targetType === "user" && message.messageType !== "userMessage") {
                return message;
              }

              if (message.readAt) {
                return message;
              }

              return { ...message, readAt: readDate };
            }),
          };
        });

        void loadSidebarDataRef.current?.();
        return;
      }

      if (event.type === "chat.message.deleted") {
        const { targetId, messageId } = event.data;

        setMessages((prev) => {
          const targetMessages = prev[targetId];
          if (!targetMessages) return prev;

          return {
            ...prev,
            [targetId]: targetMessages.filter((message) => message.id !== messageId),
          };
        });

        void loadSidebarDataRef.current?.();
        return;
      }

      if (event.type === "chat.presence.updated") {
        const { userId, status, lastActivity } = event.data;
        const lastActivityDate = new Date(lastActivity);

        setUsers((prev) =>
          prev.map((user) =>
            user.id === userId
              ? { ...user, presenceStatus: status, lastActivity: lastActivityDate }
              : user,
          ),
        );

        if (currentUser?.id === userId) {
          setCurrentPresence(status);
        }
      }
    },
    [currentUser?.id, getConversationTargetId],
  );

  const connectRealtime = useCallback(() => {
    if (!currentUser) return;
    if (typeof window === "undefined") return;

    const existingSocket = realtimeSocket.current;
    if (
      existingSocket &&
      (existingSocket.readyState === WebSocket.OPEN ||
        existingSocket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (realtimeReconnectTimer.current) {
      window.clearTimeout(realtimeReconnectTimer.current);
      realtimeReconnectTimer.current = null;
    }

    try {
      const socket = new WebSocket(config.getChatRealtimeUrl());
      realtimeSocket.current = socket;
      setRealtimeStatus("connecting");

      socket.onopen = () => {
        realtimeReconnectAttempt.current = 0;
        setRealtimeStatus("connected");
        void loadSidebarDataRef.current?.();
      };

      socket.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data as string) as unknown;
          if (!raw || typeof raw !== "object" || !("type" in raw)) {
            return;
          }

          applyRealtimeEvent(raw as ChatRealtimeServerMessage);
        } catch (error) {
          console.error("❌ [CONTEXT_CHAT] Erro ao processar evento realtime:", {
            error,
          });
        }
      };

      socket.onerror = () => {
        setRealtimeStatus("error");
      };

      socket.onclose = (event: CloseEvent) => {
        realtimeSocket.current = null;
        setRealtimeStatus("disconnected");

        if (event.code === 1008) {
          if (realtimeReconnectTimer.current) {
            window.clearTimeout(realtimeReconnectTimer.current);
            realtimeReconnectTimer.current = null;
          }

          shouldReconnectRealtime.current = false;
          realtimeReconnectAttempt.current = 0;
          setGroups([]);
          setUsers([]);
          setMessages({});
          setTotalUnread(0);
          setCurrentPresence("invisible");
          setLastSync(null);
          setIsLoading(false);
          return;
        }

        if (!shouldReconnectRealtime.current || !currentUser) {
          return;
        }

        const nextAttempt = realtimeReconnectAttempt.current + 1;
        realtimeReconnectAttempt.current = nextAttempt;
        const delay = Math.min(1000 * 2 ** (nextAttempt - 1), 30_000);

        if (realtimeReconnectTimer.current) {
          window.clearTimeout(realtimeReconnectTimer.current);
        }

        realtimeReconnectTimer.current = window.setTimeout(() => {
          realtimeReconnectTimer.current = null;
          connectRealtime();
        }, delay);
      };
    } catch (error) {
      setRealtimeStatus("error");
      console.error("❌ [CONTEXT_CHAT] Erro ao abrir websocket do chat:", {
        error,
      });
    }
  }, [applyRealtimeEvent, currentUser]);

  const clearChatState = useCallback(() => {
    setGroups([]);
    setUsers([]);
    setMessages({});
    setTotalUnread(0);
    setCurrentPresence("invisible");
    setLastSync(null);
  }, []);

  const disconnectRealtime = useCallback(() => {
    shouldReconnectRealtime.current = false;

    if (realtimeReconnectTimer.current) {
      window.clearTimeout(realtimeReconnectTimer.current);
      realtimeReconnectTimer.current = null;
    }

    if (realtimeSocket.current) {
      realtimeSocket.current.close(1000, "Chat provider cleanup");
      realtimeSocket.current = null;
    }

    clearChatState();
    setRealtimeStatus("disconnected");
    setIsLoading(false);
    realtimeReconnectAttempt.current = 0;
  }, [clearChatState]);

  const handleUnauthorized = useCallback(
    (status: number): boolean => {
      if (status !== 401 && status !== 403) return false;

      if (config.isSmokeMode) {
        disconnectRealtime();
        return true;
      }

      disconnectRealtime();

      if (status === 401) {
        if (hasUnauthorizedRedirected.current) return true;
        hasUnauthorizedRedirected.current = true;
        window.location.href = config.getPublicPath("/login");
      }

      return true;
    },
    [disconnectRealtime],
  );

  // === FUNÇÕES PRINCIPAIS ===

  const loadSidebarData = useCallback(async () => {
    if (config.isSmokeMode) {
      setGroups([]);
      setUsers([]);
      setTotalUnread(0);
      setLastSync(null);
      return;
    }

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
            const raw = (await response.json()) as unknown;
            const payload = (() => {
              if (!raw || typeof raw !== "object") return null;
              const root = raw as Record<string, unknown>;
              if ("success" in root) {
                const api = root as ApiResponse<unknown>;
                if (!api.success) {
                  console.error("❌ [CONTEXT_CHAT] Erro ao carregar sidebar:", {
                    error: api.error,
                  });
                  return null;
                }
                if (!api.data || typeof api.data !== "object") return null;
                return api.data as Record<string, unknown>;
              }
              return root;
            })();

            const groupsPayload = payload?.["groups"];
            const usersPayload = payload?.["users"];
            const totalUnreadPayload = payload?.["totalUnread"];

            const nextGroups = Array.isArray(groupsPayload)
              ? (groupsPayload as ChatGroup[])
              : [];
            const nextUsers = Array.isArray(usersPayload)
              ? (usersPayload as ChatUser[])
              : [];
            const nextTotalUnread =
              typeof totalUnreadPayload === "number" ? totalUnreadPayload : 0;

            setGroups(nextGroups);
            setUsers(nextUsers);
            setTotalUnread(nextTotalUnread);
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

  useEffect(() => {
    loadSidebarDataRef.current = loadSidebarData;
  }, [loadSidebarData]);

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
          { credentials: "include" },
        );

        if (response.ok) {
          const data = await readChatApiData<{
            messages?: ChatRealtimeMessageDto[];
            hasMore?: boolean;
          }>(response);
          const newMessages = (data?.messages || []).map(toChatMessage);
          const hasMore = data?.hasMore || false; // Usar hasMore da API

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
          { credentials: "include" },
        );

        if (response.ok) {
          const data = await readChatApiData<{
            messages?: ChatRealtimeMessageDto[];
            hasMore?: boolean;
          }>(response);
          const newMessages = (data?.messages || []).map(toChatMessage);
          const hasMore = data?.hasMore || false; // Usar hasMore da API

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
          { credentials: "include" },
        );

        if (response.ok) {
          const data = await readChatApiData<{
            messages?: ChatRealtimeMessageDto[];
            hasMore?: boolean;
          }>(response);
          const newMessages = (data?.messages || []).map(toChatMessage);
          const hasMore = data?.hasMore || false; // Usar hasMore da API

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
          { credentials: "include" },
        );

        if (response.ok) {
          const data = await readChatApiData<{ totalCount?: number }>(response);
          return data?.totalCount || 0;
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
          { credentials: "include" },
        );

        if (response.ok) {
          const data = await readChatApiData<{ messages?: ChatRealtimeMessageDto[] }>(response);
          return (data?.messages || []).map(toChatMessage);
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
          { credentials: "include" },
        );

        if (response.ok) {
          const data = await readChatApiData<{
            messages?: ChatRealtimeMessageDto[];
            hasMore?: boolean;
          }>(response);
          const newMessages = (data?.messages || []).map(toChatMessage);
          const hasMore = data?.hasMore || false;

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
          { credentials: "include" },
        );

        if (response.ok) {
          const data = await readChatApiData<{
            messages?: ChatRealtimeMessageDto[];
            hasMore?: boolean;
          }>(response);
          const newMessages = (data?.messages || []).map(toChatMessage);
          const hasMore = data?.hasMore || false;

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
            credentials: "include",
            body: JSON.stringify({
              content,
              receiverGroupId,
              receiverUserId,
            }),
          },
        );

        if (response.ok) {
          const apiResponse = await response.json();
          const newMessage = toChatMessage(
            ((apiResponse?.data || apiResponse) as ChatRealtimeMessageDto),
          );

          // Atualizar estado local imediatamente (optimistic update)
          const targetId = receiverGroupId || receiverUserId;
          if (targetId && newMessage && newMessage.id) {
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
            credentials: "include",
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
          credentials: "include",
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
            credentials: "include",
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
  const updatePresence = useCallback(
    async (status: PresenceStatus) => {
      try {
        setCurrentPresence(status);

        // Atualizar na API
        const response = await fetch(
          config.getApiUrl("/api/admin/chat/presence"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ status }),
          },
        );
        handleUnauthorized(response.status);
      } catch (error) {
        console.error("❌ [CONTEXT_CHAT] Erro ao atualizar presença:", {
          error,
        });
      }
    },
    [handleUnauthorized],
  );

  // === EFEITOS ===

  // Inicializar chat e websocket realtime
  useEffect(() => {
    if (config.isSmokeMode) {
      shouldReconnectRealtime.current = false;
      disconnectRealtime();
      return;
    }

    const shouldEnableRealtime =
      Boolean(currentUser) &&
      !userPreferencesLoading &&
      userPreferences?.chatEnabled !== false;

    shouldReconnectRealtime.current = shouldEnableRealtime;

    if (shouldEnableRealtime) {
      loadSidebarData();
      connectRealtime();
    } else {
      disconnectRealtime();
    }

    return () => {
      shouldReconnectRealtime.current = false;
      disconnectRealtime();
    };
  }, [
    connectRealtime,
    currentUser,
    disconnectRealtime,
    loadSidebarData,
    userPreferences?.chatEnabled,
    userPreferencesLoading,
  ]);

  // === VALUE ===

  const value: ChatContextType = {
    groups,
    users,
    messages,
    totalUnread,
    currentPresence,
    realtimeStatus,
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
