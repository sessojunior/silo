'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useMemo } from 'react'
import type { ApexOptions } from 'apexcharts'

// Importação dinâmica para evitar SSR
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

export default function ChartColumn({ categories, data }: { categories: string[]; data: number[] }) {
	const [isClient, setIsClient] = useState(false)

	// Tons claros para cada faixa
	const LIGHT = {
		green: '#05DF72',
		orange: '#FF8904',
		red: '#e7000b',
	}

	// Arrays de cores por barra (claro)
	const leftColors = useMemo(() => {
		const left: string[] = []

		data.forEach((v) => {
			if (v <= 2) {
				left.push(LIGHT.green)
			} else if (v <= 4) {
				left.push(LIGHT.orange)
			} else {
				left.push(LIGHT.red)
			}
		})

		return left
	}, [data, LIGHT.green, LIGHT.orange, LIGHT.red])

	const series = useMemo(
		() => [
			{
				name: 'Incidentes',
				data,
			},
		],
		[data],
	)

	const options: ApexOptions = useMemo(
		() => ({
			chart: {
				type: 'bar',
				toolbar: { show: false },
			},
			plotOptions: {
				bar: {
					distributed: true,
					borderRadius: 8,
					columnWidth: '50%',
				},
			},
			legend: { show: false },
			colors: leftColors,
			dataLabels: { enabled: false },
			stroke: { width: 0 },
			grid: {
				show: false,
				row: {
					colors: ['#fff', '#f2f2f2'],
				},
			},
			xaxis: {
				categories,
				labels: { rotate: -45 },
			},
			fill: {
				type: 'gradient',
				gradient: {
					shade: 'light',
					type: 'horizontal',
					shadeIntensity: 0.25,
					gradientToColors: undefined,
					opacityFrom: 0.85,
					opacityTo: 0.85,
					stops: [50, 0, 100],
				},
			},
		}),
		[categories, leftColors],
	)

	useEffect(() => {
		setIsClient(true)
	}, [])

	return <div className='w-full max-w-lg'>{isClient && <ReactApexChart options={options} series={series} type='bar' height={320} />}</div>
}
