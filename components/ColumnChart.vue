<template>
  <div>
    <ClientOnly>
      <apexchart :options="chartOptions" :series="series"></apexchart>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
const series = [
  {
    name: "Incidentes",
    data: [44, 55, 41, 67, 22, 43, 21, 33, 45, 31],
  },
];
const chartOptions = {
  chart: {
    type: "bar",
    toolbar: {
      show: false,
    },
  },
  plotOptions: {
    bar: {
      borderRadius: 8,
      columnWidth: "50%",
    },
  },
  dataLabels: {
    enabled: false,
  },
  stroke: {
    width: 0,
  },
  grid: {
    show: false,
    row: {
      colors: ["#fff", "#f2f2f2"],
    },
  },
  xaxis: {
    labels: {
      rotate: -45,
    },
    categories: [
      "25 fev",
      "26 fev",
      "27 fev",
      "28 fev",
      "01 mar",
      "02 mar",
      "03 mar",
      "04 mar",
      "05 mar",
      "06 mar",
    ],
  },
  fill: {
    type: "gradient",
    gradient: {
      shade: "light",
      type: "horizontal",
      shadeIntensity: 0.25,
      gradientToColors: undefined,
      inverseColors: true,
      opacityFrom: 0.85,
      opacityTo: 0.85,
      stops: [50, 0, 100],
    },
  },
};
</script>

<style>
.apexcharts-canvas text tspan {
  @apply dark:fill-neutral-100 !important;
}
.apexcharts-grid rect {
  @apply dark:even:fill-neutral-700 dark:odd:fill-none !important;
}
.apexcharts-tooltip-title {
  @apply dark:text-neutral-800 !important;
}
.apexcharts-tooltip-text {
  @apply dark:text-neutral-800 !important;
}
</style>
