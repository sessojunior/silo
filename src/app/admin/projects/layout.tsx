"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import Button from "@/components/admin/nav/Button";
import { config } from "@/lib/config";
import type { ApiResponse } from "@/lib/api-response";

interface ProjectsLayoutProps {
  children: React.ReactNode;
}

interface ProjectItem {
  id: string;
  name: string;
}

interface ActivityItem {
  id: string;
  name: string;
}

const truncateLabel = (value: string, max = 42): string => {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
};

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

export default function ProjectsLayout({ children }: ProjectsLayoutProps) {
  const params = useParams();
  const pathname = usePathname();
  const projectId = typeof params.projectId === "string" ? params.projectId : null;
  const activityId = typeof params.activityId === "string" ? params.activityId : null;

  const [projectName, setProjectName] = useState<string | null>(null);
  const [activityName, setActivityName] = useState<string | null>(null);
  const normalizedPathname = normalizePathname(pathname || "/");

  useEffect(() => {
    let mounted = true;

    async function loadProjectName() {
      if (!projectId) {
        setProjectName(null);
        return;
      }

      try {
        const response = await fetch(
          config.getApiUrl(`/api/admin/projects?id=${projectId}`),
        );
        if (!response.ok) {
          if (mounted) setProjectName(null);
          return;
        }

        const json = (await response.json()) as ApiResponse<ProjectItem[]>;
        const items = json.success && Array.isArray(json.data) ? json.data : [];
        const found = items.find((item) => item.id === projectId) ?? items[0];

        if (mounted) {
          setProjectName(found?.name ?? null);
        }
      } catch {
        if (mounted) setProjectName(null);
      }
    }

    loadProjectName();

    return () => {
      mounted = false;
    };
  }, [projectId]);

  useEffect(() => {
    let mounted = true;

    async function loadActivityName() {
      if (!projectId || !activityId) {
        setActivityName(null);
        return;
      }

      try {
        const response = await fetch(
          config.getApiUrl(`/api/admin/projects/${projectId}/activities`),
        );
        if (!response.ok) {
          if (mounted) setActivityName(null);
          return;
        }

        const json = (await response.json()) as ApiResponse<{
          activities: ActivityItem[];
        }>;

        const activities = Array.isArray(json.data?.activities)
          ? json.data.activities
          : [];
        const found = activities.find((item) => item.id === activityId);

        if (mounted) {
          setActivityName(found?.name ?? null);
        }
      } catch {
        if (mounted) setActivityName(null);
      }
    }

    loadActivityName();

    return () => {
      mounted = false;
    };
  }, [projectId, activityId]);

  const tabs = useMemo(() => {
    const baseTabs: Array<{ label: string; title?: string; url: string }> = [
      { label: "Projetos", url: "/admin/projects" },
    ];

    if (!projectId) return baseTabs;

    const fullProjectLabel = projectName || "Item do projeto";
    baseTabs.push({
      label: truncateLabel(fullProjectLabel),
      title: fullProjectLabel,
      url: `/admin/projects/${projectId}`,
    });

    if (activityId) {
      const fullActivityLabel = activityName || "Item de atividade";
      baseTabs.push({
        label: truncateLabel(fullActivityLabel),
        title: fullActivityLabel,
        url: `/admin/projects/${projectId}/activities/${activityId}`,
      });
    }

    return baseTabs;
  }, [activityId, activityName, projectId, projectName]);

  return (
    <div className="flex w-full flex-col bg-white dark:bg-zinc-900">
      <div className="flex flex-col">
        <div className="fixed inset-x-0 top-16 z-30">
          <div className="lg:pl-65">
            <div className="h-19 flex w-full border-b border-zinc-200 bg-zinc-100 px-4 py-3 transition dark:border-zinc-700 dark:bg-zinc-700">
              <div className="flex w-full items-center justify-between gap-3">
                <div className="flex gap-x-2">
                  {tabs.map((tab) => (
                    <Button
                      key={tab.url}
                      href={tab.url}
                      active={normalizedPathname === tab.url}
                      title={tab.title}
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
