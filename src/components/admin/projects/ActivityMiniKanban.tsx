'use client'

import React, { useState, useEffect, useCallback } from 'react'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { ProjectTask } from '@/types/projects'

interface ActivityMiniKanbanProps {
	activityId: string
	projectId: string
}

export default function ActivityMiniKanban({ activityId, projectId }: ActivityMiniKanbanProps) {
	const [tasks, setTasks] = useState<ProjectTask[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const loadKanbanTasks = useCallback(async () => {
		try {
			setLoading(true)
			setError(null)
			const response = await fetch(`/api/admin/projects/${projectId}/activities/${activityId}/tasks`)

			if (response.ok) {
				const tasksData = await response.json()

				if (tasksData.success && tasksData.tasks) {

					// A API retorna tasks agrupadas por status, precisamos converter para array
					const allTasks: ProjectTask[] = []
					Object.values(tasksData.tasks).forEach((statusTasks: unknown) => {
						if (Array.isArray(statusTasks)) {
							allTasks.push(...(statusTasks as ProjectTask[]))
						}
					})

					setTasks(allTasks)
				} else {
					setError('Erro ao carregar dados do servidor')
				}
			} else {
				setError(`Erro HTTP ${response.status}: ${response.statusText}`)
			}
		} catch (error) {
			console.error('❌ [COMPONENT_ACTIVITY_MINI_KANBAN] Erro ao carregar tarefas do mini-kanban:', { error })
			if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
				setError('Erro de conexão. Verifique sua internet e tente novamente.')
			} else {
				setError('Erro inesperado ao carregar tarefas')
			}
		} finally {
			setLoading(false)
		}
	}, [projectId, activityId])

	// Carregar tarefas do Kanban da atividade
	useEffect(() => {
		if (activityId && projectId) {
			loadKanbanTasks()
		}
	}, [activityId, projectId, loadKanbanTasks])

	// Agrupar tarefas por status (garantir que tasks é um array)
	const tasksByStatus = (Array.isArray(tasks) ? tasks : []).reduce(
		(acc, task) => {
			if (!acc[task.status]) {
				acc[task.status] = []
			}
			acc[task.status].push(task)
			return acc
		},
		{} as Record<string, ProjectTask[]>,
	)

	// Definir colunas simplificadas para o mini-kanban (cores consistentes com KanbanBoard)
	const columns = [
		{ id: 'todo', title: 'A Fazer', color: 'bg-stone-100 dark:bg-stone-800', tasks: tasksByStatus.todo || [] },
		{ id: 'in_progress', title: 'Progresso', color: 'bg-blue-100 dark:bg-blue-900', tasks: tasksByStatus.in_progress || [] },
		{ id: 'blocked', title: 'Bloqueado', color: 'bg-red-100 dark:bg-red-900', tasks: tasksByStatus.blocked || [] },
		{ id: 'review', title: 'Revisão', color: 'bg-amber-100 dark:bg-amber-900', tasks: tasksByStatus.review || [] },
		{ id: 'done', title: 'Concluído', color: 'bg-emerald-100 dark:bg-emerald-900', tasks: tasksByStatus.done || [] },
	]

	const getPriorityColor = (priority: ProjectTask['priority']) => {
		switch (priority) {
			case 'urgent':
				return 'border-l-red-500'
			case 'high':
				return 'border-l-orange-500'
			case 'medium':
				return 'border-l-yellow-500'
			case 'low':
				return 'border-l-green-500'
			default:
				return 'border-l-gray-300'
		}
	}

	if (loading) {
		return (
			<div className='px-6 py-4'>
				<div className='flex items-center justify-center py-8'>
					<LoadingSpinner 
						text="Carregando tarefas..." 
						size="sm" 
						variant="horizontal" 
					/>
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className='px-6 py-4'>
				<div className='text-center py-8'>
					<span className='icon-[lucide--alert-circle] size-8 text-red-400 mx-auto mb-2 block' />
					<p className='text-sm text-red-600 dark:text-red-400 font-medium'>Erro ao carregar tarefas</p>
					<p className='text-xs text-red-500 dark:text-red-500 mt-1'>{error}</p>
					<button onClick={loadKanbanTasks} className='mt-3 px-3 py-1 text-xs bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors'>
						Tentar novamente
					</button>
				</div>
			</div>
		)
	}

	if (tasks.length === 0) {
		return (
			<div className='px-6 py-4'>
				<div className='text-center py-8'>
					<span className='icon-[lucide--kanban-square] size-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2 block' />
					<p className='text-sm text-zinc-500 dark:text-zinc-400'>Esta atividade ainda não possui tarefas</p>
				</div>
			</div>
		)
	}

	return (
		<div className='p-6'>
			<div className='grid grid-cols-5 gap-2 text-sm'>
				{columns.map((column) => (
					<div key={column.id} className='space-y-1'>
						{/* Header da coluna */}
						<div className={`${column.color} rounded-t-md p-2 border border-zinc-200 dark:border-zinc-600`}>
							<div className='font-medium text-zinc-700 dark:text-zinc-300 text-center'>
								{column.title} ({column.tasks.length})
							</div>
						</div>

						{/* Tasks da coluna */}
						<div className='flex flex-col h-full space-y-1 flex-1 overflow-y-auto'>
							{column.tasks.map((task) => (
								<div key={task.id} className={`bg-white dark:bg-zinc-900 rounded border-l-2 ${getPriorityColor(task.priority)} p-2 shadow-sm hover:shadow-md transition-shadow`} title={`${task.name} - ${task.description || 'Sem descrição'}`}>
									<div className='font-medium text-zinc-800 dark:text-zinc-200 truncate text-xs leading-tight'>{task.name}</div>
									{task.category && <div className='text-xs text-zinc-500 dark:text-zinc-400 truncate mt-1'>{task.category}</div>}
								</div>
							))}

							{/* Zona vazia */}
							{column.tasks.length === 0 && <div className='bg-zinc-100 dark:bg-zinc-700 rounded border-2 border-dashed border-zinc-300 dark:border-zinc-600 p-2 text-center text-zinc-400 dark:text-zinc-500'>Vazio</div>}
						</div>
					</div>
				))}
			</div>
		</div>
	)
}
