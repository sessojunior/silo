"use client";

import { useEffect, useState } from "react";

export default function ServerClock({ apiUrl }: { apiUrl: string }) {
  const [time, setTime] = useState<string>("--:--:--");

  useEffect(() => {
    const interval: NodeJS.Timeout = setInterval(updateTime, 1000);
    let offset = 0;

    async function fetchServerTime() {
      try {
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error("Erro ao buscar horário do servidor");
        const data = await res.json();
        // Espera que a API retorne { time: "2026-03-27T15:00:00Z" }
        const serverDate = new Date(data.time);
        const localDate = new Date();
        offset = serverDate.getTime() - localDate.getTime();
        updateTime();
      } catch {
        setTime("--:--:--");
      }
    }

    function updateTime() {
      const now = new Date(Date.now() + offset);
      setTime(now.toLocaleTimeString("pt-BR", { hour12: false }));
    }

    fetchServerTime();
    return () => clearInterval(interval);
  }, [apiUrl]);

  return (
    <div className="flex items-center gap-1 mr-2 text-sm font-mono text-zinc-400 dark:text-zinc-300 select-none">
      <span className="icon-[lucide--clock] size-5" />
      <span className="mt-0.5">{time}</span>
    </div>
  );
}
