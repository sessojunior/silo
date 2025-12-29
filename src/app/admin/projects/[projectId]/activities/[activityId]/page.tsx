'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { toast } from '@/lib/toast'
import { notFound, useParams, useRouter } from 'next/navigation'
import { getToday, formatDateBR } from '@/lib/dateUtils'
import KanbanBoard from '@/components/admin/projects/KanbanBoard'
import TaskFormOffcanvas from '@/components/admin/projects/TaskFormOffcanvas'
import TaskHistoryModal from '@/components/admin/projects/TaskHistoryModal'
import { ProjectTask } from '@/lib/db/schema'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

// Interface estendida para ProjectTask com campos da API
interface ProjectTaskWithUsers extends ProjectTask {
	assignedUsers?: string[]
	assignedUsersDetails?: { id: string; name: string; role: string; email: string; image: string | null }[]
}

// Interface Task do KanbanBoard
interface KanbanTask {
	id: string
	project_id: string
	project_activity_id: string
	name: string
	description: string
	category: string
	estimated_days: number
	status: 'todo' | 'in_progress' | 'blocked' | 'review' | 'done'
	sort: number
	start_date: string
	end_date: string
	priority: 'low' | 'medium' | 'high' | 'urgent'
	assignedUsers?: string[] // 🆕 Campo para usuários associados
	assignedUsersDetails?: { id: string; name: string; role: string; email: string; image: string | null }[] // 🆕 Campo para detalhes dos usuários
}

// Função para converter ProjectTask para KanbanTask
const convertToKanbanTask = (projectTask: ProjectTaskWithUsers): KanbanTask => {
	return {
		id: projectTask.id,
		project_id: projectTask.projectId,
		project_activity_id: projectTask.projectActivityId,
		name: projectTask.name,
		description: projectTask.description || '',
		category: projectTask.category || 'Geral',
		estimated_days: projectTask.estimatedDays || 1,
		status: projectTask.status as KanbanTask['status'],
		sort: projectTask.sort,
		start_date: projectTask.startDate || getToday(),
		end_date: projectTask.endDate || getToday(),
		priority: projectTask.priority as KanbanTask['priority'],
		assignedUsers: projectTask.assignedUsers || [], // Preservar usuários associados
		assignedUsersDetails: projectTask.assignedUsersDetails || [], // Preservar detalhes dos usuários
	}
}

interface Project {
	id: string
	name: string
}

interface Activity {
	id: string
	name: string
	description?: string
	startDate?: string | null
	endDate?: string | null
	priority?: 'low' | 'medium' | 'high' | 'urgent'
	status?: 'todo' | 'progress' | 'done' | 'blocked'
}

export default function TaskKanbanPage() {
	const params = useParams()
	const router = useRouter()
	const projectId = params.projectId as string
	const activityId = params.activityId as string

	// Estados principais
	const [project, setProject] = useState<Project | null>(null)
	const [activity, setActivity] = useState<Activity | null>(null)
	const [tasks, setTasks] = useState<ProjectTaskWithUsers[]>([]) // eslint-disable-line @typescript-eslint/no-unused-vars
	const [kanbanTasks, setKanbanTasks] = useState<KanbanTask[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [isDragBlocked, setIsDragBlocked] = useState(false)

	// Estados do TaskFormOffcanvas
	const [taskFormOpen, setTaskFormOpen] = useState(false)
	const [taskToEdit, setTaskToEdit] = useState<KanbanTask | null>(null)
	const [initialTaskStatus, setInitialTaskStatus] = useState<KanbanTask['status']>('todo')

	// Estados do TaskHistoryModal
	const [historyModalOpen, setHistoryModalOpen] = useState(false)
	const [taskForHistory, setTaskForHistory] = useState<KanbanTask | null>(null)

	// Função para carregar dados do projeto
	const fetchProject = useCallback(async () => {
		try {
			const response = await fetch(`/api/admin/projects?projectId=${projectId}`)
			if (!response.ok) {
				throw new Error('Projeto não encontrado')
			}

			const projectsData = await response.json()
			const projectData = projectsData.find((p: Project) => p.id === projectId)

			if (!projectData) {
				throw new Error('Projeto não encontrado nos dados')
			}

			setProject(projectData)
			return projectData
		} catch (error) {
			console.error('❌ [PAGE_PROJECT_ACTIVITY] Erro ao carregar projeto:', { error })
			throw error
		}
	}, [projectId])

	// Função para carregar dados da atividade
	const fetchActivity = useCallback(async () => {
		try {
			const response = await fetch(`/api/admin/projects/${projectId}/activities`)
			if (!response.ok) {
				throw new Error('Erro ao carregar atividades')
			}

			const result = await response.json()
			if (!result.success) {
				throw new Error(result.error || 'Erro ao carregar atividades')
			}

			const foundActivity = result.activities.find((a: Activity) => a.id === activityId)
			if (!foundActivity) {
				throw new Error('Atividade não encontrada')
			}

			setActivity(foundActivity)
			return foundActivity
		} catch (error) {
			console.error('❌ [PAGE_PROJECT_ACTIVITY] Erro ao carregar atividade:', { error })
			throw error
		}
	}, [projectId, activityId])

	// Função para carregar tarefas
	const fetchTasks = useCallback(async () => {
		try {
			const response = await fetch(`/api/admin/projects/${projectId}/activities/${activityId}/tasks`)
			if (!response.ok) {
				throw new Error(`Erro HTTP ${response.status}`)
			}

			const result = await response.json()
			if (!result.success) {
				throw new Error(result.error || 'Erro ao carregar tarefas')
			}

			// Converter tasksByStatus para array simples
			const allTasks: ProjectTaskWithUsers[] = []
			Object.entries(result.tasks).forEach(([, tasksInStatus]) => {
				;(tasksInStatus as ProjectTaskWithUsers[]).forEach((task) => {
					allTasks.push(task)
				})
			})

			setTasks(allTasks)

			// Converter para formato do Kanban
			const convertedTasks = allTasks.map(convertToKanbanTask)
			setKanbanTasks(convertedTasks)

			return allTasks
		} catch (error) {
			console.error('❌ [PAGE_PROJECT_ACTIVITY] Erro ao carregar tarefas:', { error })
			throw error
		}
	}, [projectId, activityId])

	// Função para carregar todos os dados
	const loadAllData = useCallback(async () => {
		try {
			setLoading(true)
			setError(null)

			await Promise.all([fetchProject(), fetchActivity(), fetchTasks()])
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
			setError(errorMessage)

			if (errorMessage.includes('não encontrado')) {
				notFound()
			} else {
				toast({
					type: 'error',
					title: '❌ Erro ao carregar dados',
					description: errorMessage,
				})
			}
		} finally {
			setLoading(false)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fetchProject, fetchActivity])

	// Função para abrir formulário de criação de tarefa
	const handleCreateTask = useCallback((status: KanbanTask['status']) => {
		setTaskToEdit(null)
		setInitialTaskStatus(status)
		setTaskFormOpen(true)
	}, [])

	// Função para abrir formulário de edição de tarefa
	const handleEditTask = useCallback((task: KanbanTask) => {
		setTaskToEdit(task)
		setInitialTaskStatus(task.status)
		setTaskFormOpen(true)
	}, [])

	// Função para abrir modal de histórico da tarefa
	const handleViewHistory = useCallback((task: KanbanTask) => {
		setTaskForHistory(task)
		setHistoryModalOpen(true)
	}, [])

	// Função para processar envio do formulário de tarefa
	const handleTaskSubmit = useCallback(
		async (formData: { name: string; description: string; category: string; estimatedDays: number; startDate: string; endDate: string; priority: string; status: string; assignedUsers: string[] }) => {
			try {
				const taskData = {
					...formData,
					projectId: projectId,
					projectActivityId: activityId,
				}

				const url = taskToEdit ? `/api/admin/projects/${projectId}/activities/${activityId}/tasks` : `/api/admin/projects/${projectId}/activities/${activityId}/tasks`

				const method = taskToEdit ? 'PUT' : 'POST'

				const payload = taskToEdit ? { ...taskData, id: taskToEdit.id } : taskData



				const response = await fetch(url, {
					method,
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				})

				if (!response.ok) {
					throw new Error(`Erro HTTP ${response.status}`)
				}

				const result = await response.json()
				if (!result.success) {
					throw new Error(result.error || 'Erro desconhecido')
				}

				// 🆕 SALVAR ASSOCIAÇÕES DE USUÁRIOS
				if (formData.assignedUsers && formData.assignedUsers.length > 0) {

					const taskId = taskToEdit ? taskToEdit.id : result.task?.id

					if (taskId) {
						const usersResponse = await fetch(`/api/admin/tasks/${taskId}/users`, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								userIds: formData.assignedUsers,
								role: 'assignee',
							}),
						})

						if (!usersResponse.ok) {
							console.error('❌ [PAGE_PROJECT_ACTIVITY] Erro ao salvar usuários associados:', { status: usersResponse.status })
						}
					} else {
						console.error('❌ [PAGE_PROJECT_ACTIVITY] ID da tarefa não encontrado para salvar usuários')
					}
				}

				// Recarregar as tarefas
				await fetchTasks()
			} catch (error) {
				console.error('❌ [PAGE_PROJECT_ACTIVITY] Erro ao salvar tarefa:', { error })
				throw error
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[projectId, activityId, taskToEdit],
	)

	// Função para deletar tarefa
	const handleTaskDelete = useCallback(
		async (task: KanbanTask) => {
			try {
				const response = await fetch(`/api/admin/projects/${projectId}/activities/${activityId}/tasks`, {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id: task.id }),
				})

				if (!response.ok) {
					throw new Error(`Erro HTTP ${response.status}`)
				}

				const result = await response.json()
				if (!result.success) {
					throw new Error(result.error || 'Erro desconhecido')
				}

				toast({
					type: 'success',
					title: '✅ Tarefa excluída',
					description: `${task.name} foi excluída com sucesso`,
				})

				// Recarregar as tarefas
				await fetchTasks()
			} catch (error) {
				console.error('❌ [PAGE_PROJECT_ACTIVITY] Erro ao excluir tarefa:', { error })
				toast({
					type: 'error',
					title: '❌ Erro ao excluir',
					description: 'Não foi possível excluir a tarefa. Tente novamente.',
				})
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[projectId, activityId],
	)

	// Função para persistir a movimentação no backend
	const handleTasksReorder = useCallback(
		async (tasksBeforeMove: KanbanTask[], tasksAfterMove: KanbanTask[]) => {
			// 🚫 BLOQUEAR DRAG COMPLETAMENTE durante operação
			setIsDragBlocked(true)
			try {
				const payload = {
					tasksBeforeMove: tasksBeforeMove.map((t) => ({ taskId: t.id, status: t.status, sort: t.sort })),
					tasksAfterMove: tasksAfterMove.map((t) => ({ taskId: t.id, status: t.status, sort: t.sort })),
				}

				const response = await fetch(`/api/admin/projects/${projectId}/activities/${activityId}/tasks`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				})

				const result = await response.json()

				if (!response.ok && result.error === 'KANBAN_OUTDATED') {
					toast({
						type: 'warning',
						title: '⚠️ Kanban desatualizado',
						description: 'O Kanban foi atualizado por outro usuário ou aba. Recarregando...',
					})
					if (Array.isArray(result.tasks)) {
						const updatedTasks = result.tasks.map(convertToKanbanTask)
						setKanbanTasks(updatedTasks)
					}
					// ✅ DESBLOQUEAR ANTES DO RETURN (caso 409)
					setIsDragBlocked(false)
					return
				}

				if (result.success && Array.isArray(result.tasks)) {
					// SEMPRE sincronizar com backend (fonte de verdade)
					const backendTasks = result.tasks.map(convertToKanbanTask)
					setKanbanTasks(backendTasks)
				}

				// Sucesso
				toast({
					type: 'success',
					title: '✅ Kanban salvo',
					description: 'Movimentação salva com sucesso!',
				})
			} catch (error) {
				console.error('❌ [PAGE_PROJECT_ACTIVITY] Erro ao persistir Kanban:', { error })
				toast({
					type: 'error',
					title: '❌ Erro ao salvar Kanban',
					description: 'Erro inesperado ao salvar Kanban',
				})
				// Rollback visual
				setKanbanTasks(tasksBeforeMove)
			} finally {
				// ✅ SEMPRE DESBLOQUEAR DRAG (sucesso ou erro)
				setIsDragBlocked(false)
			}
		},
		[projectId, activityId],
	)

	// Carregar dados ao montar o componente
	useEffect(() => {
		loadAllData()
	}, [loadAllData])

	// Estados de loading e erro
	if (loading) {
		return (
			<div className='h-[calc(100vh-64px)] flex items-center justify-center'>
				<LoadingSpinner 
					text="Carregando tarefas no kanban..." 
					size="lg" 
					variant="centered" 
				/>
			</div>
		)
	}

	if (error) {
		return (
			<div className='flex items-center justify-center min-h-screen'>
				<div className='text-center'>
					<div className='text-red-500 mb-4'>
						<span className='icon-[lucide--alert-circle] size-12 mx-auto block' />
					</div>
					<h3 className='text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2'>Erro ao carregar dados</h3>
					<p className='text-zinc-600 dark:text-zinc-400 mb-4'>{error}</p>
					<button onClick={loadAllData} className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'>
						Tentar novamente
					</button>
				</div>
			</div>
		)
	}

	if (!activity || !project) {
		return (
			<div className='h-[calc(100vh-64px)] flex items-center justify-center'>
				<div className='text-center'>
					<p className='text-zinc-600 dark:text-zinc-400'>Dados não encontrados</p>
				</div>
			</div>
		)
	}

	// Função para voltar à página do projeto
	const handleGoBack = () => {
		router.push(`/admin/projects/${projectId}`)
	}

	// Função para obter ícone de prioridade
	const getPriorityIcon = (priority: Activity['priority']) => {
		const priorityIcons = {
			low: '⬇️',
			medium: '➡️',
			high: '⬆️',
			urgent: '🚨',
		}
		const priorityLabels = {
			low: 'Baixa',
			medium: 'Média',
			high: 'Alta',
			urgent: 'Urgente',
		}
		return `${priorityIcons[priority || 'medium']} ${priorityLabels[priority || 'medium']}`
	}

	// Função para formatar data
	const formatDate = (dateString: string | null | undefined) => {
		if (!dateString) return 'Não definida'
		return formatDateBR(dateString)
	}

	return (
		<div className='relative w-full h-[calc(100vh-64px)] flex flex-col overflow-x-auto overflow-y-auto'>
			{/* Cabeçalho */}
			<div className='w-full p-6 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 sticky top-0 left-0 z-10'>
				<div className='flex items-center justify-between gap-6'>
					{/* Lado Esquerdo - Título e Botão Voltar */}
					<div className='flex items-center gap-4 flex-1'>
						<button onClick={handleGoBack} className='size-10 rounded-full flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors' title='Voltar ao projeto'>
							<span className='icon-[lucide--arrow-left] size-4 text-zinc-600 dark:text-zinc-400' />
						</button>
						<div className='flex-1'>
							<h1 className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>{activity.name}</h1>
							<div className='flex items-center gap-2 mt-1'>
								<span className='icon-[lucide--square-chart-gantt] size-3 text-blue-500' />
								<p className='text-sm text-blue-500'>{project.name}</p>
								{activity.description && (
									<>
										<span className='text-zinc-400 dark:text-zinc-600'> • </span>
										<p className='text-sm text-zinc-400 dark:text-zinc-600 max-w-sm truncate'>{activity.description}</p>
									</>
								)}
							</div>
						</div>
					</div>

					{/* Lado Direito - Informações da Atividade */}
					<div className='flex gap-4'>
						{/* Prioridade */}
						<div className='bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-3 min-w-[140px]'>
							<div className='flex items-center gap-3'>
								<div className={`w-3 h-3 rounded-full ${activity.priority === 'urgent' ? 'bg-red-500' : activity.priority === 'high' ? 'bg-orange-500' : activity.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
								<div>
									<p className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>Prioridade</p>
									<p className='text-sm text-zinc-600 dark:text-zinc-400'>{getPriorityIcon(activity.priority)}</p>
								</div>
							</div>
						</div>

						{/* Data de Início */}
						<div className='bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-3 min-w-[140px]'>
							<div className='flex items-center gap-3'>
								<span className='icon-[lucide--calendar-days] size-4 text-zinc-400' />
								<div>
									<p className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>Data de Início</p>
									<p className='text-sm text-zinc-600 dark:text-zinc-400'>{formatDate(activity.startDate)}</p>
								</div>
							</div>
						</div>

						{/* Data de Fim */}
						<div className='bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-3 min-w-[140px]'>
							<div className='flex items-center gap-3'>
								<span className='icon-[lucide--calendar-check] size-4 text-zinc-400' />
								<div>
									<p className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>Data de Fim</p>
									<p className='text-sm text-zinc-600 dark:text-zinc-400'>{formatDate(activity.endDate)}</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Conteúdo */}
			<div className='flex-1 bg-zinc-50 dark:bg-zinc-900'>
				<KanbanBoard tasks={kanbanTasks} onTasksReorder={handleTasksReorder} isDragBlocked={isDragBlocked} onCreateTask={handleCreateTask} onEditTask={handleEditTask} onViewHistory={handleViewHistory} />
			</div>

			{/* TaskFormOffcanvas */}
			<TaskFormOffcanvas
				isOpen={taskFormOpen}
				onClose={() => {
					setTaskFormOpen(false)
					setTaskToEdit(null)
				}}
				task={taskToEdit}
				initialStatus={initialTaskStatus}
				onSubmit={handleTaskSubmit}
				onDelete={handleTaskDelete}
			/>

			{/* TaskHistoryModal */}
			{taskForHistory && (
				<TaskHistoryModal
					isOpen={historyModalOpen}
					onClose={() => {
						setHistoryModalOpen(false)
						setTaskForHistory(null)
					}}
					taskId={taskForHistory.id}
					taskName={taskForHistory.name}
				/>
			)}
		</div>
	)
}
