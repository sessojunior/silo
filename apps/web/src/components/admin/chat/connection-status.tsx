"use client";

import { useChat } from "@/context/chat-context";

export default function ConnectionStatus() {
  const { realtimeStatus } = useChat();

  if (realtimeStatus === "connected") {
    return null;
  }

  const statusMessage =
    realtimeStatus === "connecting"
      ? "Conectando ao chat..."
      : realtimeStatus === "error"
        ? "Erro na conexão do chat"
        : "Chat desconectado";

  return (
    <div className="flex items-center justify-center gap-2 bg-yellow-50 px-4 py-2 text-sm text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
      {realtimeStatus === "connecting" ? (
        <div className="h-2 w-2 animate-spin rounded-full border border-yellow-600 border-t-transparent"></div>
      ) : (
        <span className="h-2 w-2 rounded-full bg-red-500"></span>
      )}
      <span>{statusMessage}</span>
    </div>
  );
}
