"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useDarkMode } from "@/hooks/use-dark-mode";

const ReactECharts = dynamic(
  async () => (await import("echarts-for-react")).default,
  {
    ssr: false,
  },
);

const COLOR_SCALE = {
  low: "#10b981",
  mid: "#f59e0b",
  high: "#ef4444",
};

export default function ChartColumn({
  categories,
  data,
}: {
  categories: string[];
  data: number[];
}) {
  const isDarkMode = useDarkMode();

  const leftColors = useMemo(() => {
    const left: string[] = [];

    data.forEach((v) => {
      if (v <= 2) {
        left.push(COLOR_SCALE.low);
      } else if (v <= 4) {
        left.push(COLOR_SCALE.mid);
      } else {
        left.push(COLOR_SCALE.high);
      }
    });

    return left;
  }, [data]);

  const theme = useMemo(
    () => ({
      textColor: isDarkMode ? "#e4e4e7" : "#52525b",
      gridColor: isDarkMode ? "rgba(63, 63, 70, 0.85)" : "#e5e7eb",
      tooltipBackground: isDarkMode ? "#09090b" : "#ffffff",
      tooltipBorder: isDarkMode ? "#27272a" : "#d4d4d8",
      backgroundFill: isDarkMode ? "rgba(255, 255, 255, 0.04)" : "#f8fafc",
    }),
    [isDarkMode],
  );

  const chartData = useMemo(
    () =>
      data.map((value, index) => ({
        value,
        itemStyle: {
          color: leftColors[index],
          borderRadius: [8, 8, 0, 0],
        },
      })),
    [data, leftColors],
  );

  const options = useMemo<EChartsOption>(
    () => ({
      backgroundColor: "transparent",
      grid: {
        left: 12,
        right: 16,
        top: 20,
        bottom: 68,
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
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
        axisLabel: {
          color: theme.textColor,
          rotate: -35,
          margin: 18,
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
        minInterval: 1,
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
          name: "Incidentes",
          type: "bar",
          data: chartData,
          barMaxWidth: 42,
          showBackground: true,
          backgroundStyle: {
            color: theme.backgroundFill,
          },
          emphasis: {
            focus: "series",
          },
        },
      ],
    }),
    [categories, chartData, theme],
  );

  return (
    <div className="w-full max-w-lg">
      <ReactECharts
        option={options}
        style={{ height: 320, width: "100%" }}
        notMerge
        lazyUpdate
      />
    </div>
  );
}
