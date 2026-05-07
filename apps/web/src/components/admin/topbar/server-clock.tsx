"use client";

import { useEffect, useState } from "react";
import type { ApiResponse } from "@/lib/api-response";

export default function ServerClock({ apiUrl }: { apiUrl: string }) {
  // Placeholder estável para o primeiro render SSR/CSR e evitar mismatch.
  const [time, setTime] = useState<string>("--:--:--");
  const [date, setDate] = useState<string>("");



  useEffect(() => {
    let offset = 0;
    let interval: NodeJS.Timeout | undefined;

    async function fetchServerTimeAndDate() {
      try {
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error("Erro ao buscar horário do servidor");
        const payload = (await res.json()) as
          | ApiResponse<{ time?: string; timestamp?: string }>
          | { time?: string; timestamp?: string };

        // Suporta resposta padronizada ApiResponse { data: { time: '...' } }
        // ou formatos simples { time: '...' } / { timestamp: '...' }
        const timeString =
          (payload as ApiResponse<{ time?: string }>)?.data?.time ??
          (payload as { time?: string })?.time ??
          (payload as { timestamp?: string })?.timestamp ??
          null;

        if (timeString && typeof timeString === "string") {
          const serverDate = new Date(timeString);
          if (!Number.isNaN(serverDate.getTime())) {
            const localDate = new Date();
            offset = serverDate.getTime() - localDate.getTime();
            setDate(serverDate.toLocaleDateString("pt-BR"));
          } else {
            console.warn("ServerClock: servidor retornou horário inválido", timeString);
          }
        } else {
          console.warn("ServerClock: resposta do servidor sem campo de horário", payload);
        }
      } catch (err) {
        console.warn("ServerClock: failed to fetch server time", err);
      } finally {
        // Garantir que o relógio atualize mesmo se o fetch falhar
        updateTime();
        interval = setInterval(updateTime, 1000);
      }
    }

    function updateTime() {
      const now = new Date(Date.now() + offset);
      setTime(now.toLocaleTimeString("pt-BR", { hour12: false }));
    }

    fetchServerTimeAndDate();
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [apiUrl]);

  return (
    <div className="flex items-center gap-1 mr-2 text-sm font-mono text-zinc-400 dark:text-zinc-300 select-none">
      <span className="icon-[lucide--clock] size-5" title={date} />
      <span className="mt-0.5" suppressHydrationWarning>{time}</span>
    </div>
  );
}
