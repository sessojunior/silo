'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import type { ApexOptions } from 'apexcharts'

// Importação dinâmica para evitar SSR
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

interface ChartApiResponse {
	categories: string[]
	problems: number[]
	solutions: number[]
}

export default function ChartLine({ refresh = 0 }: { refresh?: number }) {
	const [mounted, setMounted] = useState(false)
	const [chartData, setChartData] = useState<ChartApiResponse | null>(null)

	useEffect(() => {
		setMounted(true)
	}, [])

	useEffect(() => {
		async function load() {
			try {
				const res = await fetch('/api/admin/dashboard/problems-solutions')
				if (res.ok) {
					const json = (await res.json()) as ChartApiResponse
					setChartData(json)
				}
			} catch (error) {
				console.error('❌ [COMPONENT_CHART_LINE] Erro ao carregar dados do gráfico de problemas & soluções:', { error })
			}
		}
		load()
	}, [refresh])

	const series = chartData
		? [
				{ name: 'Problemas', data: chartData.problems },
				{ name: 'Soluções', data: chartData.solutions },
			]
		: [
				{ name: 'Problemas', data: [] },
				{ name: 'Soluções', data: [] },
			]

	const options: ApexOptions = {
		chart: {
			type: 'line',
			toolbar: { show: false },
			zoom: { enabled: false },
		},
		dataLabels: {
			enabled: false,
		},
		stroke: {
			width: [5, 7],
			curve: 'straight',
			dashArray: [0, 8],
		},
		markers: {
			size: 0,
			hover: {
				sizeOffset: 6,
			},
		},
		xaxis: {
			categories: chartData ? chartData.categories : [],
		},
		tooltip: {
			y: [
				{
					title: {
						formatter: (val: string) => `${val}:`,
					},
				},
				{
					title: {
						formatter: (val: string) => `${val} documentadas:`,
					},
				},
			],
		},
		grid: {
			borderColor: '#f1f1f1',
		},
	}

	return <div className='w-full max-w-lg'>{mounted && chartData && <ReactApexChart key={refresh} options={options} series={series} type='line' height={360} />}</div>
}
