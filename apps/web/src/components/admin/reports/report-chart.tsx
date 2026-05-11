"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { ChartEmptyState } from "@/components/ui/chart-empty-state";
import { useDarkMode } from "@/hooks/use-dark-mode";

const Chart = dynamic(
  async () => (await import("echarts-for-react")).default,
  { ssr: false },
);

interface ReportChartProps {
  type: "line" | "bar" | "donut" | "area";
  data: Record<string, unknown>;
  reportType?: "availability" | "problems" | "projects" | "executive";
  height?: number;
  className?: string;
}

interface ReportChartData {
  labels: string[];
  values: number[];
  colors: string[];
  seriesName: string;
  suffix: string;
}

const DEFAULT_COLORS = [
  "#6b7280",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#f97316",
];

const AVAILABILITY_COLORS = ["#10b981", "#f59e0b", "#ef4444"];
const PROJECTS_COLORS = [
  "#8b5cf6",
  "#6b7280",
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#f97316",
];

function getRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

function getStringValue(
  value: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const rawValue = value[key];
  return typeof rawValue === "string" && rawValue.length > 0
    ? rawValue
    : fallback;
}

function getNumberValue(value: Record<string, unknown>, key: string): number {
  const rawValue = value[key];

  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return rawValue;
  }

  const parsedValue = Number(rawValue ?? 0);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function getReportChartData(
  reportType: ReportChartProps["reportType"],
  type: ReportChartProps["type"],
  data: Record<string, unknown>,
): ReportChartData {
  if (!reportType) {
    return {
      labels: [],
      values: [],
      colors: [],
      seriesName: "Gráfico",
      suffix: "",
    };
  }

  switch (reportType) {
    case "availability": {
      const products = getRecordArray(data.products);

      if (type === "donut") {
        const categories = products.map((item) => {
          const availability = getNumberValue(item, "availabilityPercentage");

          if (availability >= 90) {
            return "available";
          }

          if (availability >= 70) {
            return "warning";
          }

          return "critical";
        });

        const availableProducts = categories.filter(
          (value) => value === "available",
        ).length;
        const warningProducts = categories.filter(
          (value) => value === "warning",
        ).length;
        const criticalProducts = categories.filter(
          (value) => value === "critical",
        ).length;

        return {
          labels: ["Disponível (≥90%)", "Atenção (70-89%)", "Crítico (<70%)"],
          values: [availableProducts, warningProducts, criticalProducts],
          colors: AVAILABILITY_COLORS,
          seriesName: "Distribuição",
          suffix: "",
        };
      }

      return {
        labels: products.map((item) =>
          getStringValue(item, "name", "Produto"),
        ),
        values: products.map((item) =>
          getNumberValue(item, "availabilityPercentage"),
        ),
        colors: ["#10b981"],
        seriesName: "Disponibilidade (%)",
        suffix: "%",
      };
    }

    case "problems": {
      const problemCategories = getRecordArray(data.problemsByCategory);

      if (type === "donut") {
        return {
          labels: problemCategories.map((item) =>
            getStringValue(item, "name", "Categoria"),
          ),
          values: problemCategories.map((item) =>
            getNumberValue(item, "problemsCount"),
          ),
          colors: problemCategories.map((item, index) => {
            const rawColor = item.color;
            if (typeof rawColor === "string" && rawColor.length > 0) {
              return rawColor;
            }

            return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
          }),
          seriesName: "Quantidade de Problemas",
          suffix: "",
        };
      }

      return {
        labels: problemCategories.map((item) =>
          getStringValue(item, "name", "Categoria"),
        ),
        values: problemCategories.map((item) =>
          getNumberValue(item, "problemsCount"),
        ),
        colors: ["#ef4444"],
        seriesName: "Quantidade de Problemas",
        suffix: "",
      };
    }

    case "projects": {
      const projects = getRecordArray(data.projectsWithProgress);

      if (type === "donut") {
        const rawStatus =
          data.projectsByStatus && typeof data.projectsByStatus === "object"
            ? (data.projectsByStatus as Record<string, number>)
            : null;

        if (!rawStatus) {
          return {
            labels: [],
            values: [],
            colors: [],
            seriesName: "Projetos",
            suffix: "",
          };
        }

        const statusTranslations: Record<string, string> = {
          active: "Ativo",
          completed: "Concluído",
          paused: "Pausado",
          cancelled: "Cancelado",
          unknown: "Desconhecido",
        };

        const entries = Object.entries(rawStatus);

        return {
          labels: entries.map(([status]) => statusTranslations[status] || status),
          values: entries.map(([, value]) => value),
          colors: PROJECTS_COLORS,
          seriesName: "Projetos",
          suffix: "",
        };
      }

      return {
        labels: projects.map((item) => getStringValue(item, "name", "Projeto")),
        values: projects.map((item) => getNumberValue(item, "progress")),
        colors: ["#8b5cf6"],
        seriesName: "Progresso (%)",
        suffix: "%",
      };
    }

    default:
      return {
        labels: [],
        values: [],
        colors: [],
        seriesName: "Gráfico",
        suffix: "",
      };
  }
}

export function ReportChart({
  type,
  data,
  reportType,
  height = 300,
  className = "",
}: ReportChartProps) {
  const isDarkMode = useDarkMode();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const theme = useMemo(
    () => ({
      textColor: isDarkMode ? "#e4e4e7" : "#52525b",
      gridColor: isDarkMode ? "rgba(63, 63, 70, 0.85)" : "#e5e7eb",
      tooltipBackground: isDarkMode ? "#09090b" : "#ffffff",
      tooltipBorder: isDarkMode ? "#27272a" : "#d4d4d8",
      donutBorder: isDarkMode ? "#18181b" : "#ffffff",
      barBackground: isDarkMode ? "rgba(255, 255, 255, 0.04)" : "#f8fafc",
    }),
    [isDarkMode],
  );

  const chartData = useMemo(
    () => getReportChartData(reportType, type, data),
    [data, reportType, type],
  );

  const pieData = useMemo(
    () =>
      chartData.labels.map((label, index) => ({
        name: label,
        value: chartData.values[index] ?? 0,
        itemStyle: {
          color:
            chartData.colors[index] ??
            DEFAULT_COLORS[index % DEFAULT_COLORS.length],
        },
      })),
    [chartData],
  );

  const chartOptions = useMemo<EChartsOption>(() => {
    if (type === "donut") {
      return {
        backgroundColor: "transparent",
        tooltip: {
          trigger: "item",
          confine: true,
          backgroundColor: theme.tooltipBackground,
          borderColor: theme.tooltipBorder,
          textStyle: {
            color: theme.textColor,
          },
          formatter: "{b}<br/>{c} ({d}%)",
        },
        legend: {
          bottom: 0,
          left: "center",
          itemWidth: 12,
          itemHeight: 12,
          textStyle: {
            color: theme.textColor,
          },
          formatter: (name) => {
            const item = pieData.find((entry) => entry.name === name);
            return `${name}: ${item?.value ?? 0}`;
          },
        },
        series: [
          {
            type: "pie",
            radius: ["55%", "75%"],
            center: ["50%", "42%"],
            avoidLabelOverlap: false,
            itemStyle: {
              borderColor: theme.donutBorder,
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
            data: pieData,
          },
        ],
      };
    }

    const seriesColor = chartData.colors[0] ?? "#6b7280";
    const seriesType = type === "bar" ? "bar" : "line";

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: type === "bar" ? "shadow" : "line",
        },
        confine: true,
        backgroundColor: theme.tooltipBackground,
        borderColor: theme.tooltipBorder,
        textStyle: {
          color: theme.textColor,
        },
      },
      legend: {
        show: false,
      },
      grid: {
        left: 12,
        right: 16,
        top: 24,
        bottom: chartData.labels.length > 0 ? 64 : 32,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: chartData.labels,
        boundaryGap: seriesType === "bar",
        axisLabel: {
          color: theme.textColor,
          rotate: chartData.labels.some((label) => label.length > 12)
            ? -35
            : 0,
          margin: 16,
        },
        axisLine: {
          lineStyle: {
            color: theme.gridColor,
          },
        },
        axisTick: {
          show: false,
        },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          color: theme.textColor,
          formatter: chartData.suffix === "%" ? "{value}%" : "{value}",
        },
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        splitLine: {
          lineStyle: {
            color: theme.gridColor,
            type: "dashed",
          },
        },
      },
      series:
        seriesType === "bar"
          ? [
              {
                name: chartData.seriesName,
                type: "bar",
                data: chartData.values,
                barMaxWidth: 42,
                itemStyle: {
                  color: seriesColor,
                  borderRadius: [8, 8, 0, 0],
                },
                showBackground: true,
                backgroundStyle: {
                  color: theme.barBackground,
                },
                emphasis: {
                  focus: "series",
                },
              },
            ]
          : [
              {
                name: chartData.seriesName,
                type: "line",
                data: chartData.values,
                showSymbol: true,
                symbol: "circle",
                symbolSize: 8,
                smooth: type === "area",
                lineStyle: {
                  width: 3,
                  color: seriesColor,
                },
                itemStyle: {
                  color: seriesColor,
                },
                areaStyle:
                  type === "area"
                    ? {
                        color: isDarkMode
                          ? "rgba(59, 130, 246, 0.25)"
                          : "rgba(59, 130, 246, 0.15)",
                      }
                    : undefined,
                emphasis: {
                  focus: "series",
                },
              },
            ],
    };
  }, [chartData, isDarkMode, pieData, theme, type]);

  const hasChartData =
    chartData.labels.length > 0 &&
    chartData.values.length === chartData.labels.length;

  if (!isMounted) {
    return (
      <div
        className={`bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 ${className}`}
      >
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-600"></div>
        </div>
      </div>
    );
  }

  if (!hasChartData) {
    return (
      <div
        className={`bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 ${className}`}
      >
        <ChartEmptyState height={height} />
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 ${className}`}
    >
      <Chart
        option={chartOptions}
        style={{ height, width: "100%" }}
        notMerge
        lazyUpdate
      />
    </div>
  );
}
