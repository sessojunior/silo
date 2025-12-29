'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

// Importação dinâmica do ApexCharts para evitar problemas de SSR
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

interface ReportChartProps {
	type: 'line' | 'bar' | 'donut' | 'area'
	data: Record<string, unknown>
	reportType?: 'availability' | 'problems' | 'performance' | 'projects' | 'executive'
	height?: number
	className?: string
}

export function ReportChart({ type, data, reportType, height = 300, className = '' }: ReportChartProps) {
	const [isMounted, setIsMounted] = useState(false)

	useEffect(() => {
		setIsMounted(true)
	}, [])

	if (!isMounted) {
		return (
			<div className={`bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 ${className}`}>
				<div className='flex items-center justify-center h-64'>
					<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-600'></div>
				</div>
			</div>
		)
	}

	// Logs de debug

	const getChartTitle = () => {
		if (!reportType) return 'Gráfico'

		switch (reportType) {
			case 'availability':
				return 'Disponibilidade por Produto'
			case 'problems':
				return 'Problemas por Categoria'
			case 'performance':
				return 'Performance da Equipe'
			case 'projects':
				return 'Projetos e Atividades'
			case 'executive':
				return 'Resumo Executivo'
			default:
				return 'Gráfico'
		}
	}

	const getChartSeries = () => {
		if (!reportType || !data) return []

		switch (reportType) {
			case 'availability':
				if (data.products && Array.isArray(data.products)) {
					// Para gráficos donut, categorizar produtos por nível de disponibilidade
					if (type === 'donut') {
						// Categorizar cada produto individualmente
						const categorizedProducts = data.products.map((item: Record<string, unknown>) => {
							const availability = item.availabilityPercentage as number
							const name = item.name as string

							if (availability >= 90) return { name, availability, category: 'available' }
							else if (availability >= 70) return { name, availability, category: 'warning' }
							else return { name, availability, category: 'critical' }
						})

						// Contar por categoria
						const availableProducts = categorizedProducts.filter((p) => p.category === 'available').length
						const warningProducts = categorizedProducts.filter((p) => p.category === 'warning').length
						const criticalProducts = categorizedProducts.filter((p) => p.category === 'critical').length

						// Debug logs removidos para produção

						// Retornar contagens absolutas para o gráfico donut
						return [availableProducts, warningProducts, criticalProducts]
					} else {
						// Para gráficos de barra e linha, usar dados individuais
						return [
							{
								name: 'Disponibilidade (%)',
								data: data.products.map((item: Record<string, unknown>) => item.availabilityPercentage as number),
							},
						]
					}
				}
				break
			case 'problems':
				if (data.problemsByCategory && Array.isArray(data.problemsByCategory)) {
					// Para gráficos donut, usar contagens absolutas
					if (type === 'donut') {
						return data.problemsByCategory.map((item: Record<string, unknown>) => item.problemsCount as number)
					} else {
						// Para gráficos de barra e linha, usar formato de série
						return [
							{
								name: 'Quantidade de Problemas',
								data: data.problemsByCategory.map((item: Record<string, unknown>) => item.problemsCount as number),
							},
						]
					}
				}
				break
			case 'performance':
				if (data.userPerformance && Array.isArray(data.userPerformance)) {
					// Para gráficos de barra e linha, usar múltiplas séries incluindo pontuação
					if (type !== 'donut') {
						return [
							{
								name: 'Pontuação Total',
								data: data.userPerformance.map((user: Record<string, unknown>) => user.totalScore as number),
							},
							{
								name: 'Problemas Criados',
								data: data.userPerformance.map((user: Record<string, unknown>) => user.problemsCreated as number),
							},
							{
								name: 'Soluções Fornecidas',
								data: data.userPerformance.map((user: Record<string, unknown>) => user.solutionsProvided as number),
							},
							{
								name: 'Tarefas Concluídas',
								data: data.userPerformance.map((user: Record<string, unknown>) => user.tasksCompleted as number),
							},
						]
					} else {
						// Para gráfico donut, usar contagens absolutas
						const totalTasksAssigned = data.userPerformance.reduce((sum: number, user: Record<string, unknown>) => sum + (user.tasksAssigned as number), 0)
						const totalTasksCompleted = data.userPerformance.reduce((sum: number, user: Record<string, unknown>) => sum + (user.tasksCompleted as number), 0)

						return [totalTasksAssigned, totalTasksCompleted]
					}
				}
				break
			case 'projects':
				if (data.projectsWithProgress && Array.isArray(data.projectsWithProgress)) {
					// Para gráficos de barra e linha, usar progresso dos projetos
					if (type !== 'donut') {
						return [
							{
								name: 'Progresso (%)',
								data: data.projectsWithProgress.map((project: Record<string, unknown>) => project.progress as number),
							},
						]
					} else {
						// Para gráfico donut, usar contagens absolutas por status
						if (data.projectsByStatus) {
							return Object.values(data.projectsByStatus as Record<string, number>)
						}
						return []
					}
				}
				break
		}

		return []
	}

	const getChartLabels = () => {
		if (!reportType || !data) return []

		switch (reportType) {
			case 'availability':
				if (data.products && Array.isArray(data.products)) {
					// Para gráficos donut, usar categorias de disponibilidade
					if (type === 'donut') {
						return ['Disponível (≥90%)', 'Atenção (70-89%)', 'Crítico (<70%)']
					} else {
						// Para gráficos de barra e linha, usar nomes dos produtos
						return data.products.map((item: Record<string, unknown>) => (item.name as string) || 'Produto')
					}
				}
				break
			case 'problems':
				if (data.problemsByCategory && Array.isArray(data.problemsByCategory)) {
					return data.problemsByCategory.map((item: Record<string, unknown>) => (item.name as string) || 'Categoria')
				}
				break
			case 'performance':
				if (data.userPerformance && Array.isArray(data.userPerformance)) {
					// Para gráficos donut, usar labels específicos para atividades
					if (type === 'donut') {
						return ['Tarefas Atribuídas', 'Tarefas Concluídas']
					} else {
						return data.userPerformance.map((user: Record<string, unknown>) => (user.name as string) || 'Usuário')
					}
				}
				break
			case 'projects':
				if (data.projectsWithProgress && Array.isArray(data.projectsWithProgress)) {
					// Para gráficos donut, usar labels de status traduzidos
					if (type === 'donut') {
						if (data.projectsByStatus) {
							const statusTranslations: Record<string, string> = {
								active: 'Ativo',
								completed: 'Concluído',
								paused: 'Pausado',
								cancelled: 'Cancelado',
								unknown: 'Desconhecido',
							}
							return Object.keys(data.projectsByStatus as Record<string, number>).map((status) => statusTranslations[status] || status)
						}
						return []
					} else {
						return data.projectsWithProgress.map((project: Record<string, unknown>) => (project.name as string) || 'Projeto')
					}
				}
				break
		}

		return []
	}

	const getChartOptions = () => {
		const baseOptions = {
			chart: {
				type,
				toolbar: {
					show: true,
					tools: {
						download: true,
						selection: true,
						zoom: true,
						zoomin: true,
						zoomout: true,
						pan: true,
						reset: true,
					},
				},
				background: 'transparent',
			},
			theme: {
				mode: 'light' as const,
			},
			title: {
				text: getChartTitle(),
				align: 'left' as const,
				style: {
					fontSize: '16px',
					fontWeight: 600,
					color: '#374151',
				},
			},
			colors: ['#6b7280', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'],
			legend: {
				position: 'bottom' as const,
				labels: {
					colors: '#6b7280',
				},
			},
			grid: {
				borderColor: '#e5e7eb',
				strokeDashArray: 5,
			},
			xaxis: {
				labels: {
					style: {
						colors: '#6b7280',
					},
				},
			},
			yaxis: {
				labels: {
					style: {
						colors: '#6b7280',
					},
				},
			},
			tooltip: {
				theme: 'light' as const,
				y: {
					formatter: (value: number) => {
						if (type === 'donut') {
							// Para gráficos donut, exibir com uma casa decimal e símbolo %
							return `${value.toFixed(1)}%`
						}
						return value.toLocaleString('pt-BR')
					},
				},
			},
		}

		// Configurações específicas por tipo
		switch (type) {
			case 'line':
				return {
					...baseOptions,
					stroke: {
						curve: 'smooth' as const,
						width: 3,
					},
					markers: {
						size: 5,
						hover: {
							size: 7,
						},
					},
				}

			case 'bar':
				return {
					...baseOptions,
					plotOptions: {
						bar: {
							borderRadius: 4,
							columnWidth: '70%',
						},
					},
				}

			case 'donut':
				return {
					...baseOptions,
					plotOptions: {
						pie: {
							donut: {
								size: '60%',
								labels: {
									show: true,
									name: {
										show: true,
										fontSize: '14px',
										fontWeight: 600,
										color: '#374151',
									},
									value: {
										show: true,
										fontSize: '16px',
										fontWeight: 700,
										color: '#374151',
										formatter: (val: string) => {
											const value = parseFloat(val)
											return `${value.toFixed(1)}%`
										},
									},
								},
							},
						},
					},
					// Para gráficos donut, configurar legendas das séries
					labels: getChartLabels(),
					// Configurar cores específicas baseadas no tipo de relatório
					colors:
						reportType === 'availability'
							? ['#10b981', '#f59e0b', '#ef4444'] // Verde para disponível, amarelo para atenção, vermelho para crítico
							: reportType === 'problems'
								? data.problemsByCategory && Array.isArray(data.problemsByCategory)
									? data.problemsByCategory.map((item: Record<string, unknown>) => (item.color as string) || '#6b7280')
									: ['#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#6b7280'] // Cores padrão para problemas
								: reportType === 'projects'
									? ['#8b5cf6', '#6b7280', '#f59e0b', '#ef4444', '#10b981', '#f97316'] // Cores variadas para projetos
									: ['#6b7280', '#10b981'], // Cinza para tarefas atribuídas, verde para concluídas (performance)
					legend: {
						...baseOptions.legend,
					},
				}

			case 'area':
				return {
					...baseOptions,
					stroke: {
						curve: 'smooth' as const,
						width: 2,
					},
					fill: {
						type: 'gradient',
						gradient: {
							shadeIntensity: 1,
							opacityFrom: 0.7,
							opacityTo: 0.3,
							stops: [0, 100],
						},
					},
				}

			default:
				return baseOptions
		}
	}

	const chartOptions = getChartOptions()
	const chartSeries = getChartSeries()
	const chartLabels = getChartLabels()

	// Debug logs removidos para produção

	// Atualizar as opções do gráfico com os labels
	if (chartLabels.length > 0) {
		;(chartOptions.xaxis as Record<string, unknown>).categories = chartLabels
	}

	return (
		<div className={`bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 ${className}`}>
			<Chart options={chartOptions} series={chartSeries} type={type} height={height} />
		</div>
	)
}
