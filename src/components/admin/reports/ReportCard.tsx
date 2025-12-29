'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Report {
	id: string
	title: string
	description: string
	icon: string
	color: string
	metrics: string[]
}

interface ReportCardProps {
	report: Report
}

const colorClasses = {
	blue: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900',
	red: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900',
	green: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900',
	purple: 'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900',
}

const iconColors = {
	blue: 'text-blue-600 dark:text-blue-400',
	red: 'text-red-600 dark:text-red-400',
	green: 'text-green-600 dark:text-green-400',
	purple: 'text-purple-600 dark:text-purple-400',
}

export function ReportCard({ report }: ReportCardProps) {
	const router = useRouter()
	const [isGenerating, setIsGenerating] = useState(false)

	const handleGenerateReport = async () => {
		setIsGenerating(true)
		try {
			// Simular geração do relatório
			await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulação reduzida

			// Navegar para a página de visualização do relatório
			router.push(`/admin/reports/${report.id}`)
		} catch (error) {
			console.error('❌ [COMPONENT_REPORT_CARD] Erro ao gerar relatório:', { error })
		} finally {
			setIsGenerating(false)
		}
	}

	return (
		<div
			className={`
      relative p-6 rounded-lg border-2 transition-all duration-200 cursor-pointer
      ${colorClasses[report.color as keyof typeof colorClasses]}
    `}
		>

			<div className='flex h-full justify-between flex-col'>
				<div>
					{/* Ícone */}
					<div className={`text-4xl mb-4 ${iconColors[report.color as keyof typeof iconColors]}`}>{report.icon}</div>

					{/* Título */}
					<h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2'>{report.title}</h3>

					{/* Descrição */}
					<p className='text-sm text-gray-600 dark:text-gray-400 mb-4'>{report.description}</p>

					{/* Métricas */}
					<div className='space-y-2 mb-6'>
						{report.metrics.map((metric, index) => (
							<div key={index} className='flex items-center text-sm text-gray-700 dark:text-gray-300'>
								<div className='w-2 h-2 rounded-full bg-gray-400 mr-2'></div>
								{metric}
							</div>
						))}
					</div>
				</div>
				<div>
					{/* Botão de Ação */}
					<button
						onClick={handleGenerateReport}
						disabled={isGenerating}
						className={`
							w-full px-4 py-2 rounded-md font-medium transition-colors
							${isGenerating ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'}
						`}
					>
						{isGenerating ? (
							<span className='flex items-center justify-center'>
								<div className='animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2'></div>
								Gerando...
							</span>
						) : (
							'Abrir Relatório'
						)}
					</button>
				</div>
			</div>

			{/* Indicador de Status */}
			<div className='absolute top-4 right-4'>
				<div className='w-3 h-3 rounded-full bg-green-500'></div>
			</div>
		</div>
	)
}
