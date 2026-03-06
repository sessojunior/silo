"use client";

import { usePathname } from "next/navigation";
import Button from "@/components/admin/nav/Button";
import Content from "@/components/admin/nav/Content";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DASHBOARD_TABS = [
  { label: "Visão geral", url: "/admin/dashboard" },
  { label: "Monitoramento", url: "/admin/dashboard/monitoring" },
] as const;

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-[calc(100vh-64px)] w-full flex-col bg-white dark:bg-zinc-900">
      <div className="flex flex-col">
        <div className="sticky top-16 z-30 flex">
          <div className="h-19 flex w-full border-b border-zinc-200 bg-zinc-100 px-4 py-3 transition dark:border-zinc-700 dark:bg-zinc-700">
            <div className="flex w-full items-center justify-between gap-3">
              <div className="flex gap-x-2">
                {DASHBOARD_TABS.map((tab) => {
                  const isOverview = tab.url === "/admin/dashboard";
                  const isActive = isOverview
                    ? pathname === tab.url
                    : pathname.startsWith(tab.url);

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

        <Content>
          <div className="flex min-h-full w-full flex-col items-start justify-start gap-8 text-zinc-600 dark:text-zinc-200">
            {children}
          </div>
        </Content>
      </div>
    </div>
  );
}
