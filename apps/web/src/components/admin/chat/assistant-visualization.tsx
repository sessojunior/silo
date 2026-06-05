"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { EChartsOption } from "echarts";

import type { AiAssistantVisualizationDto } from "@silo/engine/contracts/dto/ai-assistant";
import { useDarkMode } from "@/hooks/use-dark-mode";

const ReactECharts = dynamic(
  async () => (await import("echarts-for-react")).default,
  {
    ssr: false,
  },
);

const SERIES_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

function isSafeImageSource(source: string): boolean {
  return source.startsWith("data:image/") || source.startsWith("/");
}

function buildChartOptions(
  visualization: Extract<AiAssistantVisualizationDto, { kind: "chart" }>,
  isDarkMode: boolean,
): EChartsOption {
  const textColor = isDarkMode ? "#e4e4e7" : "#52525b";
  const gridColor = isDarkMode ? "rgba(63, 63, 70, 0.85)" : "#e5e7eb";
  const tooltipBackground = isDarkMode ? "#09090b" : "#ffffff";
  const tooltipBorder = isDarkMode ? "#27272a" : "#d4d4d8";

  if (visualization.chartType === "donut") {
    const data = visualization.categories.map((category, index) => ({
      name: category,
      value: visualization.series[0]?.values[index] ?? 0,
      itemStyle: {
        color:
          visualization.series[0]?.color ?? SERIES_COLORS[index % SERIES_COLORS.length],
      },
    }));

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: tooltipBackground,
        borderColor: tooltipBorder,
        textStyle: { color: textColor },
        confine: true,
        formatter: "{b}<br/>{c}",
      },
      legend: {
        bottom: 0,
        left: "center",
        itemWidth: 12,
        itemHeight: 12,
        textStyle: { color: textColor },
      },
      series: [
        {
          type: "pie",
          radius: ["56%", "76%"],
          center: ["50%", "42%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderColor: isDarkMode ? "#18181b" : "#ffffff",
            borderWidth: 4,
            borderRadius: 10,
          },
          label: { show: false },
          labelLine: { show: false },
          emphasis: {
            scale: true,
            scaleSize: 8,
          },
          data,
        },
      ],
    };
  }

  const legendVisible = visualization.series.length > 1;
  const chartType = visualization.chartType === "line" ? "line" : "bar";

  return {
    backgroundColor: "transparent",
    color: visualization.series.map(
      (series, index) => series.color ?? SERIES_COLORS[index % SERIES_COLORS.length],
    ),
    grid: {
      left: 8,
      right: 16,
      top: legendVisible ? 28 : 16,
      bottom: 40,
      containLabel: true,
    },
    legend: legendVisible
      ? {
          top: 0,
          textStyle: { color: textColor },
        }
      : undefined,
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: visualization.chartType === "line" ? "line" : "shadow",
      },
      backgroundColor: tooltipBackground,
      borderColor: tooltipBorder,
      textStyle: { color: textColor },
      confine: true,
    },
    xAxis: {
      type: "category",
      data: visualization.categories,
      boundaryGap: visualization.chartType !== "line",
      axisLabel: {
        color: textColor,
        margin: 14,
      },
      axisLine: {
        lineStyle: {
          color: gridColor,
        },
      },
      axisTick: {
        show: false,
      },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: textColor,
      },
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      splitLine: {
        lineStyle: {
          color: gridColor,
          type: "dashed",
        },
      },
    },
    series: visualization.series.map((series, index) => ({
      name: series.name,
      type: chartType,
      data: series.values,
      smooth: visualization.chartType === "line",
      symbol: visualization.chartType === "line" ? "circle" : "roundRect",
      symbolSize: visualization.chartType === "line" ? 8 : 6,
      barMaxWidth: visualization.chartType === "bar" ? 42 : undefined,
      lineStyle:
        visualization.chartType === "line"
          ? {
              width: 3,
              color: series.color ?? SERIES_COLORS[index % SERIES_COLORS.length],
            }
          : undefined,
      itemStyle: {
        color: series.color ?? SERIES_COLORS[index % SERIES_COLORS.length],
      },
      areaStyle:
        visualization.chartType === "line"
          ? {
              opacity: index === 0 ? 0.12 : 0.06,
            }
          : undefined,
      emphasis: {
        focus: "series",
      },
    })),
  };
}

export default function AssistantVisualizationBlock({
  visualization,
}: {
  visualization: AiAssistantVisualizationDto;
}) {
  const isDarkMode = useDarkMode();

  const chartOptions = useMemo(() => {
    if (visualization.kind !== "chart") {
      return null;
    }

    return buildChartOptions(visualization, isDarkMode);
  }, [isDarkMode, visualization]);

  if (visualization.kind === "image") {
    const safeSource = isSafeImageSource(visualization.src) ? visualization.src : null;

    return (
      <div className="mt-3 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/70">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-500 dark:text-blue-300">
              Imagem
            </p>
            <h4 className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {visualization.alt}
            </h4>
            {visualization.caption ? (
              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                {visualization.caption}
              </p>
            ) : null}
          </div>
          <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-300">
            SVG
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950">
          {safeSource ? (
            // Using a raw <img> here for arbitrary image sources (SVG/data URLs)
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={safeSource}
              alt={visualization.alt}
              width={visualization.width ?? 1200}
              height={visualization.height ?? 700}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="block h-auto max-h-64 w-full object-contain"
            />
          ) : (
            <div className="flex min-h-48 items-center justify-center px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Imagem indisponível.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/70">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-500 dark:text-blue-300">
            Gráfico
          </p>
          <h4 className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {visualization.title}
          </h4>
          {visualization.subtitle ? (
            <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              {visualization.subtitle}
            </p>
          ) : null}
        </div>
        <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-300">
          ECharts
        </span>
      </div>

      <div
        className="w-full"
        style={{ height: `${visualization.height ?? 280}px` }}
      >
        {chartOptions ? (
          <ReactECharts
            option={chartOptions}
            style={{ height: "100%", width: "100%" }}
            notMerge
            lazyUpdate
          />
        ) : null}
      </div>
    </div>
  );
}