'use client'

import React from 'react'

interface ProjectActivity {
	id: string
	projectId: string
	name: string
	description: string
	category: string | null
	estimatedDays: number | null
	startDate: string | null
	endDate: string | null
	priority: 'low' | 'medium' | 'high' | 'urgent'
	status: 'todo' | 'progress' | 'done' | 'blocked'
	createdAt: Date
	updatedAt: Date
}

interface KanbanTaskProgress {
	total: number
	completed: number
	percentage: number
}

interface ProjectProgressCardProps {
	activities: ProjectActivity[]
	kanbanTaskProgress: Record<string, KanbanTaskProgress>
}

export default function ProjectProgressCard({ activities, kanbanTaskProgress }: ProjectProgressCardProps) {
	// Calcular progresso baseado nas tarefas reais do Kanban
	let totalTasks = 0
	let completedTasks = 0

	activities.forEach((activity) => {
		const progress = kanbanTaskProgress[activity.id]
		if (progress) {
			totalTasks += progress.total
			completedTasks += progress.completed
		}
	})

	const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

	return (
		<div className='bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4'>
			<div className='flex items-center justify-between mb-2'>
				<h3 className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>Progresso Geral</h3>
				<span className='text-sm text-zinc-600 dark:text-zinc-400'>{totalTasks > 0 ? `${completedTasks}/${totalTasks} tarefas concluídas` : 'Nenhuma tarefa criada'}</span>
			</div>
			<div className='w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2'>
				<div
					className='bg-blue-500 h-2 rounded-full transition-all duration-300'
					style={{
						width: `${progressPercentage}%`,
					}}
				/>
			</div>
			<p className='text-xs text-zinc-500 dark:text-zinc-400 mt-1'>{totalTasks > 0 ? `${progressPercentage}% concluído` : '0% concluído'}</p>
		</div>
	)
}
