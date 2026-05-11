"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import type { ApiResponse as HttpResponse } from "@/lib/api-response";
import { ChartEmptyState } from "@/components/ui/chart-empty-state";
import { config } from "@/lib/config";
import { useDarkMode } from "@/hooks/use-dark-mode";

const ReactECharts = dynamic(
  async () => (await import("echarts-for-react")).default,
  {
    ssr: false,
  },
);

const SERIES_COLORS = {
  problems: "#ef4444",
  solutions: "#10b981",
};

interface ChartApiResponse {
  categories: string[];
  problems: number[];
  solutions: number[];
}

export default function ChartLine({ refresh = 0 }: { refresh?: number }) {
  const isDarkMode = useDarkMode();
  const [chartData, setChartData] = useState<ChartApiResponse | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function load() {
      try {
        const res = await fetch(
          `${config.getApiUrl("/api/admin/dashboard/problems-solutions")}?_t=${Date.now()}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const json = (await res.json()) as HttpResponse<ChartApiResponse>;
          if (json.success && json.data) {
            setChartData(json.data);
          } else {
            setChartData(null);
          }
        }
      } catch (error) {
        console.error(
          "❌ [COMPONENT_CHART_LINE] Erro ao carregar dados do gráfico de problemas & soluções:",
          { error },
        );
      } finally {
        if (isActive) {
          setHasFetched(true);
        }
      }
    }

    load();

    return () => {
      isActive = false;
    };
  }, [refresh]);

  const categories = chartData?.categories ?? [];
  const problems = chartData?.problems ?? [];
  const solutions = chartData?.solutions ?? [];

  const theme = useMemo(
    () => ({
      textColor: isDarkMode ? "#e4e4e7" : "#52525b",
      gridColor: isDarkMode ? "rgba(63, 63, 70, 0.85)" : "#e5e7eb",
      tooltipBackground: isDarkMode ? "#09090b" : "#ffffff",
      tooltipBorder: isDarkMode ? "#27272a" : "#d4d4d8",
    }),
    [isDarkMode],
  );

  const options = useMemo<EChartsOption>(
    () => ({
      backgroundColor: "transparent",
      color: [SERIES_COLORS.problems, SERIES_COLORS.solutions],
      grid: {
        left: 8,
        right: 16,
        top: 24,
        bottom: 48,
        containLabel: true,
      },
      legend: {
        top: 0,
        textStyle: {
          color: theme.textColor,
        },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "line",
        },
        backgroundColor: theme.tooltipBackground,
        borderColor: theme.tooltipBorder,
        textStyle: {
          color: theme.textColor,
        },
        confine: true,
      },
      xAxis: {
        type: "category",
        data: categories,
        boundaryGap: false,
        axisLabel: {
          color: theme.textColor,
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
      series: [
        {
          name: "Problemas",
          type: "line",
          data: problems,
          smooth: false,
          symbol: "circle",
          symbolSize: 9,
          lineStyle: {
            width: 3,
            color: SERIES_COLORS.problems,
          },
          itemStyle: {
            color: SERIES_COLORS.problems,
          },
          emphasis: {
            focus: "series",
          },
        },
        {
          name: "Soluções",
          type: "line",
          data: solutions,
          smooth: false,
          symbol: "circle",
          symbolSize: 9,
          lineStyle: {
            width: 3,
            color: SERIES_COLORS.solutions,
            type: "dashed",
          },
          itemStyle: {
            color: SERIES_COLORS.solutions,
          },
          emphasis: {
            focus: "series",
          },
        },
      ],
    }),
    [categories, problems, solutions, theme],
  );

  const hasChartData =
    categories.length > 0 &&
    problems.length === categories.length &&
    solutions.length === categories.length;

  return (
    <div className="w-full max-w-lg">
      {!hasFetched ? (
        <div className="h-90 w-full" aria-hidden="true" />
      ) : hasChartData ? (
        <ReactECharts
          key={refresh}
          option={options}
          style={{ height: 360, width: "100%" }}
          notMerge
          lazyUpdate
        />
      ) : (
        <ChartEmptyState height={360} />
      )}
    </div>
  );
}
