'use client'

import { Project } from '@/types/projects'

interface ProjectStatsCardsProps {
	projects: Project[]
}

// Função para calcular estatísticas dos projetos
function calculateProjectStats(projects: Project[]) {
	const total = projects.length
	const active = projects.filter((p) => p.status === 'active').length
	const completed = projects.filter((p) => p.status === 'completed').length
	const paused = projects.filter((p) => p.status === 'paused').length
	const cancelled = projects.filter((p) => p.status === 'cancelled').length

	// Calcular progresso médio (usando progresso se disponível, senão baseado no status)
	const totalProgress = projects.reduce((sum, project) => {
		// Sem progresso por enquanto, usar 0
		return sum + 0
		switch (project.status) {
			case 'completed':
				return sum + 100
			case 'active':
				return sum + 50
			case 'paused':
				return sum + 25
			case 'cancelled':
				return sum + 0
			default:
				return sum + 0
		}
	}, 0)

	const avgProgress = total > 0 ? Math.round(totalProgress / total) : 0

	return {
		total,
		active,
		completed,
		paused,
		cancelled,
		avgProgress,
	}
}

export default function ProjectStatsCards({ projects }: ProjectStatsCardsProps) {
	const stats = calculateProjectStats(projects)

	return (
		<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
			{/* Card 1: Total de Projetos */}
			<div className='bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4'>
				<div className='flex items-center gap-2'>
					<span className='icon-[lucide--folder] size-5 text-blue-600' />
					<div>
						<p className='text-sm font-medium text-zinc-600 dark:text-zinc-400'>Total de Projetos</p>
						<p className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>{stats.total}</p>
					</div>
				</div>
			</div>

			{/* Card 2: Projetos Ativos */}
			<div className='bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4'>
				<div className='flex items-center gap-2'>
					<span className='icon-[lucide--play-circle] size-5 text-green-600' />
					<div>
						<p className='text-sm font-medium text-zinc-600 dark:text-zinc-400'>Projetos Ativos</p>
						<p className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>{stats.active}</p>
					</div>
				</div>
			</div>

			{/* Card 3: Projetos Finalizados */}
			<div className='bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4'>
				<div className='flex items-center gap-2'>
					<span className='icon-[lucide--check-circle] size-5 text-purple-600' />
					<div>
						<p className='text-sm font-medium text-zinc-600 dark:text-zinc-400'>Finalizados</p>
						<p className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>{stats.completed}</p>
					</div>
				</div>
			</div>

			{/* Card 4: Progresso Médio */}
			<div className='bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4'>
				<div className='flex items-center gap-2'>
					<span className='icon-[lucide--trending-up] size-5 text-orange-600' />
					<div>
						<p className='text-sm font-medium text-zinc-600 dark:text-zinc-400'>Progresso Médio</p>
						<p className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>{stats.avgProgress}%</p>
					</div>
				</div>
			</div>
		</div>
	)
}
