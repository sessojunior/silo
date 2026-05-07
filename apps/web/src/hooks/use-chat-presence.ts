"use client";

import { useState, useEffect, useCallback } from "react";
import { useChat } from "@/context/chat-context";
import { readApiResponse } from "@/lib/api-response";
import { config } from "@/lib/config";

export function useChatPresence() {
  const [localPresence, setLocalPresence] = useState<"visible" | "invisible">(
    "invisible",
  );
  const { currentPresence, updatePresence } = useChat();

  // Sincronizar com o contexto
  useEffect(() => {
    if (currentPresence && currentPresence !== "invisible") {
      setLocalPresence(currentPresence);
    }
  }, [currentPresence]);

  // Buscar status atual da API
  const fetchCurrentPresence = useCallback(async () => {
    try {
      const response = await fetch(
        config.getApiUrl("/api/admin/chat/presence"),
        { credentials: "include" },
      );
      if (response.ok) {
        const apiResponse = await readApiResponse(response);
        if (apiResponse.success && apiResponse.data) {
          const payload = apiResponse.data as {
            currentUserPresence?: { status?: "visible" | "invisible" };
          };

          if (payload.currentUserPresence?.status) {
            setLocalPresence(payload.currentUserPresence.status);
          }
        }
      }
    } catch (error) {
      console.error("❌ [HOOK_CHAT_PRESENCE] Erro ao buscar status atual:", {
        error,
      });
    }
  }, []);

  // Alterar status de presença
  const changePresence = useCallback(
    async (status: "visible" | "invisible") => {
      setLocalPresence(status);
      await updatePresence(status);
    },
    [updatePresence],
  );

  return {
    localPresence,
    changePresence,
    fetchCurrentPresence,
  };
}
