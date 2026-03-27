"use client";

import { useEffect, useState } from "react";

export default function ServerClock({ apiUrl }: { apiUrl: string }) {
  const localNow = new Date();
  const [time, setTime] = useState<string>(localNow.toLocaleTimeString("pt-BR", { hour12: false }));
  const [date, setDate] = useState<string>(localNow.toLocaleDateString("pt-BR"));

  useEffect(() => {
    let offset = 0;
    let interval: NodeJS.Timeout | undefined;

    async function fetchServerTimeAndDate() {
      try {
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error("Erro ao buscar horário do servidor");
        const data = await res.json();
        const serverDate = new Date(data.time);
        const localDate = new Date();
        offset = serverDate.getTime() - localDate.getTime();
        setDate(serverDate.toLocaleDateString("pt-BR"));
        updateTime();
        interval = setInterval(updateTime, 1000);
      } catch (err) {
        // keep local time/date as fallback and log for debugging
        // eslint-disable-next-line no-console
        console.warn("ServerClock: failed to fetch server time", err);
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
      <span className="mt-0.5">{time}</span>
    </div>
  );
}
