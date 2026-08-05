"use client";

import { useMemo, useState } from "react";

import Input from "@/components/ui/input";
import Select from "@/components/ui/select";

import {
  formatShortDate,
  getHostname,
  getPictureStatusLabel,
  getPictureStatusTone,
  type MonitoringStatusTone,
} from "./monitoring-page-shared";
import {
  type PictureCheckMode,
  type PictureLink,
  type PictureLinkStatus,
  type PicturePage,
} from "./picture-pages-accordion";

type RecentFigureRow = {
  page: PicturePage;
  link: PictureLink;
  hostname: string;
  projectLabel: string;
  modelLabel: string;
  statusTone: MonitoringStatusTone;
  statusLabel: string;
  lastUpdate: Date;
  searchText: string;
};

type MonitoringRecentFiguresSectionProps = {
  picturePages: PicturePage[];
};

const MONITORING_RECENT_ROWS_LIMIT = 5;

type MonitoringRecentFigureFilter = "all" | PictureCheckMode | PictureLinkStatus;

const MONITORING_RECENT_FIGURE_FILTER_OPTIONS = [
  { value: "all", label: "Todos os itens" },
  { value: "page", label: "Somente páginas" },
  { value: "items", label: "Somente figuras" },
  { value: "ok", label: "Sem atraso" },
  { value: "delayed", label: "Atrasadas" },
  { value: "offline", label: "Offline" },
  { value: "undefined", label: "Indefinidas" },
];

export default function MonitoringRecentFiguresSection({
  picturePages,
}: MonitoringRecentFiguresSectionProps) {
  const [monitoringQuery, setMonitoringQuery] = useState("");
  const [monitoringFilter, setMonitoringFilter] = useState<MonitoringRecentFigureFilter>("all");

  const hasActiveFilters = monitoringQuery.trim().length > 0 || monitoringFilter !== "all";

  const recentFigureRows = useMemo(() => {
    const normalizedQuery = monitoringQuery.trim().toLowerCase();

    const rows: RecentFigureRow[] = picturePages
      .flatMap((page) =>
        page.links.map((link) => ({
          page,
          link,
          hostname: getHostname(page.url),
          projectLabel: page.description || getHostname(page.url),
          modelLabel: page.checkMode === "items" ? "Figuras" : "Página",
          statusTone: getPictureStatusTone(link.status),
          statusLabel: getPictureStatusLabel(link.status),
          lastUpdate: new Date(link.lastUpdate),
          searchText: [
            page.name,
            page.url,
            page.slug,
            page.description,
            page.checkMode,
            page.checkMode === "items" ? "Figuras" : "Página",
            link.name,
            link.url,
            link.size,
            link.status,
            getPictureStatusLabel(link.status),
          ]
            .join(" ")
            .toLowerCase(),
        })),
      )
      .sort((left, right) => {
        const leftTime = left.lastUpdate.getTime();
        const rightTime = right.lastUpdate.getTime();

        if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return left.page.name.localeCompare(right.page.name);
        if (Number.isNaN(leftTime)) return 1;
        if (Number.isNaN(rightTime)) return -1;

        const dateDiff = rightTime - leftTime;
        if (dateDiff !== 0) return dateDiff;
        return left.page.name.localeCompare(right.page.name) || left.link.name.localeCompare(right.link.name);
      });

    const filteredRows = rows.filter((row) => {
      if (monitoringFilter !== "all") {
        if (monitoringFilter === "page" || monitoringFilter === "items") {
          if (row.page.checkMode !== monitoringFilter) {
            return false;
          }
        } else if (row.link.status !== monitoringFilter) {
          return false;
        }
      }

      if (normalizedQuery && !row.searchText.includes(normalizedQuery)) {
        return false;
      }

      return true;
    });

    return filteredRows.slice(0, MONITORING_RECENT_ROWS_LIMIT);
  }, [picturePages, monitoringFilter, monitoringQuery]);

  return (
    <div className="p-4">
      <section className="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between p-4">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">Páginas e Figuras monitoradas</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Links monitorados de páginas da previsão do tempo e figuras associadas</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-1 pt-4">
              <div className="relative flex-1 min-w-120 max-w-lg">
                <Input
                  type="text"
                  placeholder="Buscar página ou figura..."
                  value={monitoringQuery}
                  setValue={setMonitoringQuery}
                  className="pr-10"
                />
                <span className="icon-[lucide--search] absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 size-4" />
              </div>

              <Select
                name="monitoringRecentFiguresFilter"
                selected={monitoringFilter}
                onChange={(value) => setMonitoringFilter(value as MonitoringRecentFigureFilter)}
                options={MONITORING_RECENT_FIGURE_FILTER_OPTIONS}
                placeholder="Filtrar por modelo ou situação"
                className="w-60"
              />
            </div>
          </div>
        </div>

        <div className="overflow-hidden border-y border-zinc-200/80 dark:border-zinc-700/80">
          <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.85fr)_120px_56px] items-center gap-4 border-b border-zinc-200/80 bg-zinc-50/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400">
            <span>Página / Figura</span>
            <span>Projeto</span>
            <span>Modelo (Produto)</span>
            <span>Última verificação</span>
            <span>Situação</span>
            <span className="text-right">Link</span>
          </div>

          {recentFigureRows.length > 0 ? (
            <div className="divide-y divide-zinc-200/80 dark:divide-zinc-700/80">
              {recentFigureRows.map((row) => {
                const toneClasses = row.statusTone === "ok"
                  ? "bg-emerald-500 text-emerald-500"
                  : row.statusTone === "problem"
                    ? "bg-rose-500 text-rose-500"
                    : "bg-zinc-400 text-zinc-400";

                return (
                  <div key={`${row.page.id}-${row.link.id}`} className="grid grid-cols-[minmax(0,1.7fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.85fr)_120px_56px] items-center gap-4 px-4 py-4 text-sm transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/50">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-zinc-950 dark:text-zinc-50">{row.page.name}</p>
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{row.link.name}</p>
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-700 dark:text-zinc-300">{row.projectLabel}</p>
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{row.hostname}</p>
                    </div>

                    <div className="min-w-0">
                      <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {row.modelLabel}
                      </span>
                    </div>

                    <div className="min-w-0 text-zinc-600 dark:text-zinc-300">
                      {Number.isNaN(row.lastUpdate.getTime()) ? row.link.lastUpdate : formatShortDate(row.link.lastUpdate)}
                    </div>

                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-2 rounded-full bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        <span className={`size-2 rounded-full ${toneClasses}`} />
                        {row.statusLabel}
                      </span>
                    </div>

                    <div className="flex justify-end">
                      <a
                        href={row.link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex size-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition hover:border-blue-200 hover:text-blue-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-blue-500/40 dark:hover:text-blue-400"
                        aria-label={`Abrir ${row.link.name}`}
                      >
                        <span className="icon-[lucide--external-link] size-4" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-10 text-sm text-zinc-500 dark:text-zinc-400">
              {hasActiveFilters ? "Nenhum resultado encontrado." : "Nenhuma página cadastrada."}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
