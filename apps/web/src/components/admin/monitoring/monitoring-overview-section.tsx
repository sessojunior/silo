"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import type { EChartsOption } from "echarts";

import Button from "@/components/ui/button";
import { useDarkMode } from "@/hooks/use-dark-mode";

import { type PicturePage } from "./picture-pages-accordion";
import { type MonitoringProductsFile } from "./product-monitoring-cards";
import {
  buildModelSuccessTrendData,
  CHART_COLORS,
  formatPercent,
  formatReferenceDate,
  formatTurnLabel,
  getFeaturedTurn,
  getProductSummaryStatus,
  MONITORING_PRODUCTS_PREVIEW_LIMIT,
  MONITORING_PICTURE_DONUT_CHART_HEIGHT,
  MONITORING_SUCCESS_TREND_CHART_HEIGHT,
  toMonitoringStatusTone,
  type MonitoringProductSummaryCounts,
  type MonitoringSummaryCounts,
  type MonitoringTrendPoint,
  type MonitoringSuccessTrendData,
} from "./monitoring-page-shared";

const ReactECharts = dynamic(
  async () => (await import("echarts-for-react")).default,
  {
    ssr: false,
  },
);

type MonitoringCardShellProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  titleClassName?: string;
  iconClassName?: string;
  icon?: ReactNode;
};

type MonitoringMetricTileProps = {
  value: ReactNode;
  label: ReactNode;
  valueClassName?: string;
  labelClassName?: string;
  className?: string;
};

type MonitoringLineChartProps = {
  options: EChartsOption;
  height: number;
};

type MonitoringOverviewSectionProps = {
  productsData: MonitoringProductsFile;
  picturePages: PicturePage[];
};

function MonitoringCardShell({
  title,
  description,
  children,
  className = "",
  titleClassName = "text-2xl font-semibold text-zinc-900 dark:text-zinc-100",
  iconClassName,
  icon,
}: MonitoringCardShellProps) {
  return (
    <article className={`rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900 ${className}`.trim()}>
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="min-w-0">
          <h3 className={titleClassName}>{title}</h3>
          {description ? (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
          ) : null}
        </div>
        {iconClassName ? (
          <div className={`flex size-11 shrink-0 items-center justify-center rounded-full ${iconClassName}`}>
            {icon}
          </div>
        ) : null}
      </div>
      <div>{children}</div>
    </article>
  );
}

function MonitoringTopCard(props: MonitoringCardShellProps) {
  return <MonitoringCardShell {...props} />;
}

function MonitoringMetricTile({
  value,
  label,
  valueClassName = "text-zinc-950 dark:text-zinc-50",
  labelClassName = "text-zinc-500 dark:text-zinc-400",
  className = "",
}: MonitoringMetricTileProps) {
  return (
    <div className={`rounded-lg border border-zinc-200/70 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-800/70 ${className}`.trim()}>
      <p className={`text-4xl font-semibold tracking-tight ${valueClassName}`}>{value}</p>
      <p className={`mt-1 text-base font-medium ${labelClassName}`}>{label}</p>
    </div>
  );
}

function MonitoringLineChart({ options, height }: MonitoringLineChartProps) {
  return (
    <div className="w-full overflow-hidden px-4" style={{ minHeight: height }}>
      <ReactECharts option={options} style={{ height, width: "100%" }} notMerge lazyUpdate />
    </div>
  );
}

function MonitoringDonutChart({ options, height, center }: { options: EChartsOption; height: number; center?: ReactNode; }) {
  return (
    <div className="relative shrink-0" style={{ width: height, height }}>
      <ReactECharts option={options} style={{ height: "100%", width: "100%" }} notMerge lazyUpdate />
      {center ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {center}
        </div>
      ) : null}
    </div>
  );
}


function hasDataIndex(value: unknown): value is { dataIndex?: number } {
  return typeof value === "object" && value !== null && "dataIndex" in value;
}

function buildDonutChartOptions(
  entries: Array<{ name: string; value: number; color: string }>,
  isDarkMode: boolean,
): EChartsOption {
  const hasValues = entries.some((entry) => entry.value > 0);
  const chartEntries = hasValues
    ? entries
    : [{ name: "Sem dados", value: 1, color: isDarkMode ? "#52525b" : CHART_COLORS.background }];

  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      backgroundColor: isDarkMode ? "#09090b" : "#ffffff",
      borderColor: isDarkMode ? "#27272a" : "#d4d4d8",
      textStyle: {
        color: isDarkMode ? "#e4e4e7" : "#52525b",
      },
      confine: true,
      formatter: "{b}<br/>{c}",
    },
    series: [
      {
        type: "pie",
        radius: ["64%", "82%"],
        center: ["50%", "50%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderColor: isDarkMode ? "#18181b" : "#ffffff",
          borderWidth: 4,
          borderRadius: 10,
        },
        label: {
          show: false,
        },
        labelLine: {
          show: false,
        },
        emphasis: {
          scale: true,
          scaleSize: 8,
        },
        data: chartEntries.map((entry) => ({
          name: entry.name,
          value: Math.max(0, entry.value),
          itemStyle: {
            color: entry.color,
          },
        })),
      },
    ],
  };
}

function buildMonitoringSuccessTrendChartOptions(
  points: MonitoringTrendPoint[],
  isDarkMode: boolean,
): EChartsOption {
  const textColor = isDarkMode ? "#e4e4e7" : "#52525b";
  const gridColor = isDarkMode ? "rgba(63, 63, 70, 0.55)" : "rgba(212, 212, 216, 0.85)";
  const tooltipBackground = isDarkMode ? "#09090b" : "#ffffff";
  const tooltipBorder = isDarkMode ? "#27272a" : "#d4d4d8";
  const values = points.map((point) => point.value);
  const minimumValue = values.length > 0 ? Math.min(...values) : 0;
  const maximumValue = values.length > 0 ? Math.max(...values) : 100;
  const valueRange = Math.max(1, maximumValue - minimumValue);
  const valuePadding = Math.max(4, Math.ceil(valueRange * 0.2));
  const axisMin = Math.max(0, Math.floor(minimumValue - valuePadding));
  const axisMax = Math.min(100, Math.ceil(maximumValue + valuePadding));

  return {
    backgroundColor: "transparent",
    grid: {
      left: 4,
      right: 8,
      top: 12,
      bottom: 12,
      containLabel: false,
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "line",
        lineStyle: {
          color: gridColor,
          width: 1,
        },
      },
      backgroundColor: tooltipBackground,
      borderColor: tooltipBorder,
      textStyle: {
        color: textColor,
      },
      confine: true,
      position: (point: number[], _params: unknown, _dom: unknown, _rect: unknown, size: {
        contentSize: [number, number];
        viewSize: [number, number];
      }) => {
        const x = Math.max(8, Math.min(point[0] - size.contentSize[0] / 2, size.viewSize[0] - size.contentSize[0] - 8));
        return [x, 8];
      },
      formatter: (params: unknown) => {
        const firstParam = Array.isArray(params) ? params[0] : params;
        const pointIndex = hasDataIndex(firstParam) ? firstParam.dataIndex : undefined;
        const point = typeof pointIndex === "number" ? points[pointIndex] : undefined;

        if (!point) {
          return "";
        }

        return `${point.productName} · ${point.turnLabel} · ${formatPercent(point.value)}%`;
      },
    },
    xAxis: {
      type: "category",
      data: points.map((point) => point.label),
      boundaryGap: false,
      axisLabel: {
        show: false,
      },
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      splitLine: {
        show: false,
      },
    },
    yAxis: {
      type: "value",
      min: axisMin,
      max: axisMax,
      axisLabel: {
        show: false,
      },
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      splitLine: {
        show: false,
      },
    },
    series: [
      {
        name: "Taxa de sucesso",
        type: "line",
        data: values,
        smooth: true,
        showSymbol: true,
        symbol: "circle",
        symbolSize: 7,
        lineStyle: {
          width: 4,
          color: CHART_COLORS.green,
        },
        itemStyle: {
          color: CHART_COLORS.green,
        },
        areaStyle: {
          color: isDarkMode ? "rgba(34, 197, 94, 0.14)" : "rgba(34, 197, 94, 0.08)",
        },
        emphasis: {
          focus: "series",
        },
      },
    ],
  };
}

function MonitoringSuccessTrendCard({
  overallSuccessRate,
  trendPoints,
}: {
  overallSuccessRate: number;
  trendPoints: MonitoringTrendPoint[];
}) {
  const isDarkMode = useDarkMode();
  const options = useMemo<EChartsOption>(
    () => buildMonitoringSuccessTrendChartOptions(trendPoints, isDarkMode),
    [isDarkMode, trendPoints],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 px-4">
        <div className="text-5xl font-semibold leading-none tracking-tight text-zinc-950 dark:text-zinc-50">
          {formatPercent(overallSuccessRate)}%
        </div>
        <div className="text-base leading-none text-zinc-500 dark:text-zinc-400">das rodadas concluídas</div>
      </div>

      <MonitoringLineChart options={options} height={MONITORING_SUCCESS_TREND_CHART_HEIGHT} />
    </div>
  );
}

function MonitoringPicturePagesSummaryCard({
  picturePageSummary,
}: {
  picturePageSummary: MonitoringSummaryCounts;
}) {
  const isDarkMode = useDarkMode();
  const totalPages = picturePageSummary.ok + picturePageSummary.delayed + picturePageSummary.offline;

  const donutOptions = useMemo<EChartsOption>(
    () =>
      buildDonutChartOptions(
        [
          { name: "Ok", value: picturePageSummary.ok, color: CHART_COLORS.green },
          { name: "Atrasadas", value: picturePageSummary.delayed, color: CHART_COLORS.red },
          { name: "Offline", value: picturePageSummary.offline, color: CHART_COLORS.neutral },
        ],
        isDarkMode,
      ),
    [isDarkMode, picturePageSummary.delayed, picturePageSummary.ok, picturePageSummary.offline],
  );

  const pageEntries = [
    {
      value: picturePageSummary.ok,
      label: "ok",
      valueClassName: "text-emerald-600 dark:text-emerald-400",
      className: "",
    },
    {
      value: picturePageSummary.delayed,
      label: "atrasadas",
      valueClassName: "text-rose-600 dark:text-rose-400",
      className: "",
    },
    {
      value: picturePageSummary.offline,
      label: "offline",
      valueClassName: "text-zinc-900 dark:text-zinc-100",
      className: "",
    },
  ] as const;

  const pageLegendEntries = [
    {
      count: picturePageSummary.ok,
      label: "ok",
      dotClassName: "bg-emerald-500",
      valueClassName: "text-emerald-600 dark:text-emerald-400",
    },
    {
      count: picturePageSummary.delayed,
      label: "atrasadas",
      dotClassName: "bg-rose-500",
      valueClassName: "text-rose-600 dark:text-rose-400",
    },
    {
      count: picturePageSummary.offline,
      label: "offline",
      dotClassName: "bg-zinc-400 dark:bg-zinc-500",
      valueClassName: "text-zinc-900 dark:text-zinc-100",
    },
  ] as const;

  return (
    <MonitoringCardShell
      title="Páginas e Figuras da Previsão"
      description="Resumo por projeto"
      titleClassName="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50"
      icon={<span className="icon-[lucide--monitor-up] size-5" />}
      iconClassName="bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700"
      className="h-full"
    >
      <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2 xl:grid-cols-3">
        {pageEntries.map((entry) => (
          <MonitoringMetricTile
            key={entry.label}
            value={entry.value}
            label={entry.label}
            valueClassName={entry.valueClassName}
            className={entry.className}
          />
        ))}
      </div>

      <div className="px-4 py-3">
        <section className="min-w-0 rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/40">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold uppercase text-zinc-500 dark:text-zinc-400">Por projeto</h4>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Status consolidado das páginas cadastradas</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-5 xl:flex-row items-center">
            <div className="flex justify-center xl:flex-none">
              <div className="w-32 shrink-0">
                <MonitoringDonutChart
                  options={donutOptions}
                  height={MONITORING_PICTURE_DONUT_CHART_HEIGHT}
                  center={(
                    <div className="text-center">
                      <div className="text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{totalPages}</div>
                      <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">total</div>
                    </div>
                  )}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:min-w-40">
              {pageLegendEntries.map((entry) => (
                <div key={entry.label} className="flex items-center gap-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  <span className={`size-2.5 shrink-0 rounded-full ${entry.dotClassName}`} />
                  <span className={`font-semibold ${entry.valueClassName}`}>{entry.count}</span>
                  <span>{entry.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </MonitoringCardShell>
  );
}

function MonitoringProductsCard({
  products,
  referenceDate,
  summary,
  hasMoreProducts,
  onShowMoreProducts,
}: {
  products: MonitoringProductsFile["products"];
  referenceDate: string;
  summary: MonitoringProductSummaryCounts;
  hasMoreProducts: boolean;
  onShowMoreProducts: () => void;
}) {
  return (
    <MonitoringCardShell
      title="Modelos (produtos)"
      description="Resumo por produto e turnos"
      titleClassName="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50"
      className="h-full"
    >
      <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2 xl:grid-cols-3">
        <MonitoringMetricTile
          value={summary.ran}
          label="rodaram"
          valueClassName="text-emerald-600 dark:text-emerald-400"
        />
        <MonitoringMetricTile
          value={summary.problem}
          label="com problemas"
          valueClassName="text-rose-600 dark:text-rose-400"
        />
        <MonitoringMetricTile
          value={summary.not_run}
          label="não rodou"
          valueClassName="text-zinc-900 dark:text-zinc-100"
        />
      </div>

      <div className="overflow-hidden border-y border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_88px] items-center gap-4 border-b border-zinc-200/80 bg-zinc-50/70 px-4 py-3 text-sm font-medium uppercase text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400">
          <span>Modelo</span>
          <span>Última execução</span>
          <span className="text-right">Situação</span>
        </div>

        <div className="divide-y divide-zinc-200/80 dark:divide-zinc-700/80">
          {products.map((product, productIndex) => {
            const featuredTurn = getFeaturedTurn(product);
            const tone = featuredTurn ? toMonitoringStatusTone(featuredTurn.status) : "not_run";
            const statusToneClass =
              tone === "ok"
                ? "bg-emerald-500 text-white"
                : tone === "problem"
                  ? "bg-rose-500 text-white"
                  : "bg-zinc-300 text-zinc-600 dark:bg-zinc-600 dark:text-zinc-200";
            const progressToneClass =
              tone === "ok"
                ? "bg-emerald-500"
                : tone === "problem"
                  ? "bg-rose-500"
                  : "bg-zinc-400 dark:bg-zinc-500";

            return (
              <div
                key={`${product.productId}-${productIndex}`}
                className="grid grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_88px] items-center gap-4 px-4 py-4 transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/50"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600 ring-1 ring-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20">
                    <span className="text-sm font-semibold">{product.model.slice(0, 1).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-zinc-950 dark:text-zinc-50">{product.model}</p>
                    <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{product.description ?? "Sem descrição"}</p>
                  </div>
                </div>

                <div className="min-w-0">
                  {featuredTurn ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/products/${encodeURIComponent(product.productId)}/data-flow?date=${encodeURIComponent(referenceDate)}&turn=${encodeURIComponent(featuredTurn.turn)}`}
                          className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {formatTurnLabel(featuredTurn.turn)}
                        </Link>
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">- {formatReferenceDate(referenceDate)}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className={`h-full rounded-full ${progressToneClass}`}
                          style={{ width: `${Math.min(100, Math.max(0, featuredTurn.progress))}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">Sem execução disponível</span>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3">
                  <span className={`inline-flex size-8 items-center justify-center rounded-full ${statusToneClass}`}>
                    <span
                      className={`icon-[lucide--${tone === "problem" ? "triangle-alert" : tone === "ok" ? "check" : "minus"}] size-4`}
                    />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {hasMoreProducts ? (
        <div className="m-4 flex justify-center">
          <Button
            type="button"
            style="unstyled"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-blue-600 transition hover:border-blue-200 hover:text-blue-700 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-950 dark:text-blue-400 dark:hover:border-blue-500/40"
            onClick={onShowMoreProducts}
          >
            Exibir mais produtos
            <span className="icon-[lucide--arrow-down] size-4" />
          </Button>
        </div>
      ) : null}
    </MonitoringCardShell>
  );
}

export default function MonitoringOverviewSection({
  productsData,
  picturePages,
}: MonitoringOverviewSectionProps) {
  const [visibleProductCount, setVisibleProductCount] = useState(MONITORING_PRODUCTS_PREVIEW_LIMIT);

  const picturePageSummary = useMemo<MonitoringSummaryCounts>(
    () =>
      picturePages.reduce(
        (acc, page) => {
          if (page.status === "ok") {
            acc.ok += 1;
            return acc;
          }

          if (page.status === "delayed") {
            acc.delayed += 1;
            return acc;
          }

          acc.offline += 1;
          return acc;
        },
        { ok: 0, delayed: 0, offline: 0 },
      ),
    [picturePages],
  );

  const productSummary = useMemo<MonitoringProductSummaryCounts>(
    () =>
      productsData.products.reduce(
        (acc, product) => {
          const summaryStatus = getProductSummaryStatus(product.turns);
          acc[summaryStatus] += 1;
          return acc;
        },
        { ran: 0, problem: 0, not_run: 0 },
      ),
    [productsData.products],
  );

  const monitoringModelTrendData = useMemo<MonitoringSuccessTrendData>(
    () => buildModelSuccessTrendData(productsData.products),
    [productsData.products],
  );

  const overallSuccessRate = monitoringModelTrendData.successRate;
  const monitoringSuccessTrendPoints = monitoringModelTrendData.points;

  const displayedProducts = useMemo(
    () => productsData.products.slice(0, visibleProductCount),
    [productsData.products, visibleProductCount],
  );

  const hasMoreProducts = visibleProductCount < productsData.products.length;

  return (
    <section className="grid gap-4 p-4 border-b border-zinc-200/80 dark:border-zinc-700/80 xl:grid-cols-3">
      <MonitoringTopCard
        title="Modelos (produtos)"
        icon={<span className="icon-[lucide--check-circle-2] size-5" />}
        iconClassName="bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20"
      >
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-end gap-2 px-4 pb-8">
              <span className="text-5xl font-semibold tracking-tight text-zinc-600 dark:text-zinc-400">
                {productsData.products.length}
              </span>
              <span className="pb-1 text-base text-zinc-500 dark:text-zinc-400">monitorados</span>
            </div>
            <div className="p-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-zinc-200 dark:border-zinc-800 text-base font-medium text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500" />
                {productSummary.ran} rodaram
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-rose-500" />
                {productSummary.problem} com problemas
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-zinc-400" />
                {productSummary.not_run} não rodou
              </span>
            </div>
          </div>
        </div>
      </MonitoringTopCard>

      <MonitoringTopCard
        title="Páginas e Figuras"
        icon={<span className="icon-[lucide--monitor-up] size-5" />}
        iconClassName="bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700"
      >
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-end gap-2 px-4 pb-8">
              <span className="text-5xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {picturePages.length}
              </span>
              <span className="pb-1 text-base text-zinc-500 dark:text-zinc-400">monitoradas</span>
            </div>
            <div className="p-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-zinc-200 dark:border-zinc-800 text-base font-medium text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500" />
                {picturePageSummary.ok} ok
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-rose-500" />
                {picturePageSummary.delayed} atrasadas
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-zinc-400" />
                {picturePageSummary.offline} offline
              </span>
            </div>
          </div>
        </div>
      </MonitoringTopCard>

      <MonitoringTopCard
        title="Taxa de sucesso (modelos)"
        icon={<span className="icon-[lucide--trending-up] size-5" />}
        iconClassName="bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20"
      >
        <MonitoringSuccessTrendCard
          overallSuccessRate={overallSuccessRate}
          trendPoints={monitoringSuccessTrendPoints}
        />
      </MonitoringTopCard>

      <section className="grid gap-4 lg:grid-cols-2 xl:col-span-3">
        <MonitoringProductsCard
          products={displayedProducts}
          referenceDate={productsData.referenceDate}
          summary={productSummary}
          hasMoreProducts={hasMoreProducts}
          onShowMoreProducts={() => {
            setVisibleProductCount(productsData.products.length);
          }}
        />

        <MonitoringPicturePagesSummaryCard
          picturePageSummary={picturePageSummary}
        />
      </section>
    </section>
  );
}
