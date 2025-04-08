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
			name: 'Problemas',
			data: [45, 52, 38, 24, 33, 26, 21, 20, 6, 8, 15, 10]
		},
		{
			name: 'Soluções',
			data: [35, 41, 62, 42, 13, 18, 29, 37, 36, 51, 32, 35]
		}
	])

	let chartOptions = $state({
		chart: {
			type: 'line',
			toolbar: {
				show: false
			},
			zoom: {
				enabled: false
			}
		},
		dataLabels: {
			enabled: false
		},
		stroke: {
			width: [5, 7, 5],
			curve: 'straight',
			dashArray: [0, 8, 5]
		},
		markers: {
			size: 0,
			hover: {
				sizeOffset: 6
			}
		},
		xaxis: {
			categories: ['01/01', '02/01', '03/01', '04/01', '05/01', '06/01', '07/01', '08/01', '09/01', '10/01', '11/01', '12/01']
		},
		tooltip: {
			y: [
				{
					title: {
						formatter: function (val: string) {
							return val + ':'
						}
					}
				},
				{
					title: {
						formatter: function (val: string) {
							return val + ' documentadas:'
						}
					}
				}
			]
		},
		grid: {
			borderColor: '#f1f1f1'
		}
	})

	onMount(async () => {
		const ApexCharts = (await import('apexcharts')).default // Import dinâmico
		chart = new ApexCharts(chartContainer, {
			chart: chartOptions.chart,
			series,
			dataLabels: chartOptions.dataLabels,
			stroke: chartOptions.stroke,
			grid: chartOptions.grid,
			xaxis: chartOptions.xaxis,
			tooltip: chartOptions.tooltip
		})

		chart.render()
	})

	onDestroy(() => {
		chart?.destroy()
	})
</script>

<div bind:this={chartContainer} class="w-full max-w-lg"></div>
