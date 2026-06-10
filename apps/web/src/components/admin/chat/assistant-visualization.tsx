"use client";

import dynamic from "next/dynamic";
import { useState, useMemo, useCallback } from "react";
import type { EChartsOption } from "echarts";

import type { AiAssistantVisualizationDto } from "@silo/engine/contracts/dto/ai-assistant";
import { useDarkMode } from "@/hooks/use-dark-mode";
import AssistantMermaidBlock from "@/components/admin/chat/assistant-mermaid";

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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState("");

  const openLightbox = useCallback((src: string) => {
    setLightboxSrc(src);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    setLightboxSrc("");
  }, []);

  const chartOptions = useMemo(() => {
    if (visualization.kind !== "chart") {
      return null;
    }

    return buildChartOptions(visualization, isDarkMode);
  }, [isDarkMode, visualization]);

  if (visualization.kind === "image") {
    const src = visualization.src;
    const isPdf = src.toLowerCase().endsWith(".pdf");
    const isImage = src.startsWith("data:image/") || /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(src);
    const safeSrc = isSafeImageSource(src) ? src : null;

    return (
      <div className="mt-3 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/70">
        {/* Lightbox */}
        {lightboxOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={closeLightbox}
            onKeyDown={(e) => e.key === "Escape" && closeLightbox()}
            role="presentation"
          >
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute right-4 top-4 z-10 flex size-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              aria-label="Fechar"
            >
              <span className="icon-[lucide--x] size-6" />
            </button>
            {isPdf ? (
              <iframe
                src={safeSrc ?? ""}
                className="h-[90vh] w-full max-w-4xl rounded-lg bg-white"
                title="Visualização do PDF"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={safeSrc ?? ""}
                alt={visualization.alt}
                className="max-h-[90vh] max-w-full rounded-lg object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
        )}

        <div className="mb-3 min-w-0">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {visualization.alt}
          </h4>
          {visualization.caption ? (
            <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              {visualization.caption}
            </p>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950">
          {safeSrc ? (
            isPdf ? (
              <div className="flex flex-col items-center justify-center gap-3 px-4 py-8">
                <span className="icon-[lucide--file-text] size-12 text-zinc-400" />
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Relatório em PDF disponível
                </p>
                <div className="flex gap-2">
                  <a
                    href={safeSrc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    <span className="icon-[lucide--download] size-4" />
                    Baixar PDF
                  </a>
                  <button
                    type="button"
                    onClick={() => openLightbox(safeSrc)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <span className="icon-[lucide--eye] size-4" />
                    Visualizar
                  </button>
                </div>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={safeSrc}
                alt={visualization.alt}
                width={visualization.width ?? 1200}
                height={visualization.height ?? 700}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="block h-auto max-h-64 w-full cursor-pointer object-contain transition-opacity hover:opacity-90"
                onClick={() => openLightbox(safeSrc)}
              />
            )
          ) : (
            <div className="flex min-h-48 items-center justify-center px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Conteúdo indisponível.
            </div>
          )}
        </div>
      </div>
    );
  }

  if (visualization.kind === "mermaid") {
    return <AssistantMermaidBlock visualization={visualization} />;
  }

  return (
    <div className="mt-3 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/70">
      <div className="mb-3 min-w-0">
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {visualization.title}
        </h4>
        {visualization.subtitle ? (
          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {visualization.subtitle}
          </p>
        ) : null}
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