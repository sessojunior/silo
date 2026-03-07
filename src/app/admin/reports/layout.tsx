"use client";

import { usePathname } from "next/navigation";
import Button from "@/components/admin/nav/Button";
import { config } from "@/lib/config";

interface ReportsLayoutProps {
  children: React.ReactNode;
}

const REPORT_TABS: Array<{ label: string; url: string }> = [
  { label: "Disponibilidade por Produto", url: "/admin/reports/availability" },
  { label: "Problemas Mais Frequentes", url: "/admin/reports/problems" },
  { label: "Projetos e Atividades", url: "/admin/reports/projects" },
];

const normalizePathname = (pathname: string): string => {
  const path = pathname.split("?")[0].split("#")[0] || "/";
  const basePath = config.publicBasePath;

  const withoutBasePath =
    basePath && (path === basePath || path.startsWith(`${basePath}/`))
      ? path.slice(basePath.length) || "/"
      : path;

  if (withoutBasePath.length > 1 && withoutBasePath.endsWith("/")) {
    return withoutBasePath.slice(0, -1);
  }

  return withoutBasePath;
};

export default function ReportsLayout({ children }: ReportsLayoutProps) {
  const pathname = usePathname();
  const normalizedPathname = normalizePathname(pathname || "/");

  return (
    <div className="flex w-full flex-col bg-white dark:bg-zinc-900">
      <div className="flex flex-col">
        <div className="fixed inset-x-0 top-16 z-30">
          <div className="lg:pl-65">
            <div className="h-19 flex w-full border-b border-zinc-200 bg-zinc-100 px-4 py-3 transition dark:border-zinc-700 dark:bg-zinc-700">
              <div className="flex w-full items-center justify-between gap-3">
                <div className="flex gap-x-2">
                  {REPORT_TABS.map((tab) => (
                    <Button
                      key={tab.url}
                      href={tab.url}
                      active={normalizedPathname === tab.url}
                    >
                      {tab.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full pt-19">
          <div className="scrollbar h-[calc(100dvh-140px)] overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
