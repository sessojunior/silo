"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import type { ApiResponse as HttpResponse } from "@/lib/api-response";
import { config } from "@/lib/config";
import { useDarkMode } from "@/hooks/use-dark-mode";

const ReactECharts = dynamic(
  async () => (await import("echarts-for-react")).default,
  {
    ssr: false,
  },
);

const DEFAULT_COLORS = [
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#3b82f6",
  "#8b5cf6",
];

interface ApiResponse {
  labels: string[];
  values: number[];
  colors?: (string | null)[];
}

export default function ChartDonut({ refresh = 0 }: { refresh?: number }) {
  const isDarkMode = useDarkMode();
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `${config.getApiUrl("/api/admin/dashboard/problems-causes")}?_t=${Date.now()}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const json = (await res.json()) as HttpResponse<ApiResponse>;
          if (json.success && json.data) {
            setData(json.data);
          } else {
            setData(null);
          }
        } else {
          const json = (await res
            .json()
            .catch(() => null)) as HttpResponse<unknown> | null;
          console.error("❌ [COMPONENT_CHART_DONUT] Erro ao carregar chart:", {
            status: res.status,
            message: json?.message ?? json?.error ?? null,
          });
          setData(null);
        }
      } catch (error) {
        console.error(
          "❌ [COMPONENT_CHART_DONUT] Erro ao carregar causas de problemas:",
          { error },
        );
      }
    }
    load();
  }, [refresh]);

  const labels = data?.labels ?? [];
  const values = data?.values ?? [];

  const theme = useMemo(
    () => ({
      textColor: isDarkMode ? "#e4e4e7" : "#52525b",
      tooltipBackground: isDarkMode ? "#09090b" : "#ffffff",
      tooltipBorder: isDarkMode ? "#27272a" : "#d4d4d8",
      donutBorder: isDarkMode ? "#18181b" : "#ffffff",
    }),
    [isDarkMode],
  );

  const pieData = useMemo(
    () =>
      labels.map((label, index) => ({
        value: values[index] ?? 0,
        name: label,
        itemStyle: {
          color:
            data?.colors?.[index] ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length],
        },
      })),
    [data?.colors, labels, values],
  );

  const options = useMemo<EChartsOption>(
    () => ({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: theme.tooltipBackground,
        borderColor: theme.tooltipBorder,
        textStyle: {
          color: theme.textColor,
        },
        confine: true,
        formatter: "{b}<br/>{c} problemas ({d}%)",
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
          radius: ["56%", "76%"],
          center: ["50%", "40%"],
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
    }),
    [pieData, theme],
  );

  const hasChartData = labels.length > 0 && values.length === labels.length;

  return (
    <div className="w-full max-w-lg">
      {hasChartData && (
        <ReactECharts
          key={refresh}
          option={options}
          style={{ height: 360, width: "100%" }}
          notMerge
          lazyUpdate
        />
      )}
    </div>
  );
}
