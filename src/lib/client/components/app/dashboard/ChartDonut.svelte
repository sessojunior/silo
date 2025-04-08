<script lang="ts">
	import { onMount, onDestroy } from 'svelte'

	let chartContainer: HTMLDivElement
	let chart: any = null

	let series = $state([65, 17, 21, 48, 121])
	let labels = $state(['Rede externa', 'Servidor indisponível', 'Falha humana', 'Rede interna', 'Erro no software'])

	let chartOptions = $state({
		chart: {
			type: 'donut',
			width: '100%'
		},
		labels,
		plotOptions: {
			pie: {
				startAngle: -90,
				endAngle: 270,
				expandOnClick: false
			}
		},
		dataLabels: { enabled: false },
		fill: { type: 'gradient' },
		legend: {
			show: true,
			position: 'left',
			height: '100%',
			formatter: (val: string, opts: any) => `<span class="text-sm pl-1">${val}: <span class="font-bold">${opts.w.globals.series[opts.seriesIndex]}</span></span>`
		},
		responsive: [
			{
				breakpoint: 480,
				options: {
					chart: { width: 200 },
					legend: { position: 'bottom' }
				}
			}
		]
	})

	onMount(async () => {
		const ApexCharts = (await import('apexcharts')).default
		chart = new ApexCharts(chartContainer, {
			chart: chartOptions.chart,
			series,
			labels,
			plotOptions: chartOptions.plotOptions,
			dataLabels: chartOptions.dataLabels,
			fill: chartOptions.fill,
			legend: chartOptions.legend,
			responsive: chartOptions.responsive
		})

		chart.render()
	})

	onDestroy(() => {
		chart?.destroy()
	})
</script>

<div bind:this={chartContainer} class="w-full max-w-lg"></div>
