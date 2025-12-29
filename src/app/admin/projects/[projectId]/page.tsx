'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { toast } from '@/lib/toast'
import { useParams, useRouter } from 'next/navigation'
import { formatDateBR } from '@/lib/dateUtils'
import { ProjectFormData, ActivityFormData } from '@/types/projects'

import ActivityMiniKanban from '@/components/admin/projects/ActivityMiniKanban'
import ProjectFormOffcanvas from '@/components/admin/projects/ProjectFormOffcanvas'
import ActivityFormOffcanvas from '@/components/admin/projects/ActivityFormOffcanvas'
import ProjectInfoCard from '@/components/admin/projects/ProjectInfoCard'
import ProjectProgressCard from '@/components/admin/projects/ProjectProgressCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

// Interfaces para tipos de dados
interface Project {
	id: string
	name: string
	shortDescription: string
	description: string
	startDate: string | null
	endDate: string | null
	priority: 'low' | 'medium' | 'high' | 'urgent'
	status: 'active' | 'completed' | 'paused' | 'cancelled'
	createdAt: Date
	updatedAt: Date
}

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

interface ActivitySubmissionData {
	name: string
	description: string
	status: 'progress' | 'todo' | 'done' | 'blocked'
	priority: ProjectActivity['priority']
	category: string
	startDate: string
	endDate: string
	days: string
	estimatedHours?: string // Manter compatibilidade com ActivityFormOffcanvas
}

export default function ProjectDetailsPage() {
	const params = useParams()
	const router = useRouter()
	const projectId = params.projectId as string
	const [project, setProject] = useState<Project | null>(null)
	const [activities, setActivities] = useState<ProjectActivity[]>([])
	const [loading, setLoading] = useState(true)
	const [activitiesLoading, setActivitiesLoading] = useState(false)

	// Estados dos offcanvas
	const [projectFormOpen, setProjectFormOpen] = useState(false)
	const [activityFormOpen, setActivityFormOpen] = useState(false)
	const [editingActivity, setEditingActivity] = useState<ProjectActivity | null>(null)

	// Estados para filtros de atividades
	const [search, setSearch] = useState('')
	const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'progress' | 'done' | 'blocked'>('all')

	// Estado para controlar dropdown expandido
	const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null)

	// Estado para contar tarefas do kanban por atividade e calcular progresso
	const [kanbanTaskCounts, setKanbanTaskCounts] = useState<Record<string, number>>({})
	const [kanbanTaskProgress, setKanbanTaskProgress] = useState<Record<string, { total: number; completed: number; percentage: number }>>({})

	// Função para carregar contagem de tarefas do kanban e calcular progresso real
	const loadKanbanTaskCount = async (activityId: string) => {
		if (kanbanTaskCounts[activityId] !== undefined) return // Já carregado

		try {
			console.log('ℹ️ [PAGE_PROJECT_DETAILS] Carregando contagem para atividade:', { activityId })
			console.log('ℹ️ [PAGE_PROJECT_DETAILS] URL:', { url: `/api/admin/projects/${projectId}/activities/${activityId}/tasks` })

			const response = await fetch(`/api/admin/projects/${projectId}/activities/${activityId}/tasks`)
			console.log('ℹ️ [PAGE_PROJECT_DETAILS] Response status:', { status: response.status })

			if (response.ok) {
				const data = await response.json()
				console.log('ℹ️ [PAGE_PROJECT_DETAILS] Response data para atividade:', { activityId, data })

				if (data.success && data.tasks) {
					// A API retorna tasks como objeto agrupado por status: { "todo": [...], "in_progress": [...], "done": [...] }
					let totalTasks = 0
					let completedTasks = 0

					if (typeof data.tasks === 'object' && !Array.isArray(data.tasks)) {
						// Somar tarefas de todos os status e contar as concluídas
						for (const status in data.tasks) {
							if (Array.isArray(data.tasks[status])) {
								totalTasks += data.tasks[status].length
								// Contar tarefas concluídas (status "done")
								if (status === 'done') {
									completedTasks += data.tasks[status].length
								}
							}
						}
					} else if (Array.isArray(data.tasks)) {
						// Fallback se for array direto
						totalTasks = data.tasks.length
						completedTasks = data.tasks.filter((task: { status: string }) => task.status === 'done').length
					}

					// Calcular porcentagem de progresso
					const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0


					console.log('ℹ️ [PAGE_PROJECT_DETAILS] Tasks agrupadas por status:', { statusKeys: Object.keys(data.tasks || {}) })
					console.log('ℹ️ [PAGE_PROJECT_DETAILS] Total de tarefas para atividade:', { activityId, totalTasks })
					console.log('ℹ️ [PAGE_PROJECT_DETAILS] Tarefas concluídas:', { completedTasks })
					console.log('ℹ️ [PAGE_PROJECT_DETAILS] Progresso calculado:', { progressPercentage: progressPercentage + '%' })

					// Atualizar estados
					setKanbanTaskCounts((prev) => ({ ...prev, [activityId]: totalTasks }))
					setKanbanTaskProgress((prev) => ({
						...prev,
						[activityId]: {
							total: totalTasks,
							completed: completedTasks,
							percentage: progressPercentage,
						},
					}))
				} else {
					console.log('ℹ️ [PAGE_PROJECT_DETAILS] API retornou falha ou sem tarefas para atividade:', { activityId })
					setKanbanTaskCounts((prev) => ({ ...prev, [activityId]: 0 }))
					setKanbanTaskProgress((prev) => ({
						...prev,
						[activityId]: { total: 0, completed: 0, percentage: 0 },
					}))
				}
			} else {
				console.error('❌ [PAGE_PROJECT_DETAILS] Response não OK para atividade:', { activityId, status: response.status })
				setKanbanTaskCounts((prev) => ({ ...prev, [activityId]: 0 }))
				setKanbanTaskProgress((prev) => ({
					...prev,
					[activityId]: { total: 0, completed: 0, percentage: 0 },
				}))
			}
		} catch (error) {
			console.error('❌ [PAGE_PROJECT_DETAILS] Erro ao carregar contagem de tarefas:', { activityId, error })
			setKanbanTaskCounts((prev) => ({ ...prev, [activityId]: 0 }))
			setKanbanTaskProgress((prev) => ({
				...prev,
				[activityId]: { total: 0, completed: 0, percentage: 0 },
			}))
		}
	}

	// Carregar projeto e atividades
	useEffect(() => {
		if (projectId) {
			fetchProject()
			fetchActivities()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [projectId])

	// Carregar progresso das tarefas quando as atividades são carregadas
	useEffect(() => {
		if (activities.length > 0) {
			// Carregar progresso de todas as atividades automaticamente
			activities.forEach((activity) => {
				loadKanbanTaskCount(activity.id)
			})
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activities])

	async function fetchProject() {
		if (!projectId) return

		try {
			setLoading(true)

			const response = await fetch(`/api/admin/projects?id=${projectId}`)

			if (!response.ok) {
				console.error('❌ [PAGE_PROJECT_DETAILS] Erro HTTP ao buscar projeto:', { status: response.status })
				toast({
					type: 'error',
					title: 'Projeto não encontrado',
					description: 'O projeto solicitado não existe ou foi removido.',
				})
				router.push('/admin/projects')
				return
			}

			const projects = await response.json()

			// A API retorna um array de projetos filtrados
			const foundProject = projects.find((p: Project) => p.id === projectId)

			if (!foundProject) {
				console.error('❌ [PAGE_PROJECT_DETAILS] Projeto não encontrado no array:', { projectId })
				toast({
					type: 'error',
					title: 'Projeto não encontrado',
					description: 'O projeto solicitado não existe ou foi removido.',
				})
				router.push('/admin/projects')
				return
			}

			setProject(foundProject)
		} catch (error) {
			console.error('❌ [PAGE_PROJECT_DETAILS] Erro ao carregar projeto:', { error })
			toast({
				type: 'error',
				title: 'Erro inesperado',
				description: 'Erro ao carregar detalhes do projeto',
			})
			router.push('/admin/projects')
		} finally {
			setLoading(false)
		}
	}

	async function fetchActivities() {
		if (!projectId) return

		try {
			setActivitiesLoading(true)

			const response = await fetch(`/api/admin/projects/${projectId}/activities`)
			const data = await response.json()

			if (!response.ok || !data.success) {
				console.error('❌ [PAGE_PROJECT_DETAILS] Erro ao carregar atividades:', { error: data.error })
				toast({
					type: 'error',
					title: 'Erro ao carregar atividades',
					description: data.error || 'Erro interno do servidor',
				})
				return
			}

			setActivities(data.activities)
		} catch (error) {
			console.error('❌ [PAGE_PROJECT_DETAILS] Erro ao carregar atividades:', { error })
			toast({
				type: 'error',
				title: 'Erro inesperado',
				description: 'Erro ao carregar atividades do projeto',
			})
		} finally {
			setActivitiesLoading(false)
		}
	}

	// Função para converter status do banco para o formato do componente
	function convertActivityStatus(dbStatus: ProjectActivity['status']): 'progress' | 'todo' | 'done' | 'blocked' {
		switch (dbStatus) {
			case 'todo':
				return 'todo'
			case 'progress':
				return 'progress'
			case 'done':
				return 'done'
			case 'blocked':
				return 'blocked'
			default:
				return 'todo'
		}
	}

	// Filtrar atividades
	const filteredActivities = useMemo(() => {
		let filtered = activities

		// Filtro de busca
		if (search) {
			filtered = filtered.filter((activity) => activity.name.toLowerCase().includes(search.toLowerCase()) || activity.description.toLowerCase().includes(search.toLowerCase()))
		}

		// Filtro de status
		if (statusFilter !== 'all') {
			filtered = filtered.filter((activity) => activity.status === statusFilter)
		}

		// Filtro de prioridade (removido)

		return filtered.sort((a, b) => a.name.localeCompare(b.name))
	}, [activities, search, statusFilter])

	function handleEditActivity(activity: ProjectActivity) {

		// A atividade já está no formato correto ProjectActivity
		setEditingActivity(activity)
		setActivityFormOpen(true)
	}

	// Formatar data
	const formatDate = (dateString: string | null) => {
		if (!dateString) return 'Não definida'
		return formatDateBR(dateString)
	}

	function handleCreateActivity() {
		setEditingActivity(null)
		setActivityFormOpen(true)
	}

	// Função para atualizar projeto
	async function handleProjectSubmit(projectData: ProjectFormData) {
		if (!project) return

		try {

			const response = await fetch(`/api/admin/projects`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					id: project.id,
					...projectData,
				}),
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Erro ao atualizar projeto')
			}

			const updatedProject = await response.json()
			setProject(updatedProject)

			toast({
				type: 'success',
				title: 'Projeto atualizado',
				description: 'As informações do projeto foram atualizadas com sucesso.',
			})
		} catch (error) {
			console.error('❌ [PAGE_PROJECT_DETAILS] Erro ao atualizar projeto:', { error })
			toast({
				type: 'error',
				title: 'Erro ao atualizar projeto',
				description: error instanceof Error ? error.message : 'Erro interno do servidor',
			})
			throw error
		}
	}

	// Função para converter status do componente para o banco
	function convertStatusToDatabase(componentStatus: ActivitySubmissionData['status']): ProjectActivity['status'] {
		switch (componentStatus) {
			case 'todo':
				return 'todo'
			case 'progress':
				return 'progress'
			case 'done':
				return 'done'
			case 'blocked':
				return 'blocked'
			default:
				return 'todo'
		}
	}

	// Função para criar/editar atividade
	async function handleActivitySubmit(activityData: ActivityFormData) {
		if (!project) return

		try {

			const dbStatus = convertStatusToDatabase(activityData.status)

			// Usar 'estimatedDays' do ActivityFormData
			const estimatedDays = activityData.estimatedDays

			const requestData = {
				id: editingActivity?.id,
				name: activityData.name,
				description: activityData.description,
				category: activityData.category || null,
				estimatedDays: estimatedDays,
				startDate: activityData.startDate || null,
				endDate: activityData.endDate || null,
				priority: activityData.priority,
				status: dbStatus,
			}


			if (editingActivity) {
				// Editar atividade existente

				const response = await fetch(`/api/admin/projects/${projectId}/activities`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(requestData),
				})


				let data
				try {
					const responseText = await response.text()
					data = JSON.parse(responseText)
				} catch (parseError) {
					console.error('❌ [PAGE_PROJECT_DETAILS] Erro ao fazer parse da resposta:', { parseError })
					console.error('❌ [PAGE_PROJECT_DETAILS] Resposta não é JSON válido')
					throw new Error('Resposta da API não é JSON válido - possível erro 500 interno')
				}

				if (!response.ok || !data.success) {
					console.error('❌ [PAGE_PROJECT_DETAILS] Erro na resposta da API ao atualizar:', { data })
					throw new Error(data.error || 'Erro ao atualizar atividade')
				}

				// Atualizar lista de atividades
				setActivities((prev) => prev.map((a) => (a.id === editingActivity.id ? data.activity : a)))

				toast({
					type: 'success',
					title: 'Atividade atualizada',
					description: 'A atividade foi atualizada com sucesso.',
				})
			} else {
				// Criar nova atividade

				const response = await fetch(`/api/admin/projects/${projectId}/activities`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(requestData),
				})


				let data
				try {
					const responseText = await response.text()
					data = JSON.parse(responseText)
				} catch (parseError) {
					console.error('❌ [PAGE_PROJECT_DETAILS] Erro ao fazer parse da resposta:', { parseError })
					console.error('❌ [PAGE_PROJECT_DETAILS] Resposta não é JSON válido')
					throw new Error('Resposta da API não é JSON válido - possível erro 500 interno')
				}

				if (!response.ok || !data.success) {
					console.error('❌ [PAGE_PROJECT_DETAILS] Erro na resposta da API ao criar:', { data })
					throw new Error(data.error || 'Erro ao criar atividade')
				}

				// Adicionar à lista de atividades
				setActivities((prev) => [data.activity, ...prev])

				toast({
					type: 'success',
					title: 'Atividade criada',
					description: 'A nova atividade foi criada com sucesso.',
				})
			}

			// Fechar o formulário
			closeActivityForm()
		} catch (error) {
			console.error('❌ [PAGE_PROJECT_DETAILS] Erro ao salvar atividade:', { error })
			toast({
				type: 'error',
				title: 'Erro ao salvar atividade',
				description: error instanceof Error ? error.message : 'Erro interno do servidor',
			})
			throw error
		}
	}

	// Função para excluir atividade
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async function handleActivityDelete(activityId: string) {
		if (!project) return

		try {

			const response = await fetch(`/api/admin/projects/${projectId}/activities?activityId=${activityId}`, {
				method: 'DELETE',
			})

			const data = await response.json()

			if (!response.ok || !data.success) {
				throw new Error(data.error || 'Erro ao excluir atividade')
			}

			// Remover da lista de atividades
			setActivities((prev) => prev.filter((a) => a.id !== activityId))

			toast({
				type: 'success',
				title: 'Atividade excluída',
				description: 'A atividade foi excluída com sucesso.',
			})
		} catch (error) {
			console.error('❌ [PAGE_PROJECT_DETAILS] Erro ao excluir atividade:', { error })
			toast({
				type: 'error',
				title: 'Erro ao excluir atividade',
				description: error instanceof Error ? error.message : 'Erro interno do servidor',
			})
			throw error
		}
	}

	function closeProjectForm() {
		setProjectFormOpen(false)
	}

	function closeActivityForm() {
		setActivityFormOpen(false)
		setEditingActivity(null)
	}

	if (loading) {
		return (
			<div className='h-[calc(100vh-64px)] flex items-center justify-center'>
				<LoadingSpinner 
					text="Carregando atividades do projeto..." 
					size="lg" 
					variant="centered" 
				/>
			</div>
		)
	}

	if (!project) return null

	// Função para controlar dropdown
	const toggleDropdown = (activityId: string) => {
		const isExpanding = expandedActivityId !== activityId
		setExpandedActivityId(isExpanding ? activityId : null)

		// Carregar contagem de tarefas quando expandir
		if (isExpanding) {
			loadKanbanTaskCount(activityId)
		}
	}

	const getPriorityIcon = (priority: ProjectActivity['priority']) => {
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
		return `${priorityIcons[priority]} ${priorityLabels[priority]}`
	}

	// Função para navegar ao Kanban
	const handleGoToKanban = (activityId: string) => {
		const kanbanUrl = `/admin/projects/${projectId}/activities/${activityId}`
		console.log('ℹ️ [PAGE_PROJECT_DETAILS] Navegando para:', { activityId, kanbanUrl })

		router.push(kanbanUrl)
	}

	return (
		<>
			{/* Cabeçalho da Página */}
			<div className='p-6 border-b border-zinc-200 dark:border-zinc-700'>
				<div className='flex items-center justify-between gap-6'>
					{/* Lado Esquerdo - Título e Botão Voltar */}
					<div className='flex items-center gap-4 flex-1'>
						<button onClick={() => router.push('/admin/projects')} className='size-10 rounded-full flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors' title='Voltar aos projetos'>
							<span className='icon-[lucide--arrow-left] size-4 text-zinc-600 dark:text-zinc-400' />
						</button>
						<div>
							<h1 className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>{project.name}</h1>
							{project.shortDescription && <p className='text-zinc-400 dark:text-zinc-600 mt-1 max-w-sm truncate'>{project.shortDescription}</p>}
						</div>
					</div>

					{/* Lado Direito - Informações do Projeto */}
					<ProjectInfoCard project={project} />
				</div>
			</div>

			{/* Conteúdo da Página */}
			<div className='p-6'>
				<div className='max-w-7xl mx-auto space-y-6'>
					{/* Progresso Geral do Projeto */}
					<ProjectProgressCard activities={activities} kanbanTaskProgress={kanbanTaskProgress} />

					{/* Ações e Filtros */}
					<div className='flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center'>
						<div className='flex flex-col sm:flex-row gap-3 flex-1'>
							{/* Busca */}
							<div className='relative flex-1 min-w-120 max-w-lg'>
								<Input type='text' placeholder='Buscar atividades...' value={search} setValue={setSearch} className='pr-10' />
								<span className='icon-[lucide--search] absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 size-4' />
							</div>

							{/* Filtro de Status */}
							<Select
								name='statusFilter'
								selected={statusFilter}
								onChange={(value) => setStatusFilter(value as 'all' | 'todo' | 'progress' | 'done' | 'blocked')}
								options={[
									{ value: 'all', label: 'Todos os status' },
									{ value: 'todo', label: 'Apenas a fazer' },
									{ value: 'progress', label: 'Apenas em progresso' },
									{ value: 'done', label: 'Apenas concluídas' },
									{ value: 'blocked', label: 'Apenas bloqueadas' },
								]}
								placeholder='Filtrar por status'
							/>
						</div>

						{/* Botão Criar */}
						<Button onClick={handleCreateActivity} className='flex items-center gap-2'>
							<span className='icon-[lucide--plus] size-4' />
							Nova atividade
						</Button>
					</div>

					{/* Lista de Atividades */}
					<div className='bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700'>
						<div className='p-6 border-b border-zinc-200 dark:border-zinc-700'>
							<h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-100'>Atividades ({filteredActivities.length})</h2>
							<p className='text-sm text-zinc-600 dark:text-zinc-400 mt-1'>Lista de todas as atividades do projeto {project.name}</p>
						</div>

						{/* Cabeçalho da Tabela */}
						<div className='bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700'>
							<div className='px-6 py-3'>
								<div className='flex items-center justify-between'>
									<div className='text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider'>Atividade</div>
									<div className='text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-right'>Ações</div>
								</div>
							</div>
						</div>

						{activitiesLoading ? (
							<div className='flex items-center justify-center py-12'>
								<LoadingSpinner 
									text="Carregando atividades..." 
									size="md" 
									variant="horizontal" 
								/>
							</div>
						) : filteredActivities.length === 0 ? (
							<div className='text-center py-12'>
								<span className='icon-[lucide--clipboard-x] size-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4 block' />
								<h3 className='text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2'>{search || statusFilter !== 'all' ? 'Nenhuma atividade encontrada' : 'Nenhuma atividade criada ainda'}</h3>
								<p className='text-zinc-600 dark:text-zinc-400 mb-4'>{search || statusFilter !== 'all' ? 'Tente ajustar os filtros para encontrar atividades.' : 'Comece criando sua primeira atividade para organizar as tarefas.'}</p>
								{!search && statusFilter === 'all' && (
									<Button onClick={handleCreateActivity} className='flex items-center gap-2 mx-auto'>
										<span className='icon-[lucide--plus] size-4' />
										Criar primeira atividade
									</Button>
								)}
							</div>
						) : (
							<div className='divide-y divide-zinc-200 dark:divide-zinc-700'>
								{filteredActivities.map((activity) => (
									<div key={activity.id}>
										<div className='flex items-center justify-between'>
											<div className='flex items-center justify-center gap-4 py-6 px-4'>
												{/* Botão Dropdown */}
												<button onClick={() => toggleDropdown(activity.id)} className='size-10 rounded-full flex justify-center items-center hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors' title='Ver detalhes'>
													<span className={`icon-[lucide--chevron-down] size-4 text-zinc-600 dark:text-zinc-400 transition-transform ${expandedActivityId === activity.id ? 'rotate-180' : ''}`} />
												</button>
												{/* Conteúdo principal - título e descrição resumida */}
												<div>
													<h3 className='text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate'>{activity.name}</h3>
													{activity.description && <p className='text-zinc-600 dark:text-zinc-400 truncate text-sm'>{activity.description}</p>}
												</div>
											</div>

											{/* Container: Botões de ação */}
											<div className='px-6 flex items-center justify-center gap-2'>
												{/* Botões de ação - sempre visíveis */}
												<div className='flex items-center justify-center gap-2'>
													<button onClick={() => handleGoToKanban(activity.id)} className='flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors' title='Abrir Kanban'>
														<span className='icon-[lucide--kanban-square] size-4 text-blue-600 dark:text-blue-400' />
														<span className='text-sm font-medium text-blue-600 dark:text-blue-400'>Ver kanban</span>
													</button>
													<button onClick={() => handleEditActivity(activity)} className='size-10 flex items-center justify-center rounded-full hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors' title='Editar atividade'>
														<span className='icon-[lucide--edit] size-4 text-green-600 dark:text-green-400' />
													</button>
												</div>
											</div>
										</div>

										{/* Linha expandida com detalhes */}
										{expandedActivityId === activity.id && (
											<>
												<div className='px-6 py-4 border-t border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 transition-opacity duration-700 ease-in-out animate-in fade-in'>
													<div className='flex flex-wrap items-center gap-6'>
														{/* Status ou Progresso - Exibir apenas um baseado no estado */}
														{kanbanTaskProgress[activity.id] !== undefined ? (
															kanbanTaskProgress[activity.id].percentage === 100 ? (
																/* Status - Quando 100% concluído */
																<div className='flex items-center gap-2'>
																	<span className='icon-[lucide--check-circle] size-4 text-zinc-400' />
																	<span className='text-sm'>✅ Concluído (100%)</span>
																</div>
															) : (
																/* Progresso - Quando em progresso */
																<div className='flex items-center gap-2'>
																	<span className='icon-[lucide--trending-up] size-4 text-zinc-400' />
																	<span className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>Progresso:</span>
																	<div className='flex items-center gap-3'>
																		<div className='w-20 bg-zinc-200 dark:bg-zinc-700 rounded-full h-2'>
																			<div className={`h-2 rounded-full transition-all duration-300 ${kanbanTaskProgress[activity.id].percentage === 100 ? 'bg-green-500' : kanbanTaskProgress[activity.id].percentage > 0 ? 'bg-blue-500' : 'bg-orange-500'}`} style={{ width: `${kanbanTaskProgress[activity.id].percentage}%` }} />
																		</div>
																		<span className='text-sm font-semibold text-zinc-800 dark:text-zinc-200'>{kanbanTaskProgress[activity.id].percentage}%</span>
																		<span className='text-xs text-zinc-500 dark:text-zinc-400'>
																			({kanbanTaskProgress[activity.id].completed}/{kanbanTaskProgress[activity.id].total})
																		</span>
																	</div>
																</div>
															)
															) : (
																/* Estado de carregamento */
																<LoadingSpinner 
																	text="Calculando progresso..." 
																	size="xs" 
																	variant="horizontal" 
																/>
															)}

														{/* Prioridade */}
														<div className='flex items-center gap-2'>
															<span className='icon-[lucide--triangle-alert] size-4 text-zinc-400' />
															<span className='text-sm'>{getPriorityIcon(activity.priority)}</span>
														</div>

														{/* Período */}
														<div className='flex items-center gap-2'>
															<span className='icon-[lucide--calendar] size-4 text-zinc-400' />
															<div className='flex items-center gap-2 text-sm bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-md'>
																{activity.startDate && <span className='text-zinc-700 dark:text-zinc-300 font-medium'>{formatDate(activity.startDate)}</span>}
																{activity.startDate && activity.endDate && <span className='text-zinc-400'>→</span>}
																{activity.endDate && <span className='text-zinc-700 dark:text-zinc-300 font-medium'>{formatDate(activity.endDate)}</span>}
																{!activity.startDate && !activity.endDate && <span className='text-zinc-400'>Não definido</span>}
															</div>
														</div>

														{/* Kanban */}
														<div className='flex items-center gap-2'>
															<span className='icon-[lucide--kanban-square] size-4 text-zinc-400' />
															{kanbanTaskCounts[activity.id] !== undefined ? (
																<div className='flex items-center gap-2'>
																	<div className='flex items-center gap-2 text-sm bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-md'>
																		<span className='text-zinc-700 dark:text-zinc-300 font-medium'>
																			{kanbanTaskCounts[activity.id]} tarefa{kanbanTaskCounts[activity.id] !== 1 ? 's' : ''}
																		</span>
																	</div>
																</div>
															) : (
																<div className='flex items-center gap-2 text-sm bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-md'>
																	<LoadingSpinner 
																		text="Carregando..." 
																		size="xs" 
																		variant="horizontal" 
																	/>
																</div>
															)}
														</div>
													</div>
												</div>

												{/* Mini Kanban */}
												<ActivityMiniKanban activityId={activity.id} projectId={projectId} />
											</>
										)}
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Offcanvas para editar projeto */}
			{project && (
				<ProjectFormOffcanvas
					isOpen={projectFormOpen}
					onClose={closeProjectForm}
					project={{
						id: project.id,
						name: project.name,
						shortDescription: project.shortDescription,
						description: project.description,
						status: project.status,
						priority: project.priority,
						startDate: project.startDate,
						endDate: project.endDate,
						createdAt: project.createdAt,
						updatedAt: project.updatedAt,
					}}
					onSubmit={handleProjectSubmit}
				/>
			)}

			{/* Offcanvas para criar/editar atividade */}
			{project && (
				<ActivityFormOffcanvas
					isOpen={activityFormOpen}
					onClose={closeActivityForm}
					activity={
						editingActivity
							? {
									id: editingActivity.id,
									projectId: editingActivity.projectId,
									name: editingActivity.name,
									description: editingActivity.description,
									category: editingActivity.category || '',
									status: convertActivityStatus(editingActivity.status),
									priority: editingActivity.priority,
									estimatedDays: editingActivity.estimatedDays,
									startDate: editingActivity.startDate || '',
									endDate: editingActivity.endDate || '',
									createdAt: editingActivity.createdAt,
									updatedAt: editingActivity.updatedAt,
								}
							: null
					}
					project={{
						id: project.id,
						name: project.name,
						shortDescription: project.shortDescription,
						description: project.description,
						status: project.status,
						priority: project.priority,
						startDate: project.startDate,
						endDate: project.endDate,
						createdAt: project.createdAt,
						updatedAt: project.updatedAt,
					}}
					onSubmit={handleActivitySubmit}
				/>
			)}
		</>
	)
}
