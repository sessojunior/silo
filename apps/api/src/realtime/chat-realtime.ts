import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket, type WebSocket as WebSocketClient } from "ws";

import { auth, type AuthUser } from "../auth/setup.js";
import {
  markPresenceOfflineOnDisconnect,
  touchPresenceOnConnect,
} from "../services/chat-service.js";
import {
  CHAT_REALTIME_PATH,
  type ChatRealtimeServerMessage,
} from "@silo/engine/contracts/dto/chat-realtime";

const HEARTBEAT_INTERVAL_MS = 30_000;

type SocketWithState = WebSocket & {
  isAlive?: boolean;
};

type ConnectedSocket = {
  user: AuthUser;
};

class ChatRealtimeHub {
  private websocketServer: WebSocketServer | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private initialized = false;
  private readonly socketState = new WeakMap<WebSocketClient, ConnectedSocket>();
  private readonly userConnectionCounts = new Map<string, number>();

  initialize(server: HttpServer): void {
    if (this.initialized) return;
    this.initialized = true;

    this.websocketServer = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request, socket, head) => {
      void this.handleUpgrade(request, socket, head);
    });

    this.websocketServer.on("connection", (socket: WebSocketClient, request: IncomingMessage) => {
      void this.handleConnection(socket as SocketWithState, request);
    });

    this.startHeartbeat();
  }

  broadcast(event: ChatRealtimeServerMessage): void {
    if (!this.websocketServer) return;

    const payload = JSON.stringify(event);
    for (const socket of this.websocketServer.clients) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      socket.send(payload);
    }
  }

  shutdown(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.websocketServer) {
      this.websocketServer.close();
      this.websocketServer = null;
    }

    this.initialized = false;
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;

    this.heartbeatTimer = setInterval(() => {
      if (!this.websocketServer) return;

      for (const socket of this.websocketServer.clients) {
        const trackedSocket = socket as SocketWithState;
        if (trackedSocket.isAlive === false) {
          trackedSocket.terminate();
          continue;
        }

        trackedSocket.isAlive = false;
        trackedSocket.ping();
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private async handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): Promise<void> {
    if (!this.websocketServer) {
      socket.destroy();
      return;
    }

    const requestUrl = request.url ? new URL(request.url, "http://localhost") : null;
    if (!requestUrl || requestUrl.pathname !== CHAT_REALTIME_PATH) {
      socket.destroy();
      return;
    }

    const user = await this.authenticate(request);
    if (!user) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    this.websocketServer.handleUpgrade(request, socket, head, (websocket: WebSocketClient) => {
      this.socketState.set(websocket, { user });
      this.websocketServer?.emit("connection", websocket, request);
    });
  }

  private async handleConnection(
    socket: SocketWithState,
    request: IncomingMessage,
  ): Promise<void> {
    const user = this.socketState.get(socket)?.user;
    if (!user) {
      socket.close(1008, "Usuário não autenticado.");
      return;
    }

    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });

    const nextConnectionCount = (this.userConnectionCounts.get(user.id) ?? 0) + 1;
    this.userConnectionCounts.set(user.id, nextConnectionCount);

    if (nextConnectionCount === 1) {
      const presence = await touchPresenceOnConnect(user.id);
      this.broadcast({
        type: "chat.presence.updated",
        data: {
          userId: presence.userId,
          status: presence.status,
          lastActivity: presence.lastActivity.toISOString(),
          updatedAt: presence.updatedAt.toISOString(),
        },
      });
    }

    socket.send(
      JSON.stringify({
        type: "chat.connected",
        data: {
          userId: user.id,
          timestamp: new Date().toISOString(),
        },
      } satisfies ChatRealtimeServerMessage),
    );

    socket.on("close", () => {
      void this.handleDisconnect(user.id);
    });

    socket.on("error", (error: Error) => {
      console.error("❌ [CHAT_REALTIME] Erro no socket:", {
        userId: user.id,
        error,
      });
    });

    this.socketState.set(socket, { user });

    console.log("ℹ️ [CHAT_REALTIME] Cliente conectado:", {
      userId: user.id,
      userEmail: user.email,
      path: request.url,
    });
  }

  private async handleDisconnect(userId: string): Promise<void> {
    const currentCount = this.userConnectionCounts.get(userId) ?? 0;
    if (currentCount > 1) {
      this.userConnectionCounts.set(userId, currentCount - 1);
      return;
    }

    this.userConnectionCounts.delete(userId);

    const presence = await markPresenceOfflineOnDisconnect(userId);
    if (!presence) return;

    this.broadcast({
      type: "chat.presence.updated",
      data: {
        userId: presence.userId,
        status: presence.status,
        lastActivity: presence.lastActivity.toISOString(),
        updatedAt: presence.updatedAt.toISOString(),
      },
    });
  }

  private async authenticate(request: IncomingMessage): Promise<AuthUser | null> {
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (typeof value === "string") {
        headers.set(key, value);
        continue;
      }

      if (Array.isArray(value)) {
        headers.set(key, value.join(", "));
      }
    }

    try {
      const session = await auth.api.getSession({ headers });
      return session?.user ?? null;
    } catch (error) {
      console.error("❌ [CHAT_REALTIME] Erro ao autenticar socket:", { error });
      return null;
    }
  }
}

const chatRealtimeHub = new ChatRealtimeHub();

export function initializeChatRealtime(server: HttpServer): void {
  chatRealtimeHub.initialize(server);
}

export function broadcastChatRealtimeEvent(
  event: ChatRealtimeServerMessage,
): void {
  chatRealtimeHub.broadcast(event);
}

export function shutdownChatRealtime(): void {
  chatRealtimeHub.shutdown();
}
