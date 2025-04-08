<script lang="ts">
	import { onMount, onDestroy } from 'svelte'

	let chartContainer: HTMLDivElement
	let chart: any = null

	let isClient = false
	onMount(() => {
		isClient = true
	})

	let series = $state([
		{
			name: 'Incidentes',
			data: [44, 55, 41, 67, 22, 43, 21, 33, 45, 31]
		}
	])

	let chartOptions = $state({
		chart: {
			type: 'bar',
			toolbar: {
				show: false
			}
		},
		plotOptions: {
			bar: {
				borderRadius: 8,
				columnWidth: '50%'
			}
		},
		dataLabels: {
			enabled: false
		},
		stroke: {
			width: 0
		},
		grid: {
			show: false,
			row: {
				colors: ['#fff', '#f2f2f2']
			}
		},
		xaxis: {
			labels: {
				rotate: -45
			},
			categories: ['25/02', '26/02', '27/02', '28/02', '01/03', '02/03', '03/03', '04/03', '05/03', '06/03']
		},
		fill: {
			type: 'gradient',
			gradient: {
				shade: 'light',
				type: 'horizontal',
				shadeIntensity: 0.25,
				gradientToColors: undefined,
				inverseColors: true,
				opacityFrom: 0.85,
				opacityTo: 0.85,
				stops: [50, 0, 100]
			}
		}
	})

	onMount(async () => {
		const ApexCharts = (await import('apexcharts')).default // Import dinâmico
		chart = new ApexCharts(chartContainer, {
			chart: chartOptions.chart,
			series,
			plotOptions: chartOptions.plotOptions,
			dataLabels: chartOptions.dataLabels,
			stroke: chartOptions.stroke,
			grid: chartOptions.grid,
			xaxis: chartOptions.xaxis,
			fill: chartOptions.fill
		})

		chart.render()
	})

	onDestroy(() => {
		chart?.destroy()
	})
</script>

<div bind:this={chartContainer} class="w-full max-w-lg"></div>
