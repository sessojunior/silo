import { Router } from "express";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { z } from "zod";

import { authMiddleware } from "../middleware/auth.js";
import { requireChatAccess } from "../middleware/permissions.js";
import {
  broadcastChatRealtimeEvent,
} from "../realtime/chat-realtime.js";
import {
  ChatServiceError,
  createMessage,
  deleteMessage,
  getChatSidebar,
  getChatStatusResponse,
  getMessagesCount,
  getPresenceAll,
  getUnreadMessages,
  listMessages,
  markMessageAsRead,
  markMessagesAsRead,
  updatePresence,
  updatePresenceHeartbeat,
} from "../services/chat-service.js";
import {
  type ChatRealtimeMessageDto,
} from "@silo/engine/contracts/dto/chat-realtime";

const router = Router();

router.use(authMiddleware, requireChatAccess());

const conversationTargetQueryBaseSchema = z.object({
  groupId: z.string().trim().min(1).optional(),
  userId: z.string().trim().min(1).optional(),
});

const conversationTargetQuerySchema = conversationTargetQueryBaseSchema.refine(
  (data) => Boolean(data.groupId) !== Boolean(data.userId),
  {
    message: "Especifique groupId ou userId",
  },
);

const listMessagesQuerySchema = conversationTargetQueryBaseSchema.extend({
  limit: z.coerce.number().int().positive().max(100).default(30),
  page: z.coerce.number().int().positive().default(1),
  before: z.string().trim().min(1).optional(),
  after: z.string().trim().min(1).optional(),
}).refine((data) => Boolean(data.groupId) !== Boolean(data.userId), {
  message: "Especifique groupId ou userId",
});

const unreadMessagesQuerySchema = z.object({
  groupId: z.string().trim().min(1).optional(),
  userId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(15),
});

const sendMessageSchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(1, "Conteúdo da mensagem é obrigatório")
      .max(2000, "Mensagem muito longa (máximo 2000 caracteres)"),
    receiverGroupId: z.string().trim().min(1).optional(),
    receiverUserId: z.string().trim().min(1).optional(),
  })
  .refine(
    (data) => Boolean(data.receiverGroupId) !== Boolean(data.receiverUserId),
    {
      message: "Especifique apenas um receptor (groupId ou userId)",
      path: ["receiverGroupId"],
    },
  );

const readConversationSchema = z.object({
  targetId: z.string().trim().min(1, "targetId é obrigatório"),
  type: z.enum(["group", "user"]),
});

const presenceSchema = z.object({
  status: z.enum(["visible", "invisible"]),
});

const statusSchema = z.object({
  status: z.enum(["enabled", "disabled"]),
});

const messageIdSchema = z.object({
  messageId: z.string().uuid("messageId inválido"),
});

const normalizeQueryInput = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item !== "string") continue;
      const trimmed = item.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }

  return undefined;
};

const buildQueryData = (query: Record<string, unknown>): Record<string, unknown> => ({
  groupId: normalizeQueryInput(query.groupId),
  userId: normalizeQueryInput(query.userId),
  limit: normalizeQueryInput(query.limit),
  page: normalizeQueryInput(query.page),
  before: normalizeQueryInput(query.before),
  after: normalizeQueryInput(query.after),
});

const buildUnreadQueryData = (query: Record<string, unknown>): Record<string, unknown> => ({
  groupId: normalizeQueryInput(query.groupId),
  userId: normalizeQueryInput(query.userId),
  limit: normalizeQueryInput(query.limit),
});

const toChatMessagePayload = (
  message: {
    id: string;
    content: string;
    senderUserId: string;
    senderName: string;
    receiverGroupId: string | null;
    receiverUserId: string | null;
    createdAt: Date;
    readAt: Date | null;
    deletedAt?: Date | null;
  },
): ChatRealtimeMessageDto => ({
  id: message.id,
  content: message.content,
  senderUserId: message.senderUserId,
  senderName: message.senderName,
  receiverGroupId: message.receiverGroupId,
  receiverUserId: message.receiverUserId,
  createdAt: message.createdAt.toISOString(),
  readAt: message.readAt ? message.readAt.toISOString() : null,
  deletedAt: message.deletedAt ? message.deletedAt.toISOString() : null,
  messageType: message.receiverGroupId ? "groupMessage" : "userMessage",
});

const handleChatServiceError = (
  res: ExpressResponse,
  error: unknown,
): boolean => {
  if (error instanceof ChatServiceError) {
    const payload: Record<string, unknown> = {
      success: false,
      error: error.message,
    };

    if (error.field) {
      payload.field = error.field;
    }

    res.status(error.status).json(payload);
    return true;
  }

  return false;
};

const sendUnexpectedError = (
  res: ExpressResponse,
  error: unknown,
  fallbackMessage: string,
): void => {
  console.error(fallbackMessage, error);
  res.status(500).json({ success: false, error: fallbackMessage });
};

// ─── Messages ────────────────────────────────────────────────────────────────

router.get("/messages", authMiddleware, async (req, res) => {
  try {
    const user = req.user!;
    const parsedQuery = listMessagesQuerySchema.safeParse(
      buildQueryData(req.query as Record<string, unknown>),
    );

    if (!parsedQuery.success) {
      res.status(400).json({
        success: false,
        error: parsedQuery.error.issues[0]?.message ?? "Dados inválidos.",
      });
      return;
    }

    const { groupId, userId, limit, page, before, after } = parsedQuery.data;
    const result = await listMessages(
      user.id,
      groupId ?? null,
      userId ?? null,
      limit,
      page,
      before ?? null,
      after ?? null,
    );

    res.json({
      success: true,
      data: {
        messages: result.messages.map(toChatMessagePayload),
        count: result.count,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    if (handleChatServiceError(res, error)) {
      return;
    }

    sendUnexpectedError(res, error, "❌ [API_CHAT_MESSAGES] GET:");
  }
});

router.get("/messages/count", authMiddleware, async (req, res) => {
  try {
    const user = req.user!;
    const parsedQuery = conversationTargetQuerySchema.safeParse(
      buildQueryData(req.query as Record<string, unknown>),
    );

    if (!parsedQuery.success) {
      res.status(400).json({
        success: false,
        error: parsedQuery.error.issues[0]?.message ?? "Dados inválidos.",
      });
      return;
    }

    const { groupId, userId } = parsedQuery.data;
    const totalCount = await getMessagesCount(
      user.id,
      groupId,
      userId,
    );

    res.json({ success: true, data: { totalCount } });
  } catch (error) {
    if (handleChatServiceError(res, error)) {
      return;
    }

    sendUnexpectedError(res, error, "❌ [API_CHAT_MESSAGES_COUNT] GET:");
  }
});

router.post("/messages", authMiddleware, async (req, res) => {
  try {
    const user = req.user!;
    const parsedBody = sendMessageSchema.safeParse(req.body);

    if (!parsedBody.success) {
      res.status(400).json({
        success: false,
        error: parsedBody.error.issues[0]?.message ?? "Dados inválidos.",
        field: parsedBody.error.issues[0]?.path[0]?.toString(),
      });
      return;
    }

    const { content, receiverGroupId, receiverUserId } = parsedBody.data;
    const message = await createMessage(
      user.id,
      content,
      receiverGroupId,
      receiverUserId,
    );

    const payload = toChatMessagePayload(message);
    broadcastChatRealtimeEvent({
      type: "chat.message.created",
      data: { message: payload },
    });

    res.status(201).json({
      success: true,
      data: payload,
      message: "Mensagem enviada com sucesso",
    });
  } catch (error) {
    if (handleChatServiceError(res, error)) {
      return;
    }

    sendUnexpectedError(res, error, "❌ [API_CHAT_MESSAGES] POST:");
  }
});

router.post("/messages/read", authMiddleware, async (req, res) => {
  try {
    const user = req.user!;
    const parsedBody = readConversationSchema.safeParse(req.body);

    if (!parsedBody.success) {
      res.status(400).json({
        success: false,
        error: parsedBody.error.issues[0]?.message ?? "Dados inválidos.",
      });
      return;
    }

    const { targetId, type } = parsedBody.data;
    const result = await markMessagesAsRead(user.id, targetId, type);

    if (result.updatedCount > 0) {
      broadcastChatRealtimeEvent({
        type: "chat.messages.read",
        data: {
          targetId,
          targetType: type,
          readAt: result.readAt.toISOString(),
          updatedCount: result.updatedCount,
        },
      });
    }

    res.json({
      success: true,
      data: {
        success: true,
        message:
          result.updatedCount > 0
            ? `${result.updatedCount} mensagens marcadas como lidas`
            : "Nenhuma mensagem não lida encontrada",
        updatedCount: result.updatedCount,
        readAt: result.readAt,
      },
    });
  } catch (error) {
    if (handleChatServiceError(res, error)) {
      return;
    }

    sendUnexpectedError(res, error, "❌ [API_CHAT_MESSAGES_READ] POST:");
  }
});

const handleSingleMessageRead = async (
  req: ExpressRequest,
  res: ExpressResponse,
): Promise<void> => {
  try {
    const user = req.user!;
    const parsedParams = messageIdSchema.safeParse(req.params);

    if (!parsedParams.success) {
      res.status(400).json({
        success: false,
        error: parsedParams.error.issues[0]?.message ?? "Dados inválidos.",
      });
      return;
    }

    const result = await markMessageAsRead(user.id, parsedParams.data.messageId);

    if (result.updatedCount > 0) {
      broadcastChatRealtimeEvent({
        type: "chat.message.read",
        data: {
          messageId: result.messageId,
          targetId: result.targetId,
          targetType: result.targetType,
          readAt: result.readAt.toISOString(),
        },
      });
    }

    res.json({
      success: true,
      data: {
        success: true,
        message:
          result.updatedCount > 0
            ? "Mensagem marcada como lida"
            : "Mensagem já estava marcada como lida",
        readAt: result.readAt,
      },
    });
  } catch (error) {
    if (handleChatServiceError(res, error)) {
      return;
    }

    sendUnexpectedError(res, error, "❌ [API_CHAT_MESSAGES_MESSAGE_ID_READ] POST:");
  }
};

router.post("/messages/:messageId/read", authMiddleware, async (req, res) => {
  await handleSingleMessageRead(req, res);
});

router.patch("/messages/:messageId", authMiddleware, async (req, res) => {
  await handleSingleMessageRead(req, res);
});

router.delete("/messages/:messageId", authMiddleware, async (req, res) => {
  try {
    const user = req.user!;
    const parsedParams = messageIdSchema.safeParse(req.params);

    if (!parsedParams.success) {
      res.status(400).json({
        success: false,
        error: parsedParams.error.issues[0]?.message ?? "Dados inválidos.",
      });
      return;
    }

    const result = await deleteMessage(user.id, parsedParams.data.messageId);

    broadcastChatRealtimeEvent({
      type: "chat.message.deleted",
      data: {
        messageId: result.messageId,
        targetId: result.targetId,
        targetType: result.targetType,
        deletedAt: result.deletedAt.toISOString(),
      },
    });

    res.json({
      success: true,
      data: {
        success: true,
        message: "Mensagem excluída com sucesso",
      },
    });
  } catch (error) {
    if (handleChatServiceError(res, error)) {
      return;
    }

    sendUnexpectedError(res, error, "❌ [API_CHAT_MESSAGES_MESSAGE_ID] DELETE:");
  }
});

// ─── Presence ────────────────────────────────────────────────────────────────

router.get("/presence", authMiddleware, async (req, res) => {
  try {
    const user = req.user!;
    const presenceData = await getPresenceAll();

    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const updated = presenceData.map((presence) => {
      let autoStatus = presence.status;
      if (presence.status === "visible" && presence.lastActivity < thirtyMinutesAgo) {
        autoStatus = "invisible";
      }

      return { ...presence, status: autoStatus };
    });

    const currentUserPresence = updated.find((presence) => presence.userId === user.id);
    const otherUsersPresence = updated.filter((presence) => presence.userId !== user.id);

    res.json({
      success: true,
      data: {
        presence: otherUsersPresence,
        currentUserPresence,
        timestamp: now.toISOString(),
      },
    });
  } catch (error) {
    sendUnexpectedError(res, error, "❌ [API_CHAT_PRESENCE] GET:");
  }
});

router.post("/presence", authMiddleware, async (req, res) => {
  try {
    const user = req.user!;
    const parsedBody = presenceSchema.safeParse(req.body);

    if (!parsedBody.success) {
      res.status(400).json({
        success: false,
        error: parsedBody.error.issues[0]?.message ?? "Dados inválidos.",
      });
      return;
    }

    const result = await updatePresence(user.id, parsedBody.data.status);
    broadcastChatRealtimeEvent({
      type: "chat.presence.updated",
      data: {
        userId: result.userId,
        status: result.status,
        lastActivity: result.lastActivity.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
      },
    });

    res.json({ success: true, message: "Status atualizado com sucesso" });
  } catch (error) {
    if (handleChatServiceError(res, error)) {
      return;
    }

    sendUnexpectedError(res, error, "❌ [API_CHAT_PRESENCE] POST:");
  }
});

router.patch("/presence", authMiddleware, async (req, res) => {
  try {
    const user = req.user!;
    const result = await updatePresenceHeartbeat(user.id);
    broadcastChatRealtimeEvent({
      type: "chat.presence.updated",
      data: {
        userId: result.userId,
        status: result.status,
        lastActivity: result.lastActivity.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
      },
    });

    res.json({ success: true, data: { success: true, lastActivity: result.lastActivity } });
  } catch (error) {
    sendUnexpectedError(res, error, "❌ [API_CHAT_PRESENCE] PATCH:");
  }
});

// ─── Unread Messages ─────────────────────────────────────────────────────────

router.get("/unread-messages", authMiddleware, async (req, res) => {
  try {
    const user = req.user!;
    const parsedQuery = unreadMessagesQuerySchema.safeParse(
      buildUnreadQueryData(req.query as Record<string, unknown>),
    );

    if (!parsedQuery.success) {
      res.status(400).json({
        success: false,
        error: parsedQuery.error.issues[0]?.message ?? "Dados inválidos.",
      });
      return;
    }

    const { groupId, userId, limit } = parsedQuery.data;

    if (!groupId && !userId) {
      const allMessages = await getUnreadMessages(user.id, undefined, undefined, limit);
      const unreadMessages: Record<string, { messages: ReturnType<typeof toChatMessagePayload>[]; totalCount: number }> = {};
      const conversationsMap = new Map<string, ReturnType<typeof toChatMessagePayload>[]>()

      for (const message of allMessages.messages) {
        const conversationId = message.receiverGroupId || message.senderUserId;
        const list = conversationsMap.get(conversationId) ?? [];
        list.push({
          id: message.id,
          content: message.content,
          senderUserId: message.senderUserId,
          senderName: message.senderName,
          receiverGroupId: message.receiverGroupId,
          receiverUserId: message.receiverUserId,
          createdAt: message.createdAt.toISOString(),
          readAt: message.readAt ? message.readAt.toISOString() : null,
          deletedAt: message.deletedAt ? message.deletedAt.toISOString() : null,
          messageType: message.receiverGroupId ? "groupMessage" : "userMessage",
        });
        conversationsMap.set(conversationId, list);
      }

      conversationsMap.forEach((messages, conversationId) => {
        const unreadOnly = messages.filter((message) => message.readAt === null);
        if (unreadOnly.length === 0) return;

        const sortedByRecent = unreadOnly.sort(
          (leftMessage, rightMessage) =>
            new Date(rightMessage.createdAt).getTime() -
            new Date(leftMessage.createdAt).getTime(),
        );
        const recentMessages = sortedByRecent
          .slice(0, 3)
          .sort(
            (leftMessage, rightMessage) =>
              new Date(leftMessage.createdAt).getTime() -
              new Date(rightMessage.createdAt).getTime(),
          );

        unreadMessages[conversationId] = {
          messages: recentMessages,
          totalCount: unreadOnly.length,
        };
      });

      res.json({
        success: true,
        data: {
          unreadMessages,
          count: allMessages.count,
        },
      });
      return;
    }

    const unread = await getUnreadMessages(
      user.id,
      groupId ?? undefined,
      userId ?? undefined,
      limit,
    );

    const unreadMessages = unread.messages.map((message) => ({
      id: message.id,
      content: message.content,
      senderUserId: message.senderUserId,
      senderName: message.senderName,
      receiverGroupId: message.receiverGroupId,
      receiverUserId: message.receiverUserId,
      createdAt: message.createdAt.toISOString(),
      readAt: message.readAt ? message.readAt.toISOString() : null,
      deletedAt: message.deletedAt ? message.deletedAt.toISOString() : null,
      type: groupId ? "group" : "user",
      messageType: groupId ? "groupMessage" : "userMessage",
    }));

    unreadMessages.sort(
      (leftMessage, rightMessage) =>
        new Date(leftMessage.createdAt).getTime() -
        new Date(rightMessage.createdAt).getTime(),
    );

    res.json({
      success: true,
      data: {
        messages: unreadMessages,
        count: unreadMessages.length,
      },
    });
  } catch (error) {
    sendUnexpectedError(res, error, "❌ [API_CHAT_UNREAD] GET:");
  }
});

// ─── Sidebar ─────────────────────────────────────────────────────────────────

router.get("/sidebar", authMiddleware, async (req, res) => {
  try {
    const user = req.user!;
    const sidebar = await getChatSidebar(user.id);
    if (!sidebar.canViewChat) {
      res.status(403).json({ success: false, error: "Permissão insuficiente." });
      return;
    }

    res.json({
      success: true,
      data: {
        groups: sidebar.groups,
        users: sidebar.users,
        totalUnread: sidebar.totalUnread,
      },
    });
  } catch (error) {
    sendUnexpectedError(res, error, "❌ [API_CHAT_SIDEBAR] GET:");
  }
});

// ─── Status ──────────────────────────────────────────────────────────────────

router.post("/status", authMiddleware, async (req, res) => {
  try {
    const user = req.user!;
    const parsedBody = statusSchema.safeParse(req.body);

    if (!parsedBody.success) {
      res.status(400).json({
        success: false,
        error: parsedBody.error.issues[0]?.message ?? "Dados inválidos.",
      });
      return;
    }

    res.json({
      success: true,
      data: getChatStatusResponse(user.id, user.email, parsedBody.data.status),
    });
  } catch (error) {
    sendUnexpectedError(res, error, "❌ [API_CHAT_STATUS] POST:");
  }
});

export default router;
