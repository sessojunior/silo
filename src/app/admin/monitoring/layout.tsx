"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import Button from "@/components/admin/nav/Button";
import Content from "@/components/admin/nav/Content";

interface MonitoringLayoutProps {
  children: React.ReactNode;
}

const MONITORING_TABS = [
  { label: "Visão geral", url: "/admin/dashboard" },
  { label: "Monitoramento (Fake)", url: "/admin/monitoring" },
] as const;

const MONITORING_REFRESH_SECONDS = 120;
const MONITORING_REFRESH_EVENT = "monitoring-page-refresh";

export default function MonitoringLayout({ children }: MonitoringLayoutProps) {
  const pathname = usePathname();
  const [remainingSeconds, setRemainingSeconds] = useState(
    MONITORING_REFRESH_SECONDS,
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          window.dispatchEvent(new Event(MONITORING_REFRESH_EVENT));
          return MONITORING_REFRESH_SECONDS;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const countdownLabel = useMemo(() => {
    const minutes = Math.floor(remainingSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (remainingSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [remainingSeconds]);

  function handleManualRefresh() {
    setRemainingSeconds(MONITORING_REFRESH_SECONDS);
    window.dispatchEvent(new Event(MONITORING_REFRESH_EVENT));
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white dark:bg-zinc-900">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="fixed inset-x-0 top-16 z-30">
          <div className="lg:pl-65">
            <div className="h-19 flex w-full border-b border-zinc-200 bg-zinc-100 px-4 py-3 transition dark:border-zinc-700 dark:bg-zinc-700">
              <div className="flex w-full items-center justify-between gap-3">
                <div className="flex gap-x-2">
                  {MONITORING_TABS.map((tab) => {
                    const isActive =
                      pathname === tab.url || pathname.startsWith(`${tab.url}/`);

                    return (
                      <Button key={tab.url} href={tab.url} active={isActive}>
                        {tab.label}
                      </Button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-base font-medium text-zinc-800 dark:text-zinc-200">
                    Atualiza em {countdownLabel}
                  </div>
                  <button
                    type="button"
                    onClick={handleManualRefresh}
                    className="inline-flex size-9 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    title="Atualizar monitoramento"
                    aria-label="Atualizar monitoramento"
                  >
                    <span className="icon-[lucide--refresh-cw] size-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <Content mode="full-no-scroll">
            <div className="flex h-full min-h-0 w-full flex-col items-start justify-start gap-8 pt-19 text-zinc-600 dark:text-zinc-200">
              {children}
            </div>
          </Content>
        </div>
      </div>
    </div>
  );
}
