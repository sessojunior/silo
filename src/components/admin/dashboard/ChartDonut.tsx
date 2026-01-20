"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { ApexOptions } from "apexcharts";
import type { ApiResponse as HttpResponse } from "@/lib/api-response";
import { config } from "@/lib/config";

// Importa dinamicamente o ApexChart para evitar SSR
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

interface ApiResponse {
  labels: string[];
  values: number[];
  colors?: (string | null)[];
}

export default function ChartDonut({ refresh = 0 }: { refresh?: number }) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          config.getApiUrl("/api/admin/dashboard/problems-causes"),
        );
        if (res.ok) {
          const json = (await res.json()) as HttpResponse<ApiResponse>;
          if (json.success && json.data) {
            setData(json.data);
          } else {
            setData(null);
          }
        } else {
          const json = (await res.json().catch(() => null)) as
            | HttpResponse<unknown>
            | null;
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

  const series = data?.values ?? [];
  const labels = data?.labels ?? [];

  const options: ApexOptions = {
    chart: {
      type: "donut",
      width: "100%",
    },
    labels,
    colors: data?.colors as string[] | undefined,
    plotOptions: {
      pie: {
        startAngle: -90,
        endAngle: 270,
        expandOnClick: false,
      },
    },
    dataLabels: {
      enabled: false,
    },
    fill: {
      type: "solid",
    },
    legend: {
      show: true,
      position: "left",
      formatter: function (val, opts) {
        const value = opts.w.globals.series[opts.seriesIndex];
        return `${val}: ${value}`;
      },
      labels: {
        colors: "inherit",
        useSeriesColors: false,
      },
      fontSize: "14px",
      itemMargin: {
        vertical: 4,
      },
    },
    responsive: [
      {
        breakpoint: 480,
        options: {
          chart: {
            width: 200,
          },
          legend: {
            position: "bottom",
          },
        },
      },
    ],
    tooltip: {
      y: {
        formatter: (val) => `${val} problemas`,
      },
    },
  };

  const hasChartData = labels.length > 0 && series.length > 0;

  return (
    <div className="w-full max-w-lg">
      {mounted && hasChartData && (
        <ReactApexChart
          key={refresh}
          options={options}
          series={series}
          type="donut"
          height={360}
        />
      )}
    </div>
  );
}
