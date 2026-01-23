import { count, eq, and, inArray, isNotNull, isNull, ne, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { successResponse, errorResponse } from "@/lib/api-response";
import { requireAuthUser } from "@/lib/auth/server";
import { getUserPermissionsSummary, hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

// Tipos para sidebar
interface ChatGroup {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  active: boolean;
  unreadCount: number;
  lastMessage: string | null;
  lastMessageAt: Date | null;
}

interface ChatUser {
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

interface SidebarData {
  groups: ChatGroup[];
  users: ChatUser[];
  totalUnread: number;
}

// GET: Buscar dados completos da sidebar
export async function GET() {
  try {
    const authResult = await requireAuthUser();
    if (!authResult.ok) return authResult.response;
    const user = authResult.user;
    const { permissions } = await getUserPermissionsSummary(user.id);
    const canViewChat =
      hasPermission(permissions, "chat", "view_private") ||
      hasPermission(permissions, "chat", "view_group");

    if (!canViewChat) {
      return errorResponse("Permissão insuficiente.", 403);
    }

    // 1. BUSCAR CHATGROUPS onde usuário participa
    const userGroups = await db
      .select({
        groupId: schema.userGroup.groupId,
        groupName: schema.group.name,
        groupDescription: schema.group.description,
        groupIcon: schema.group.icon,
        groupColor: schema.group.color,
        groupActive: schema.group.active,
      })
      .from(schema.userGroup)
      .innerJoin(schema.group, eq(schema.userGroup.groupId, schema.group.id))
      .where(
        and(
          eq(schema.userGroup.userId, user.id),
          eq(schema.group.active, true),
        ),
      );

    const groupIds = userGroups.map((g) => g.groupId);

    const groupUnreadCountsRaw = groupIds.length
      ? await db
          .select({
            receiverGroupId: schema.chatMessage.receiverGroupId,
            unreadCount: count(schema.chatMessage.id),
          })
          .from(schema.chatMessage)
          .where(
            and(
              inArray(schema.chatMessage.receiverGroupId, groupIds),
              ne(schema.chatMessage.senderUserId, user.id),
              isNull(schema.chatMessage.readAt),
              isNull(schema.chatMessage.deletedAt),
            ),
          )
          .groupBy(schema.chatMessage.receiverGroupId)
      : [];

    const groupUnreadMap = new Map(
      groupUnreadCountsRaw.map((g) => [g.receiverGroupId, g.unreadCount]),
    );

    const groupLastMessagesRaw = groupIds.length
      ? await db
          .selectDistinctOn(
            [schema.chatMessage.receiverGroupId],
            {
              receiverGroupId: schema.chatMessage.receiverGroupId,
              content: schema.chatMessage.content,
              createdAt: schema.chatMessage.createdAt,
            },
          )
          .from(schema.chatMessage)
          .where(
            and(
              inArray(schema.chatMessage.receiverGroupId, groupIds),
              isNull(schema.chatMessage.deletedAt),
            ),
          )
          .orderBy(
            schema.chatMessage.receiverGroupId,
            desc(schema.chatMessage.createdAt),
          )
      : [];

    const groupLastMessageMap = new Map(
      groupLastMessagesRaw
        .filter((msg) => Boolean(msg.receiverGroupId))
        .map((msg) => [
          msg.receiverGroupId as string,
          { content: msg.content, createdAt: msg.createdAt },
        ]),
    );

    // Mapear chatGroups com contagem real de não lidas e última mensagem
    const chatGroups: ChatGroup[] = userGroups.map((g) => {
      const lastMessageData = groupLastMessageMap.get(g.groupId);
      return {
        id: g.groupId,
        name: g.groupName,
        description: g.groupDescription,
        icon: g.groupIcon,
        color: g.groupColor,
        active: g.groupActive,
        unreadCount: groupUnreadMap.get(g.groupId) || 0, // Contagem real de mensagens não lidas
        lastMessage: lastMessageData?.content || null,
        lastMessageAt: lastMessageData?.createdAt || null,
      };
    });

    // 2. BUSCAR TODOS USUARIOS ATIVOS (exceto atual)
    const allActiveUsers = await db
      .select({
        id: schema.authUser.id,
        name: schema.authUser.name,
        email: schema.authUser.email,
        isActive: schema.authUser.isActive,
      })
      .from(schema.authUser)
      .where(
        and(
          ne(schema.authUser.id, user.id),
          eq(schema.authUser.isActive, true),
        ),
      );

    const activeUserIds = allActiveUsers.map((u) => u.id);

    const presenceData = activeUserIds.length
      ? await db
          .select({
            userId: schema.chatUserPresence.userId,
            status: schema.chatUserPresence.status,
            lastActivity: schema.chatUserPresence.lastActivity,
          })
          .from(schema.chatUserPresence)
          .where(inArray(schema.chatUserPresence.userId, activeUserIds))
      : [];

    const presenceMap = new Map(
      presenceData.map((p) => [
        p.userId,
        { status: p.status, lastActivity: p.lastActivity },
      ]),
    );

    // 5. CONTAR MENSAGENS NÃO LIDAS POR USUÁRIO
    const unreadCountsRaw = await db
      .select({
        senderUserId: schema.chatMessage.senderUserId,
        unreadCount: count(schema.chatMessage.id),
      })
      .from(schema.chatMessage)
      .where(
        and(
          eq(schema.chatMessage.receiverUserId, user.id), // userMessage para usuário atual
          isNull(schema.chatMessage.readAt), // Não lida
          isNull(schema.chatMessage.deletedAt), // Não excluída
        ),
      )
      .groupBy(schema.chatMessage.senderUserId);

    const unreadMap = new Map(
      unreadCountsRaw.map((u) => [u.senderUserId, u.unreadCount]),
    );

    const sentLastMessagesRaw = await db
      .selectDistinctOn(
        [schema.chatMessage.receiverUserId],
        {
          otherUserId: schema.chatMessage.receiverUserId,
          content: schema.chatMessage.content,
          createdAt: schema.chatMessage.createdAt,
        },
      )
      .from(schema.chatMessage)
      .where(
        and(
          eq(schema.chatMessage.senderUserId, user.id),
          isNotNull(schema.chatMessage.receiverUserId),
          isNull(schema.chatMessage.deletedAt),
        ),
      )
      .orderBy(
        schema.chatMessage.receiverUserId,
        desc(schema.chatMessage.createdAt),
      );

    const receivedLastMessagesRaw = await db
      .selectDistinctOn(
        [schema.chatMessage.senderUserId],
        {
          otherUserId: schema.chatMessage.senderUserId,
          content: schema.chatMessage.content,
          createdAt: schema.chatMessage.createdAt,
        },
      )
      .from(schema.chatMessage)
      .where(
        and(
          eq(schema.chatMessage.receiverUserId, user.id),
          isNull(schema.chatMessage.deletedAt),
        ),
      )
      .orderBy(
        schema.chatMessage.senderUserId,
        desc(schema.chatMessage.createdAt),
      );

    const lastMessageMap = new Map<string, { content: string; createdAt: Date }>();
    for (const msg of [...sentLastMessagesRaw, ...receivedLastMessagesRaw]) {
      if (!msg.otherUserId) continue;
      const prev = lastMessageMap.get(msg.otherUserId);
      if (!prev || msg.createdAt > prev.createdAt) {
        lastMessageMap.set(msg.otherUserId, {
          content: msg.content,
          createdAt: msg.createdAt,
        });
      }
    }

    // 7. MONTAR LISTA DE CHATUSERS
    const chatUsers: ChatUser[] = allActiveUsers.map((activeUser) => {
      const presence = presenceMap.get(activeUser.id);
      const unreadCount = unreadMap.get(activeUser.id) || 0;
      const lastMessage = lastMessageMap.get(activeUser.id);

      return {
        id: activeUser.id,
        name: activeUser.name,
        email: activeUser.email,
        isActive: activeUser.isActive,
        presenceStatus: (presence?.status ||
          "invisible") as ChatUser["presenceStatus"],
        lastActivity: presence?.lastActivity || null,
        unreadCount,
        lastMessage: lastMessage?.content || null,
        lastMessageAt: lastMessage?.createdAt || null,
      };
    });

    // MOSTRAR TODOS OS USUÁRIOS ATIVOS para permitir contato
    // (não filtrar por interação - todos ficam disponíveis)

    // Ordenar chatUsers: não lidas primeiro, visíveis segundo, depois por nome
    chatUsers.sort((a, b) => {
      // 1. Prioridade: mensagens não lidas
      if (a.unreadCount !== b.unreadCount) {
        return b.unreadCount - a.unreadCount;
      }

      // 2. Prioridade: usuários visíveis
      if (a.presenceStatus === "visible" && b.presenceStatus !== "visible") {
        return -1;
      }
      if (b.presenceStatus === "visible" && a.presenceStatus !== "visible") {
        return 1;
      }

      // 3. Prioridade: última mensagem recente
      if (a.lastMessageAt && b.lastMessageAt) {
        return b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
      }
      if (a.lastMessageAt && !b.lastMessageAt) {
        return -1;
      }
      if (b.lastMessageAt && !a.lastMessageAt) {
        return 1;
      }

      // 4. Por último: ordem alfabética
      return a.name.localeCompare(b.name);
    });

    // 7. CALCULAR TOTAL DE NÃO LIDAS (usuários + grupos)
    const userUnreadTotal = chatUsers.reduce(
      (sum: number, user: ChatUser) => sum + user.unreadCount,
      0,
    );
    const groupUnreadTotal = chatGroups.reduce(
      (sum: number, group: ChatGroup) => sum + group.unreadCount,
      0,
    );
    const totalUnread = userUnreadTotal + groupUnreadTotal;

    const sidebarData: SidebarData = {
      groups: chatGroups,
      users: chatUsers,
      totalUnread,
    };

    return successResponse(sidebarData);
  } catch (error) {
    console.error("❌ [API_CHAT_SIDEBAR] Erro ao carregar dados da sidebar:", {
      error,
    });
    return errorResponse("Erro ao carregar sidebar", 500);
  }
}
