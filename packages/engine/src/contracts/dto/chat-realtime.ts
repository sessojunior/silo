export const CHAT_REALTIME_PATH = "/api/chat/ws" as const;

export type ChatConversationTargetType = "group" | "user";
export type ChatPresenceStatus = "visible" | "invisible";

export type ChatRealtimeMessageDto = {
  id: string;
  content: string;
  senderUserId: string;
  senderName: string;
  receiverGroupId: string | null;
  receiverUserId: string | null;
  createdAt: string;
  readAt: string | null;
  deletedAt: string | null;
  messageType: "groupMessage" | "userMessage";
};

export type ChatRealtimeEvent =
  | {
      type: "chat.message.created";
      data: {
        message: ChatRealtimeMessageDto;
      };
    }
  | {
      type: "chat.message.read";
      data: {
        messageId: string;
        targetId: string;
        targetType: ChatConversationTargetType;
        readAt: string;
      };
    }
  | {
      type: "chat.messages.read";
      data: {
        targetId: string;
        targetType: ChatConversationTargetType;
        readAt: string;
        updatedCount: number;
      };
    }
  | {
      type: "chat.message.deleted";
      data: {
        messageId: string;
        targetId: string;
        targetType: ChatConversationTargetType;
        deletedAt: string;
      };
    }
  | {
      type: "chat.presence.updated";
      data: {
        userId: string;
        status: ChatPresenceStatus;
        lastActivity: string;
        updatedAt: string;
      };
    };

export type ChatRealtimeServerMessage =
  | ChatRealtimeEvent
  | {
      type: "chat.connected";
      data: {
        userId: string;
        timestamp: string;
      };
    };
