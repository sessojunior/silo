<template>
  <div>
    <ClientOnly>
      <apexchart
        :options="chartOptions"
        :series="series"
        :labels="labels"
      ></apexchart>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
const series = [65, 17, 21, 48, 121];
const labels = [
  "Rede externa",
  "Servidor indisponível",
  "Falha humana",
  "Rede interna",
  "Erro no software",
];
const chartOptions = {
  chart: {
    type: "donut",
    width: "100%",
  },
  labels: labels,
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
    type: "gradient",
  },
  legend: {
    show: true,
    position: "left",
    height: "100%",
    formatter: function (val: string, opts: any) {
      return `<span class="pl-1 font-bold">${val}</span>: ${
        opts.w.globals.series[opts.seriesIndex]
      }`;
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
};
</script>
