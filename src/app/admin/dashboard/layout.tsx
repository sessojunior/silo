"use client";

import { usePathname } from "next/navigation";
import Button from "@/components/admin/nav/Button";
import Content from "@/components/admin/nav/Content";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DASHBOARD_TABS = [
  { label: "Visão geral", url: "/admin/dashboard" },
  { label: "Monitoramento (Fake)", url: "/admin/monitoring" },
] as const;

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white dark:bg-zinc-900">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="fixed inset-x-0 top-16 z-30">
          <div className="lg:pl-65">
            <div className="h-19 flex w-full border-b border-zinc-200 bg-zinc-100 px-4 py-3 transition dark:border-zinc-700 dark:bg-zinc-700">
              <div className="flex w-full items-center justify-between gap-3">
                <div className="flex gap-x-2">
                  {DASHBOARD_TABS.map((tab) => {
                    const isActive =
                      pathname === tab.url || pathname.startsWith(`${tab.url}/`);

                    return (
                      <Button key={tab.url} href={tab.url} active={isActive}>
                        {tab.label}
                      </Button>
                    );
                  })}
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
