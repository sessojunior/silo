'use client'

import Select from '@/components/ui/Select'
import { formatDate, formatDateBR } from '@/lib/dateUtils'

interface ReportFiltersType {
	dateRange: string
	startDate?: Date
	endDate?: Date
}

interface ReportFiltersProps {
	filters: ReportFiltersType
	onFiltersChange: (filters: ReportFiltersType) => void
	reportType: 'availability' | 'problems' | 'performance' | 'projects'
}

export function ReportFilters({ filters, onFiltersChange, reportType }: ReportFiltersProps) {
	const handleFilterChange = (key: keyof ReportFiltersType, value: string | Date | undefined) => {
		// Normalizar datas para timezone de São Paulo
		if (key === 'startDate' && value instanceof Date) {
			value = new Date(formatDate(value) + 'T00:00:00')
		}
		if (key === 'endDate' && value instanceof Date) {
			value = new Date(formatDate(value) + 'T23:59:59')
		}

		onFiltersChange({
			...filters,
			[key]: value,
		})
	}

	const getReportTypeLabel = () => {
		switch (reportType) {
			case 'availability':
				return 'Disponibilidade'
			case 'problems':
				return 'Problemas'
			case 'performance':
				return 'Performance'
			case 'projects':
				return 'Projetos'
			default:
				return 'Relatório'
		}
	}

	return (
		<div className='rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 shadow-sm'>
			<div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
				{/* Título e Descrição */}
				<div className='flex items-center space-x-3'>
					<div className='flex items-center justify-center w-10 h-10 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg'>
						<svg className='w-5 h-5 text-zinc-600 dark:text-zinc-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
							<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' />
						</svg>
					</div>
					<div>
						<h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>Filtros do Relatório de {getReportTypeLabel()}</h3>
						<p className='text-sm text-gray-600 dark:text-gray-400'>Selecione o período para análise dos dados</p>
					</div>
				</div>

				{/* Filtro de Período */}
				<div className='flex flex-col sm:flex-row items-start sm:items-center gap-3'>
					<div className='flex items-center space-x-2'>
						<svg className='w-4 h-4 text-gray-500 dark:text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
							<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' />
						</svg>
						<span className='text-sm font-medium text-gray-700 dark:text-gray-300'>Período</span>
					</div>
					<Select
						name='dateRange'
						selected={filters.dateRange}
						onChange={(value) => handleFilterChange('dateRange', value)}
						options={[
							{ label: '📅 Últimos 7 dias', value: '7d' },
							{ label: '📅 Últimos 30 dias', value: '30d' },
							{ label: '📅 Últimos 90 dias', value: '90d' },
							{ label: '📅 Personalizado', value: 'custom' },
						]}
					/>
				</div>
			</div>

			{/* Datas Personalizadas - Design Melhorado */}
			{filters.dateRange === 'custom' && (
				<div className='mt-6 pt-6 border-t border-zinc-200/50 dark:border-zinc-700/30'>
					<div className='bg-white/75 dark:bg-zinc-900/20 rounded-lg p-4 border border-gray-200 dark:border-zinc-700/20'>
						<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
							<div className='space-y-2'>
								<label className='text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center space-x-2'>
									<svg className='w-4 h-4 text-zinc-500' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' />
									</svg>
									<span>Data de Início</span>
								</label>
								<input type='date' value={filters.startDate?.toISOString().split('T')[0] || ''} onChange={(e) => handleFilterChange('startDate', new Date(e.target.value))} className='block w-full rounded-lg py-3 px-4 border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500 transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-600' />
							</div>
							<div className='space-y-2'>
								<label className='text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center space-x-2'>
									<svg className='w-4 h-4 text-zinc-500' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' />
									</svg>
									<span>Data de Fim</span>
								</label>
								<input type='date' value={filters.endDate?.toISOString().split('T')[0] || ''} onChange={(e) => handleFilterChange('endDate', new Date(e.target.value))} className='block w-full rounded-lg py-3 px-4 border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500 transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-600' />
							</div>
						</div>

						{/* Validação visual */}
						{filters.startDate && filters.endDate && (
							<div className='mt-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700'>
								<div className='flex items-center space-x-2 text-sm text-zinc-700 dark:text-zinc-300'>
									<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' />
									</svg>
									<span>
										Período selecionado: <strong>{formatDateBR(filters.startDate.toISOString().split('T')[0])}</strong> até <strong>{formatDateBR(filters.endDate.toISOString().split('T')[0])}</strong>
									</span>
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	)
}
