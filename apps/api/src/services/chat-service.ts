/**
 * Chat Service — Funções puras para lógica de chat
 * Manipula mensagens, presença de usuários, e sidebar
 */

import { db } from "@silo/database";
import { chatMessage, chatUserPresence, authUser, group, userGroup, groupPermission } from "@silo/database/schema";
import { and, or, isNull, isNotNull, eq, lt, gt, desc, ne, inArray, count } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getNowTimestamp } from "@silo/engine/date";
import type {
  ChatConversationTargetType,
  ChatPresenceStatus,
} from "@silo/engine/contracts/dto/chat-realtime";

export interface ChatMessageRow {
  id: string;
  content: string;
  senderUserId: string;
  senderName: string;
  receiverGroupId: string | null;
  receiverUserId: string | null;
  createdAt: Date;
  readAt: Date | null;
}

export interface ChatPresenceRow {
  userId: string;
  userName: string;
  status: string;
  lastActivity: Date;
  updatedAt: Date;
}

export interface UnreadMessage {
  id: string;
  content: string;
  createdAt: Date;
  senderUserId: string;
  receiverGroupId: string | null;
  receiverUserId: string | null;
  deletedAt: Date | null;
  readAt: Date | null;
  senderName: string;
  senderEmail: string;
  senderImage: string | null;
}

export interface ChatSidebarGroup {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  active: boolean;
  unreadCount: number;
  lastMessage: string | null;
  lastMessageAt: Date | null;
}

export interface ChatSidebarUser {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  presenceStatus: "visible" | "invisible";
  lastActivity: Date | null;
  unreadCount: number;
  lastMessage: string | null;
  lastMessageAt: Date | null;
}

export interface ChatSidebarResult {
  canViewChat: boolean;
  groups: ChatSidebarGroup[];
  users: ChatSidebarUser[];
  totalUnread: number;
}

export interface ChatStatusResponse {
  success: true;
  message: string;
  userId: string;
  userEmail: string;
  status: "enabled" | "disabled";
  timestamp: ReturnType<typeof getNowTimestamp>;
}

export interface ChatPresenceMutationResult {
  userId: string;
  status: ChatPresenceStatus;
  lastActivity: Date;
  updatedAt: Date;
}

export interface ChatMessageReadResult {
  messageId: string;
  targetId: string;
  targetType: ChatConversationTargetType;
  readAt: Date;
  updatedCount: number;
}

export interface ChatMessageDeleteResult {
  messageId: string;
  targetId: string;
  targetType: ChatConversationTargetType;
  deletedAt: Date;
}

export class ChatServiceError extends Error {
  readonly status: number;

  readonly field?: string;

  constructor(message: string, status: number = 400, field?: string) {
    super(message);
    this.name = "ChatServiceError";
    this.status = status;
    this.field = field;
  }
}

/**
 * Busca mensagens paginadas de um grupo ou conversa 1:1
 */
export async function listMessages(
  currentUserId: string,
  groupId: string | null,
  userId: string | null,
  limit: number = 30,
  page: number = 1,
  before: string | null = null,
  after: string | null = null,
): Promise<{ messages: ChatMessageRow[]; count: number; hasMore: boolean }> {
  if (!groupId && !userId) {
    throw new Error("Especifique groupId ou userId");
  }

  const offset = before || after ? 0 : (page - 1) * limit;

  const select = {
    id: chatMessage.id,
    content: chatMessage.content,
    senderUserId: chatMessage.senderUserId,
    senderName: authUser.name,
    receiverGroupId: chatMessage.receiverGroupId,
    receiverUserId: chatMessage.receiverUserId,
    createdAt: chatMessage.createdAt,
    readAt: chatMessage.readAt,
  };

  let messages: ChatMessageRow[] = [];

  if (groupId) {
    const where = [eq(chatMessage.receiverGroupId, groupId), isNull(chatMessage.deletedAt)];
    if (before) where.push(lt(chatMessage.createdAt, new Date(before)));
    if (after) where.push(gt(chatMessage.createdAt, new Date(after)));
    messages = await db
      .select(select)
      .from(chatMessage)
      .innerJoin(authUser, eq(chatMessage.senderUserId, authUser.id))
      .where(and(...where))
      .orderBy(desc(chatMessage.createdAt))
      .limit(limit)
      .offset(offset);
  } else if (userId) {
    const where = [
      or(
        and(eq(chatMessage.senderUserId, currentUserId), eq(chatMessage.receiverUserId, userId)),
        and(eq(chatMessage.senderUserId, userId), eq(chatMessage.receiverUserId, currentUserId)),
      ),
      isNull(chatMessage.deletedAt),
    ];
    if (before) where.push(lt(chatMessage.createdAt, new Date(before)));
    if (after) where.push(gt(chatMessage.createdAt, new Date(after)));
    messages = await db
      .select(select)
      .from(chatMessage)
      .innerJoin(authUser, eq(chatMessage.senderUserId, authUser.id))
      .where(and(...where))
      .orderBy(desc(chatMessage.createdAt))
      .limit(limit)
      .offset(offset);
  }

  const messagesWithType = messages.map((msg) => ({
    ...msg,
    messageType: msg.receiverGroupId ? "groupMessage" : "userMessage",
  }));

  return {
    messages,
    count: messagesWithType.length,
    hasMore: messagesWithType.length === limit,
  };
}

/**
 * Cria uma nova mensagem
 */
export async function createMessage(
  senderUserId: string,
  content: string,
  receiverGroupId?: string,
  receiverUserId?: string,
): Promise<ChatMessageRow> {
  if (!content || content.trim().length === 0) {
    throw new Error("Conteúdo da mensagem é obrigatório");
  }
  if (content.length > 2000) {
    throw new Error("Mensagem muito longa (máximo 2000 caracteres)");
  }
  if ((receiverGroupId && receiverUserId) || (!receiverGroupId && !receiverUserId)) {
    throw new Error("Especifique apenas um receptor (groupId ou userId)");
  }

  if (receiverUserId) {
    if (receiverUserId === senderUserId) {
      throw new Error("Não é possível enviar mensagem para si mesmo");
    }
    const targetUser = await db
      .select()
      .from(authUser)
      .where(eq(authUser.id, receiverUserId))
      .limit(1);
    if (targetUser.length === 0) {
      throw new Error("Usuário destinatário não encontrado");
    }
  }

  const messageId = randomUUID();
  await db.insert(chatMessage).values({
    id: messageId,
    content: content.trim(),
    senderUserId,
    receiverGroupId: receiverGroupId || null,
    receiverUserId: receiverUserId || null,
  });

  const [message] = await db
    .select({
      id: chatMessage.id,
      content: chatMessage.content,
      senderUserId: chatMessage.senderUserId,
      senderName: authUser.name,
      receiverGroupId: chatMessage.receiverGroupId,
      receiverUserId: chatMessage.receiverUserId,
      createdAt: chatMessage.createdAt,
      readAt: chatMessage.readAt,
    })
    .from(chatMessage)
    .innerJoin(authUser, eq(chatMessage.senderUserId, authUser.id))
    .where(eq(chatMessage.id, messageId))
    .limit(1);

  return message;
}

/**
 * Busca ou cria presença do usuário
 */
export async function updatePresence(
  userId: string,
  status: ChatPresenceStatus,
): Promise<ChatPresenceMutationResult> {
  if (!["visible", "invisible"].includes(status)) {
    throw new ChatServiceError("Status inválido. Use: visible ou invisible", 400, "status");
  }

  const now = new Date();
  await db
    .insert(chatUserPresence)
    .values({
      userId,
      status,
      lastActivity: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: chatUserPresence.userId,
      set: { status, lastActivity: now, updatedAt: now },
    });

  return {
    userId,
    status,
    lastActivity: now,
    updatedAt: now,
  };
}

/**
 * Atualiza heartbeat da presença (apenas lastActivity)
 */
export async function updatePresenceHeartbeat(
  userId: string,
): Promise<ChatPresenceMutationResult> {
  const now = new Date();
  const current = await db.query.chatUserPresence.findFirst({
    where: eq(chatUserPresence.userId, userId),
  });

  const nextStatus: ChatPresenceStatus =
    current?.status === "invisible" ? "invisible" : "visible";
  await db
    .insert(chatUserPresence)
    .values({
      userId,
      status: nextStatus,
      lastActivity: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: chatUserPresence.userId,
      set: { status: nextStatus, lastActivity: now, updatedAt: now },
    });

  return {
    userId,
    status: nextStatus,
    lastActivity: now,
    updatedAt: now,
  };
}

/**
 * Atualiza presença quando o socket conecta sem sobrescrever o status manual
 */
export async function touchPresenceOnConnect(
  userId: string,
): Promise<ChatPresenceMutationResult> {
  const now = new Date();
  const current = await db.query.chatUserPresence.findFirst({
    where: eq(chatUserPresence.userId, userId),
  });

  if (!current) {
    await db.insert(chatUserPresence).values({
      userId,
      status: "visible",
      lastActivity: now,
      updatedAt: now,
    });

    return {
      userId,
      status: "visible",
      lastActivity: now,
      updatedAt: now,
    };
  }

  const nextStatus = current.status === "invisible" ? "invisible" : "visible";
  await db
    .update(chatUserPresence)
    .set({
      lastActivity: now,
      updatedAt: now,
      ...(current.status === "invisible" ? {} : { status: nextStatus }),
    })
    .where(eq(chatUserPresence.userId, userId));

  return {
    userId,
    status: nextStatus,
    lastActivity: now,
    updatedAt: now,
  };
}

/**
 * Marca o usuário como offline ao encerrar a conexão realtime
 */
export async function markPresenceOfflineOnDisconnect(
  userId: string,
): Promise<ChatPresenceMutationResult | null> {
  const current = await db.query.chatUserPresence.findFirst({
    where: eq(chatUserPresence.userId, userId),
  });

  if (!current) return null;
  if (current.status === "invisible") {
    const now = new Date();
    await db
      .update(chatUserPresence)
      .set({ lastActivity: now, updatedAt: now })
      .where(eq(chatUserPresence.userId, userId));

    return {
      userId,
      status: "invisible",
      lastActivity: now,
      updatedAt: now,
    };
  }

  const now = new Date();
  await db
    .update(chatUserPresence)
    .set({
      status: "invisible",
      lastActivity: now,
      updatedAt: now,
    })
    .where(eq(chatUserPresence.userId, userId));

  return {
    userId,
    status: "invisible",
    lastActivity: now,
    updatedAt: now,
  };
}

/**
 * Monta a resposta padronizada do status do chat
 */
export function getChatStatusResponse(
  userId: string,
  userEmail: string,
  status: "enabled" | "disabled",
): ChatStatusResponse {
  return {
    success: true,
    message: `Status do chat atualizado para: ${status}`,
    userId,
    userEmail,
    status,
    timestamp: getNowTimestamp(),
  };
}

/**
 * Busca presença de todos os usuários
 */
export async function getPresenceAll(): Promise<ChatPresenceRow[]> {
  const presenceData = await db
    .select({
      userId: chatUserPresence.userId,
      userName: authUser.name,
      status: chatUserPresence.status,
      lastActivity: chatUserPresence.lastActivity,
      updatedAt: chatUserPresence.updatedAt,
    })
    .from(chatUserPresence)
    .innerJoin(authUser, eq(chatUserPresence.userId, authUser.id));

  return presenceData;
}

/**
 * Busca os dados do sidebar do chat
 */
export async function getChatSidebar(userId: string): Promise<ChatSidebarResult> {
  const userGroupsRows = await db
    .select({ groupId: userGroup.groupId })
    .from(userGroup)
    .where(eq(userGroup.userId, userId));

  const groupIds = userGroupsRows.map((groupRow) => groupRow.groupId);
  const perms = groupIds.length
    ? await db
        .select({ resource: groupPermission.resource, action: groupPermission.action })
        .from(groupPermission)
        .where(and(inArray(groupPermission.groupId, groupIds), eq(groupPermission.resource, "chat")))
    : [];

  const canViewChat = perms.some((permission) => permission.action === "view_private" || permission.action === "view_group");
  if (!canViewChat) {
    return { canViewChat: false, groups: [], users: [], totalUnread: 0 };
  }

  const activeGroups = await db
    .select({
      groupId: group.id,
      groupName: group.name,
      groupDescription: group.description,
      groupIcon: group.icon,
      groupColor: group.color,
      groupActive: group.active,
    })
    .from(group)
    .where(eq(group.active, true));

  const activeGroupIds = activeGroups.map((currentGroup) => currentGroup.groupId);

  const groupUnreadRaw = activeGroupIds.length
    ? await db
        .select({ receiverGroupId: chatMessage.receiverGroupId, unreadCount: count(chatMessage.id) })
        .from(chatMessage)
        .where(
          and(
            inArray(chatMessage.receiverGroupId, activeGroupIds),
            ne(chatMessage.senderUserId, userId),
            isNull(chatMessage.readAt),
            isNull(chatMessage.deletedAt),
          ),
        )
        .groupBy(chatMessage.receiverGroupId)
    : [];

  const groupUnreadMap = new Map(groupUnreadRaw.map((item) => [item.receiverGroupId, item.unreadCount]));

  const chatGroups: ChatSidebarGroup[] = activeGroups.map((currentGroup) => ({
    id: currentGroup.groupId,
    name: currentGroup.groupName,
    description: currentGroup.groupDescription,
    icon: currentGroup.groupIcon,
    color: currentGroup.groupColor,
    active: currentGroup.groupActive,
    unreadCount: groupUnreadMap.get(currentGroup.groupId) || 0,
    lastMessage: null,
    lastMessageAt: null,
  }));

  const allActiveUsers = await db
    .select({ id: authUser.id, name: authUser.name, email: authUser.email, isActive: authUser.isActive })
    .from(authUser)
    .where(eq(authUser.isActive, true));

  const activeUserIds = allActiveUsers.map((currentUser) => currentUser.id);

  const presenceData = activeUserIds.length
    ? await db
        .select({ userId: chatUserPresence.userId, status: chatUserPresence.status, lastActivity: chatUserPresence.lastActivity })
        .from(chatUserPresence)
        .where(inArray(chatUserPresence.userId, activeUserIds))
    : [];

  const presenceMap = new Map(presenceData.map((presence) => [presence.userId, { status: presence.status, lastActivity: presence.lastActivity }]));

  const unreadCountsRaw = await db
    .select({ senderUserId: chatMessage.senderUserId, unreadCount: count(chatMessage.id) })
    .from(chatMessage)
    .where(and(eq(chatMessage.receiverUserId, userId), isNull(chatMessage.readAt), isNull(chatMessage.deletedAt)))
    .groupBy(chatMessage.senderUserId);

  const unreadMap = new Map(unreadCountsRaw.map((item) => [item.senderUserId, item.unreadCount]));

  const lastMessageMap = new Map<string, { content: string; createdAt: Date }>();
  const sentLast = await db
    .selectDistinctOn([chatMessage.receiverUserId], {
      otherUserId: chatMessage.receiverUserId,
      content: chatMessage.content,
      createdAt: chatMessage.createdAt,
    })
    .from(chatMessage)
    .where(and(eq(chatMessage.senderUserId, userId), isNotNull(chatMessage.receiverUserId), isNull(chatMessage.deletedAt)))
    .orderBy(chatMessage.receiverUserId, desc(chatMessage.createdAt));

  const receivedLast = await db
    .selectDistinctOn([chatMessage.senderUserId], {
      otherUserId: chatMessage.senderUserId,
      content: chatMessage.content,
      createdAt: chatMessage.createdAt,
    })
    .from(chatMessage)
    .where(and(eq(chatMessage.receiverUserId, userId), isNull(chatMessage.deletedAt)))
    .orderBy(chatMessage.senderUserId, desc(chatMessage.createdAt));

  for (const message of [...sentLast, ...receivedLast]) {
    if (!message.otherUserId) {
      continue;
    }

    const previousMessage = lastMessageMap.get(message.otherUserId);
    if (!previousMessage || message.createdAt > previousMessage.createdAt) {
      lastMessageMap.set(message.otherUserId, { content: message.content, createdAt: message.createdAt });
    }
  }

  const chatUsers: ChatSidebarUser[] = allActiveUsers.map((currentUser) => {
    const presence = presenceMap.get(currentUser.id);
    const lastMessage = lastMessageMap.get(currentUser.id);

    return {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      isActive: currentUser.isActive,
      presenceStatus: (presence?.status || "invisible") as "visible" | "invisible",
      lastActivity: presence?.lastActivity || null,
      unreadCount: unreadMap.get(currentUser.id) || 0,
      lastMessage: lastMessage?.content || null,
      lastMessageAt: lastMessage?.createdAt || null,
    };
  });

  chatUsers.sort((leftUser, rightUser) => {
    if (leftUser.unreadCount !== rightUser.unreadCount) {
      return rightUser.unreadCount - leftUser.unreadCount;
    }

    if (leftUser.presenceStatus === "visible" && rightUser.presenceStatus !== "visible") {
      return -1;
    }

    if (rightUser.presenceStatus === "visible" && leftUser.presenceStatus !== "visible") {
      return 1;
    }

    if (leftUser.lastMessageAt && rightUser.lastMessageAt) {
      return rightUser.lastMessageAt.getTime() - leftUser.lastMessageAt.getTime();
    }

    if (leftUser.lastMessageAt && !rightUser.lastMessageAt) {
      return -1;
    }

    if (rightUser.lastMessageAt && !leftUser.lastMessageAt) {
      return 1;
    }

    return leftUser.name.localeCompare(rightUser.name);
  });

  const totalUnread =
    chatUsers.reduce((sum, currentUser) => sum + currentUser.unreadCount, 0) +
    chatGroups.reduce((sum, currentGroup) => sum + currentGroup.unreadCount, 0);

  return { canViewChat: true, groups: chatGroups, users: chatUsers, totalUnread };
}

/**
 * Busca mensagens não lidas
 */
export async function getUnreadMessages(
  userId: string,
  groupId?: string,
  conversationUserId?: string,
  limit: number = 15,
): Promise<{ messages: UnreadMessage[]; count: number }> {
  const msgSelect = {
    id: chatMessage.id,
    content: chatMessage.content,
    createdAt: chatMessage.createdAt,
    senderUserId: chatMessage.senderUserId,
    receiverGroupId: chatMessage.receiverGroupId,
    receiverUserId: chatMessage.receiverUserId,
    deletedAt: chatMessage.deletedAt,
    readAt: chatMessage.readAt,
    senderName: authUser.name,
    senderEmail: authUser.email,
    senderImage: authUser.image,
  };

  if (!groupId && !conversationUserId) {
    const groupMessages = await db
      .select(msgSelect)
      .from(chatMessage)
      .innerJoin(authUser, eq(chatMessage.senderUserId, authUser.id))
      .where(
        and(
          isNull(chatMessage.deletedAt),
          isNull(chatMessage.readAt),
          ne(chatMessage.senderUserId, userId),
        ),
      )
      .orderBy(desc(chatMessage.createdAt))
      .limit(limit * 2);

    const userMessages = await db
      .select(msgSelect)
      .from(chatMessage)
      .innerJoin(authUser, eq(chatMessage.senderUserId, authUser.id))
      .where(
        and(
          eq(chatMessage.receiverUserId, userId),
          isNull(chatMessage.deletedAt),
          isNull(chatMessage.readAt),
          ne(chatMessage.senderUserId, userId),
        ),
      )
      .orderBy(desc(chatMessage.createdAt))
      .limit(limit * 2);

    const allMessages = [...groupMessages, ...userMessages] as UnreadMessage[];
    return { messages: allMessages, count: allMessages.length };
  }

  let unreadMessages: UnreadMessage[] = [];

  if (groupId) {
    unreadMessages = (await db
      .select(msgSelect)
      .from(chatMessage)
      .innerJoin(authUser, eq(chatMessage.senderUserId, authUser.id))
      .where(
        and(
          eq(chatMessage.receiverGroupId, groupId),
          isNull(chatMessage.deletedAt),
          isNull(chatMessage.readAt),
          ne(chatMessage.senderUserId, userId),
        ),
      )
      .orderBy(desc(chatMessage.createdAt))
      .limit(limit)) as UnreadMessage[];
  } else if (conversationUserId) {
    const msgs = await db
      .select(msgSelect)
      .from(chatMessage)
      .innerJoin(authUser, eq(chatMessage.senderUserId, authUser.id))
      .where(
        and(
          or(
            and(eq(chatMessage.senderUserId, userId), eq(chatMessage.receiverUserId, conversationUserId)),
            and(eq(chatMessage.senderUserId, conversationUserId), eq(chatMessage.receiverUserId, userId)),
          ),
          isNull(chatMessage.deletedAt),
          isNull(chatMessage.readAt),
        ),
      )
      .orderBy(desc(chatMessage.createdAt))
      .limit(limit);
    unreadMessages = (msgs.filter((m) => m.senderUserId !== userId)) as UnreadMessage[];
  }

  unreadMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return { messages: unreadMessages, count: unreadMessages.length };
}

const resolveConversationTarget = (message: {
  currentUserId: string;
  senderUserId: string;
  receiverGroupId: string | null;
  receiverUserId: string | null;
}): { targetId: string; targetType: ChatConversationTargetType } => {
  if (message.receiverGroupId) {
    return { targetId: message.receiverGroupId, targetType: "group" };
  }

  if (message.receiverUserId) {
    const targetId =
      message.senderUserId === message.currentUserId
        ? message.receiverUserId
        : message.senderUserId;

    return { targetId, targetType: "user" };
  }

  throw new ChatServiceError("Mensagem inválida.", 500);
};

/**
 * Conta mensagens de uma conversa
 */
export async function getMessagesCount(
  currentUserId: string,
  groupId?: string,
  conversationUserId?: string,
): Promise<number> {
  if (!groupId && !conversationUserId) {
    throw new ChatServiceError("Especifique groupId ou userId.", 400);
  }

  if (groupId) {
    const [result] = await db
      .select({ totalCount: count(chatMessage.id) })
      .from(chatMessage)
      .where(and(eq(chatMessage.receiverGroupId, groupId), isNull(chatMessage.deletedAt)));

    return Number(result?.totalCount ?? 0);
  }

  const targetUserId = conversationUserId;
  if (!targetUserId) {
    throw new ChatServiceError("Especifique groupId ou userId.", 400);
  }

  const [result] = await db
    .select({ totalCount: count(chatMessage.id) })
    .from(chatMessage)
    .where(
      and(
        or(
          and(
            eq(chatMessage.senderUserId, currentUserId),
            eq(chatMessage.receiverUserId, targetUserId),
          ),
          and(
            eq(chatMessage.senderUserId, targetUserId),
            eq(chatMessage.receiverUserId, currentUserId),
          ),
        ),
        isNull(chatMessage.deletedAt),
      ),
    );

  return Number(result?.totalCount ?? 0);
}

/**
 * Marca uma única mensagem como lida
 */
export async function markMessageAsRead(
  currentUserId: string,
  messageId: string,
): Promise<ChatMessageReadResult> {
  const message = await db
    .select({
      id: chatMessage.id,
      senderUserId: chatMessage.senderUserId,
      receiverGroupId: chatMessage.receiverGroupId,
      receiverUserId: chatMessage.receiverUserId,
      readAt: chatMessage.readAt,
      deletedAt: chatMessage.deletedAt,
    })
    .from(chatMessage)
    .where(eq(chatMessage.id, messageId))
    .limit(1);

  if (message.length === 0) {
    throw new ChatServiceError("Mensagem não encontrada.", 404);
  }

  const record = message[0];
  if (record.deletedAt) {
    throw new ChatServiceError("Mensagem não encontrada.", 404);
  }

  const now = new Date();

  if (record.receiverGroupId) {
    if (record.senderUserId === currentUserId) {
      throw new ChatServiceError("Você não pode marcar sua própria mensagem como lida.", 403);
    }

    if (!record.readAt) {
      await db
        .update(chatMessage)
        .set({ readAt: now, updatedAt: now })
        .where(eq(chatMessage.id, messageId));
    }

    return {
      messageId,
      targetId: record.receiverGroupId,
      targetType: "group",
      readAt: record.readAt ?? now,
      updatedCount: record.readAt ? 0 : 1,
    };
  }

  if (!record.receiverUserId) {
    throw new ChatServiceError("Mensagem inválida.", 500);
  }

  if (record.receiverUserId !== currentUserId) {
    throw new ChatServiceError("Você não pode marcar esta mensagem como lida.", 403);
  }

  if (!record.readAt) {
    await db
      .update(chatMessage)
      .set({ readAt: now, updatedAt: now })
      .where(eq(chatMessage.id, messageId));
  }

  return {
    messageId,
    targetId: record.senderUserId,
    targetType: "user",
    readAt: record.readAt ?? now,
    updatedCount: record.readAt ? 0 : 1,
  };
}

/**
 * Marca todas as mensagens de uma conversa como lidas
 */
export async function markMessagesAsRead(
  currentUserId: string,
  targetId: string,
  targetType: ChatConversationTargetType,
): Promise<ChatMessageReadResult> {
  const now = new Date();

  const whereCondition =
    targetType === "group"
      ? and(
          eq(chatMessage.receiverGroupId, targetId),
          ne(chatMessage.senderUserId, currentUserId),
          isNull(chatMessage.readAt),
          isNull(chatMessage.deletedAt),
        )
      : and(
          eq(chatMessage.receiverUserId, currentUserId),
          eq(chatMessage.senderUserId, targetId),
          isNull(chatMessage.readAt),
          isNull(chatMessage.deletedAt),
        );

  const updated = await db
    .update(chatMessage)
    .set({ readAt: now, updatedAt: now })
    .where(whereCondition)
    .returning({ id: chatMessage.id });

  return {
    messageId: updated[0]?.id ?? "",
    targetId,
    targetType,
    readAt: now,
    updatedCount: updated.length,
  };
}

/**
 * Exclui uma mensagem enviada pelo próprio usuário
 */
export async function deleteMessage(
  currentUserId: string,
  messageId: string,
): Promise<ChatMessageDeleteResult> {
  const message = await db
    .select({
      id: chatMessage.id,
      senderUserId: chatMessage.senderUserId,
      receiverGroupId: chatMessage.receiverGroupId,
      receiverUserId: chatMessage.receiverUserId,
      createdAt: chatMessage.createdAt,
      deletedAt: chatMessage.deletedAt,
    })
    .from(chatMessage)
    .where(eq(chatMessage.id, messageId))
    .limit(1);

  if (message.length === 0) {
    throw new ChatServiceError("Mensagem não encontrada.", 404);
  }

  const record = message[0];
  if (record.deletedAt) {
    throw new ChatServiceError("Mensagem não encontrada.", 404);
  }

  if (record.senderUserId !== currentUserId) {
    throw new ChatServiceError(
      "Você não tem permissão para excluir esta mensagem.",
      403,
    );
  }

  const hoursSinceCreated =
    (Date.now() - new Date(record.createdAt).getTime()) / (1000 * 60 * 60);
  if (hoursSinceCreated > 24) {
    throw new ChatServiceError(
      "Prazo para exclusão expirado (máximo 24 horas).",
      400,
    );
  }

  const now = new Date();
  await db
    .update(chatMessage)
    .set({
      deletedAt: now,
      content: "[Mensagem excluída]",
      updatedAt: now,
    })
    .where(eq(chatMessage.id, messageId));

  const conversation = resolveConversationTarget({
    currentUserId,
    senderUserId: record.senderUserId,
    receiverGroupId: record.receiverGroupId,
    receiverUserId: record.receiverUserId,
  });

  return {
    messageId,
    targetId: conversation.targetId,
    targetType: conversation.targetType,
    deletedAt: now,
  };
}
