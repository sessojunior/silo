"use client";

import { useMemo, useState } from "react";

import ProductMonitoringCards, {
  type MonitoringProductItem,
  type MonitoringProductsFile,
} from "@/components/admin/monitoring/ProductMonitoringCards";
import Stats, { type StatItem } from "@/components/admin/dashboard/Stats";
import Dialog from "@/components/ui/Dialog";
import PicturePagesAccordion, {
  type PicturePage,
} from "../../../components/admin/monitoring/PicturePagesAccordion";
import picturesJson from "@/app/admin/monitoring/pictures.json";
import radarsJson from "@/app/admin/monitoring/radars.json";

type RadarStatus = "ok" | "delayed" | "undefined" | "off";

type RadarItem = {
  id: string;
  name: string;
  description: string;
  logDate: string;
  logUrl: string;
  delay: string;
  delayMinutes: number | null;
  status: RadarStatus;
};

type RadarGroup = {
  id: string;
  name: string;
  radars: RadarItem[];
};

type RadarFile = {
  groups: RadarGroup[];
};

const RADAR_STATUS_UI: Record<
  RadarStatus,
  { badgeClass: string; label: string; squareTextClass: string }
> = {
  ok: {
    badgeClass: "bg-green-500 text-white",
    label: "Sem atraso",
    squareTextClass: "text-white",
  },
  delayed: {
    badgeClass: "bg-red-500 text-white",
    label: "Com atraso",
    squareTextClass: "text-white",
  },
  undefined: {
    badgeClass: "bg-zinc-400 text-white dark:bg-zinc-500",
    label: "Indefinido",
    squareTextClass: "text-white",
  },
  off: {
    badgeClass: "bg-white text-zinc-700 border border-zinc-300 dark:bg-zinc-100",
    label: "Desativado",
    squareTextClass: "text-zinc-700",
  },
};

const RADAR_BLOCK_COLOR: Record<RadarStatus, string> = {
  ok: "bg-green-500",
  delayed: "bg-red-500",
  undefined: "bg-zinc-400 dark:bg-zinc-500",
  off: "bg-white border border-zinc-300 dark:bg-zinc-100",
};

const RADAR_DATA = radarsJson as RadarFile;
const PICTURE_PAGES = (picturesJson as { pages: PicturePage[] }).pages;
const SECTION_TITLE_CLASS = "pb-4 text-2xl font-medium text-zinc-900 dark:text-zinc-100";

function getProductSummaryStatus(turns: MonitoringProductItem["turns"]):
  | "ran"
  | "problem"
  | "not_run" {
  const statuses = turns.map((turn) => turn.status);

  if (
    statuses.some(
      (status) =>
        status === "with_problems" ||
        status === "run_again" ||
        status === "under_support",
    )
  ) {
    return "problem";
  }

  if (statuses.some((status) => status === "completed")) {
    return "ran";
  }

  return "not_run";
}

type MonitoringPageClientProps = {
  productsData: MonitoringProductsFile;
};

export default function MonitoringPageClient({
  productsData,
}: MonitoringPageClientProps) {
  const [selectedRadar, setSelectedRadar] = useState<{
    groupName: string;
    radar: RadarItem;
  } | null>(null);

  const pictureLinksSummary = useMemo(
    () =>
      PICTURE_PAGES.reduce(
        (acc, page) => {
          page.links.forEach((link) => {
            if (link.status === "offline") {
              acc.offline += 1;
              return;
            }

            if (link.status === "delayed") {
              acc.delayed += 1;
              return;
            }

            acc.ok += 1;
          });

          return acc;
        },
        { ok: 0, delayed: 0, offline: 0 },
      ),
    [],
  );

  const pictureStatsItems = useMemo<StatItem[]>(
    () => [
      {
        name: "Links ok",
        progress: pictureLinksSummary.ok,
        incidents: 0,
        color: "bg-green-500",
        colorDark: "bg-green-500",
      },
      {
        name: "Links atrasados",
        progress: pictureLinksSummary.delayed,
        incidents: 0,
        color: "bg-red-500",
        colorDark: "bg-red-500",
      },
      {
        name: "Links offline",
        progress: pictureLinksSummary.offline,
        incidents: 0,
        color: "bg-zinc-500",
        colorDark: "bg-zinc-400",
      },
    ],
    [pictureLinksSummary],
  );

  const productSummary = useMemo(() => {
    return productsData.products.reduce(
      (acc, product) => {
        const summaryStatus = getProductSummaryStatus(product.turns);
        acc[summaryStatus] += 1;
        return acc;
      },
      { ran: 0, problem: 0, not_run: 0 },
    );
  }, [productsData.products]);

  const productStatsItems = useMemo<StatItem[]>(
    () => [
      {
        name: "Produtos que rodou",
        progress: productSummary.ran,
        incidents: 0,
        color: "bg-green-500",
        colorDark: "bg-green-500",
      },
      {
        name: "Produtos com problemas",
        progress: productSummary.problem,
        incidents: 0,
        color: "bg-red-500",
        colorDark: "bg-red-500",
      },
      {
        name: "Produtos que nao rodou",
        progress: productSummary.not_run,
        incidents: 0,
        color: "bg-zinc-500",
        colorDark: "bg-zinc-400",
      },
    ],
    [productSummary],
  );

  return (
    <div className="flex min-h-0 w-full flex-1 overflow-hidden bg-white dark:bg-zinc-900">
      <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden lg:flex-row">
        <div className="scrollbar flex min-h-0 min-w-0 flex-1 flex-col divide-y divide-zinc-200 overflow-x-hidden overflow-y-auto dark:divide-zinc-700">
          <section className="p-8">
            <h3 className={SECTION_TITLE_CLASS}>Produtos (modelos)</h3>
            <Stats
              productCount={productsData.products.length}
              primaryLabel="produtos monitorados"
              items={productStatsItems}
              secondaryMetrics={[
                {
                  value: productSummary.ran,
                  label: "produtos que rodou",
                },
                {
                  value: productSummary.problem,
                  label: "produtos com problemas",
                },
                {
                  value: productSummary.not_run,
                  label: "produtos que nao rodou",
                },
              ]}
              progressTitleFormatter={(item) =>
                `${item.name}: ${item.progress} produtos monitorados`
              }
              legendTitleFormatter={(item) =>
                `${item.name}: ${item.progress} produtos`
              }
            />

            <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-700">
              <ProductMonitoringCards data={productsData} />
            </div>
          </section>

          <section className="p-8">
            <h3 className={SECTION_TITLE_CLASS}>
              Paginas e Figuras da Previsao do tempo
            </h3>
            <Stats
              productCount={PICTURE_PAGES.length}
              primaryLabel="paginas monitoradas"
              items={pictureStatsItems}
              secondaryMetrics={[
                {
                  value: pictureLinksSummary.delayed,
                  label: "links atrasados",
                },
                {
                  value: pictureLinksSummary.offline,
                  label: "links offline",
                },
              ]}
              progressTitleFormatter={(item) =>
                `${item.name}: ${item.progress} links monitorados`
              }
              legendTitleFormatter={(item) =>
                `${item.name}: ${item.progress} links`
              }
              legendItemNames={["Links atrasados", "Links offline"]}
            />

            <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-700">
              <PicturePagesAccordion pages={PICTURE_PAGES} />
            </div>
          </section>
        </div>

        <aside className="scrollbar w-full min-w-0 shrink-0 overflow-x-hidden overflow-y-auto border-t border-zinc-200 lg:min-h-0 lg:w-100 lg:max-w-100 lg:border-l lg:border-t-0 dark:border-zinc-700">
          <div className="p-8">
            <div className="flex flex-col">
              <h3 className={SECTION_TITLE_CLASS}>Radares</h3>
              <div className="space-y-3 text-base">
                <p>
                  Acompanhe o estado atual dos radares por grupo e identifique
                  rapidamente atrasos.
                </p>

                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  <span className="text-lg">💡</span>
                  <span className="ml-1">
                    Clique em um radar para ver descricao, data do log, URL,
                    atraso e status.
                  </span>
                </p>
              </div>
            </div>

            <div className="space-y-6 pt-6">
              {RADAR_DATA.groups.map((group) => (
                <section key={group.id} className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                    {group.name}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {group.radars.map((radar) => {
                      const initial = radar.name.charAt(0).toUpperCase();
                      const statusUi = RADAR_STATUS_UI[radar.status];

                      return (
                        <button
                          key={radar.id}
                          type="button"
                          title={`${radar.name} - atraso ${radar.delay}`}
                          className={`flex size-12 items-center justify-center rounded-md ${RADAR_BLOCK_COLOR[radar.status]} ${statusUi.squareTextClass} text-sm font-semibold shadow-sm transition-transform duration-150 hover:scale-110 focus:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-400`}
                          onClick={() =>
                            setSelectedRadar({ groupName: group.name, radar })
                          }
                        >
                          {initial}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <Dialog
        open={!!selectedRadar}
        onClose={() => setSelectedRadar(null)}
        title={selectedRadar?.radar.name}
        description={selectedRadar ? `Grupo ${selectedRadar.groupName}` : undefined}
        size="md"
      >
        {selectedRadar && (
          <div className="space-y-3 p-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="text-zinc-500 dark:text-zinc-400">Radar</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {selectedRadar.radar.name}
                </p>
              </div>
              <div>
                <p className="text-zinc-500 dark:text-zinc-400">Status</p>
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${RADAR_STATUS_UI[selectedRadar.radar.status].badgeClass}`}
                >
                  {RADAR_STATUS_UI[selectedRadar.radar.status].label}
                </span>
              </div>
              <div>
                <p className="text-zinc-500 dark:text-zinc-400">Data do log</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {formatDateTimeBR(selectedRadar.radar.logDate)}
                </p>
              </div>
              <div>
                <p className="text-zinc-500 dark:text-zinc-400">Atraso</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {selectedRadar.radar.delay}
                </p>
              </div>
            </div>

            <div>
              <p className="text-zinc-500 dark:text-zinc-400">Descricao</p>
              <p className="mt-1 text-zinc-900 dark:text-zinc-100">
                {selectedRadar.radar.description}
              </p>
            </div>

            <div>
              <p className="text-zinc-500 dark:text-zinc-400">URL do log</p>
              <a
                href={selectedRadar.radar.logUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
              >
                {selectedRadar.radar.logUrl}
              </a>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function formatDateTimeBR(value: string): string {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
