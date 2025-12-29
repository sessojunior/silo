'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'
import { formatDateBR } from '@/lib/dateUtils'
import { ProjectFormData } from '@/types/projects'
import ReactMarkdown from 'react-markdown'
import { getMarkdownClasses } from '@/lib/markdown'

import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Offcanvas from '@/components/ui/Offcanvas'
import ProjectStatsCards from '@/components/admin/projects/ProjectStatsCards'
import ProjectFormOffcanvas from '@/components/admin/projects/ProjectFormOffcanvas'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ProjectDeleteDialog from '@/components/admin/projects/ProjectDeleteDialog'

import { Project } from '@/types/projects'

// Tipo para dados do banco de dados
interface ProjectDB {
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

export default function ProjectsPage() {
	const router = useRouter()
	const [projects, setProjects] = useState<Project[]>([])
	const [filteredProjects, setFilteredProjects] = useState<Project[]>([])
	const [loading, setLoading] = useState(true)
	const [search, setSearch] = useState('')
	const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'paused' | 'cancelled'>('all')

	// Estados para formulários e dialogs
	const [formOpen, setFormOpen] = useState(false)
	const [editingProject, setEditingProject] = useState<Project | null>(null)
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
	const [viewDescriptionProject, setViewDescriptionProject] = useState<Project | null>(null)

	// Estado para controlar qual projeto tem dropdown expandido
	const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null)

	// Função para carregar projetos
	const fetchProjects = useCallback(async () => {
		try {
			setLoading(true)

			const response = await fetch('/api/admin/projects')

			if (!response.ok) {
				throw new Error(`Erro HTTP: ${response.status}`)
			}

			const projectsData: ProjectDB[] = await response.json()

			// Converter dados do banco para formato da interface
			const formattedProjects: Project[] = await Promise.all(
				projectsData.map(async (project) => {
					return {
						id: project.id,
						name: project.name,
						shortDescription: project.shortDescription,
						description: project.description,
						status: project.status,
						priority: project.priority,
						startDate: project.startDate,
						endDate: project.endDate,
						// Campos padrão para compatibilidade com interface existente
						createdAt: new Date(project.createdAt),
						updatedAt: new Date(project.updatedAt),
					}
				})
			)

			setProjects(formattedProjects)
		} catch (error) {
			console.error('❌ [PAGE_PROJECTS] Erro ao carregar projetos:', { error })
			toast({
				type: 'error',
				title: 'Erro ao carregar projetos',
				description: 'Não foi possível carregar os projetos. Tente novamente.',
			})
		} finally {
			setLoading(false)
		}
	}, [])

	// Carregar projetos
	useEffect(() => {
		fetchProjects()
	}, [fetchProjects])

	// Filtrar projetos
	useEffect(() => {
		let filtered = projects

		// Filtro de busca
		if (search) {
			filtered = filtered.filter((project) => project.name.toLowerCase().includes(search.toLowerCase()) || project.description.toLowerCase().includes(search.toLowerCase()))
		}

		// Filtro de status
		if (statusFilter !== 'all') {
			filtered = filtered.filter((project) => project.status === statusFilter)
		}

		setFilteredProjects(filtered)
	}, [projects, search, statusFilter])


	function openCreateForm() {
		setEditingProject(null)
		setFormOpen(true)
	}

	function openEditForm(project: Project, event: React.MouseEvent) {
		event.stopPropagation() // Evitar abrir página de detalhes
		setEditingProject(project)
		setFormOpen(true)
	}

	function openDeleteDialog(project: Project) {
		setProjectToDelete(project)
		setDeleteDialogOpen(true)
	}

	function openViewDescription(project: Project, event: React.MouseEvent) {
		event.stopPropagation()
		setViewDescriptionProject(project)
	}

	function closeForm() {
		setFormOpen(false)
		setEditingProject(null)
	}

	function closeDeleteDialog() {
		setDeleteDialogOpen(false)
		setProjectToDelete(null)
	}

	function handleProjectClick(projectId: string) {
		router.push(`/admin/projects/${projectId}`)
	}

	// Funções CRUD para projetos
	async function handleProjectSubmit(projectData: ProjectFormData) {
		try {
			if (editingProject) {
				// Editar projeto existente

				const response = await fetch('/api/admin/projects', {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						id: editingProject.id,
						...projectData,
					}),
				})

				if (!response.ok) {
					throw new Error(`Erro HTTP: ${response.status}`)
				}

				const updatedProjectData: ProjectDB = await response.json()

				const updatedProject: Project = {
					...editingProject,
					name: updatedProjectData.name,
					shortDescription: updatedProjectData.shortDescription,
					description: updatedProjectData.description,
					status: updatedProjectData.status,
					priority: updatedProjectData.priority,
					startDate: updatedProjectData.startDate,
					endDate: updatedProjectData.endDate,
					updatedAt: new Date(updatedProjectData.updatedAt),
				}

				setProjects((prev) => prev.map((p) => (p.id === editingProject.id ? updatedProject : p)))

				toast({
					type: 'success',
					title: 'Projeto atualizado',
					description: 'O projeto foi atualizado com sucesso.',
				})
			} else {
				// Criar novo projeto

				const response = await fetch('/api/admin/projects', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(projectData),
				})

				if (!response.ok) {
					throw new Error(`Erro HTTP: ${response.status}`)
				}

				const newProjectData: ProjectDB = await response.json()

				const newProject: Project = {
					id: newProjectData.id,
					name: newProjectData.name,
					shortDescription: newProjectData.shortDescription,
					description: newProjectData.description,
					status: newProjectData.status,
					priority: newProjectData.priority,
					startDate: newProjectData.startDate,
					endDate: newProjectData.endDate,
					createdAt: new Date(newProjectData.createdAt),
					updatedAt: new Date(newProjectData.updatedAt),
				}

				setProjects((prev) => [newProject, ...prev])

				toast({
					type: 'success',
					title: 'Projeto criado',
					description: 'O projeto foi criado com sucesso.',
				})
			}
		} catch (error) {
			console.error('❌ [PAGE_PROJECTS] Erro ao salvar projeto:', { error })
			toast({
				type: 'error',
				title: 'Erro ao salvar projeto',
				description: 'Não foi possível salvar o projeto. Tente novamente.',
			})
			throw error
		}
	}

	async function handleProjectDelete(projectId: string) {
		try {

			const response = await fetch(`/api/admin/projects?id=${projectId}`, {
				method: 'DELETE',
			})

			if (!response.ok) {
				throw new Error(`Erro HTTP: ${response.status}`)
			}

			setProjects((prev) => prev.filter((p) => p.id !== projectId))

			toast({
				type: 'success',
				title: 'Projeto excluído',
				description: 'O projeto foi excluído com sucesso.',
			})
		} catch (error) {
			console.error('❌ [PAGE_PROJECTS] Erro ao excluir projeto:', { error })
			toast({
				type: 'error',
				title: 'Erro ao excluir projeto',
				description: 'Não foi possível excluir o projeto. Tente novamente.',
			})
			throw error
		}
	}

	// Formatar data
	const formatDate = (dateString: string | null) => {
		if (!dateString) return 'Não definida'
		return formatDateBR(dateString)
	}

	// Função para controlar dropdown
	const toggleDropdown = (projectId: string) => {
		setExpandedProjectId(expandedProjectId === projectId ? null : projectId)
	}

	// Funções para ícones dos detalhes
	const getStatusIcon = (status: Project['status']) => {
		const statusIcons = {
			active: '🟢',
			completed: '🔵',
			paused: '🟡',
			cancelled: '🔴',
		}
		const statusLabels = {
			active: 'Ativo',
			completed: 'Finalizado',
			paused: 'Pausado',
			cancelled: 'Cancelado',
		}
		return `${statusIcons[status as keyof typeof statusIcons]} ${statusLabels[status as keyof typeof statusLabels]}`
	}

	const getPriorityIcon = (priority: Project['priority']) => {
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
		return `${priorityIcons[priority as keyof typeof priorityIcons]} ${priorityLabels[priority as keyof typeof priorityLabels]}`
	}

	return (
		<>
			{/* Cabeçalho da Página de Projetos */}
			<div className='p-6 border-b border-zinc-200 dark:border-zinc-700'>
				<div>
					<h1 className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>Projetos</h1>
					<p className='text-zinc-600 dark:text-zinc-400 mt-1'>Gerencie seus projetos e acompanhe o progresso</p>
				</div>
			</div>

			{/* Conteúdo da Página */}
			<div className='p-6'>
				<div className='max-w-7xl mx-auto space-y-6'>
					{/* Estatísticas */}
					<ProjectStatsCards projects={projects} />

					{/* Ações e Filtros */}
					<div className='flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center'>
						<div className='flex flex-col sm:flex-row gap-3 flex-1'>
							{/* Busca */}
							<div className='relative flex-1 min-w-120 max-w-lg'>
								<Input type='text' placeholder='Buscar projetos...' value={search} setValue={setSearch} className='pr-10' />
								<span className='icon-[lucide--search] absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 size-4' />
							</div>

							{/* Filtro de Status */}
							<Select
								name='statusFilter'
								selected={statusFilter}
								onChange={(value) => setStatusFilter(value as 'all' | 'active' | 'completed' | 'paused' | 'cancelled')}
								options={[
									{ value: 'all', label: 'Todos os status' },
									{ value: 'active', label: 'Apenas ativos' },
									{ value: 'completed', label: 'Apenas finalizados' },
									{ value: 'paused', label: 'Apenas pausados' },
									{ value: 'cancelled', label: 'Apenas cancelados' },
								]}
								placeholder='Filtrar por status'
							/>
						</div>

						{/* Botão Criar */}
						<Button onClick={openCreateForm} className='flex items-center gap-2'>
							<span className='icon-[lucide--plus] size-4' />
							Novo projeto
						</Button>
					</div>

					{/* Lista de Projetos */}
					<div className='bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700'>
						<div className='p-6 border-b border-zinc-200 dark:border-zinc-700'>
							<h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-100'>Projetos ({filteredProjects.length})</h2>
							<p className='text-sm text-zinc-600 dark:text-zinc-400 mt-1'>Lista de todos os projetos cadastrados no sistema</p>
						</div>

						{/* Cabeçalho da Tabela */}
						<div className='bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700'>
							<div className='px-6 py-3'>
								<div className='flex items-center justify-between'>
									<div className='text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider'>Projeto</div>
									<div className='text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-right'>Ações</div>
								</div>
							</div>
						</div>

						{loading ? (
							<div className='flex items-center justify-center py-12'>
								<LoadingSpinner 
									text="Carregando projetos..." 
									size="md" 
									variant="horizontal" 
								/>
							</div>
						) : filteredProjects.length === 0 ? (
							<div className='text-center py-12'>
								<span className='icon-[lucide--folder-x] size-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4 block' />
								<h3 className='text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2'>{search || statusFilter !== 'all' ? 'Nenhum projeto encontrado' : 'Nenhum projeto criado ainda'}</h3>
								<p className='text-zinc-600 dark:text-zinc-400 mb-4'>{search || statusFilter !== 'all' ? 'Tente ajustar os filtros para encontrar projetos.' : 'Comece criando seu primeiro projeto para organizar as atividades.'}</p>
								{!search && statusFilter === 'all' && (
									<Button onClick={openCreateForm} className='flex items-center gap-2 mx-auto'>
										<span className='icon-[lucide--plus] size-4' />
										Criar primeiro projeto
									</Button>
								)}
							</div>
						) : (
							<div className='divide-y divide-zinc-200 dark:divide-zinc-700'>
								{filteredProjects.map((project) => (
									<div key={project.id}>
										<div className='flex items-center justify-between'>
											<div className='flex items-center justify-center gap-4 py-6 px-4'>
												{/* Botão Dropdown */}
												<button onClick={() => toggleDropdown(project.id)} className='size-10 rounded-full flex justify-center items-center hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors' title='Ver detalhes'>
													<span className={`icon-[lucide--chevron-down] size-4 text-zinc-600 dark:text-zinc-400 transition-transform ${expandedProjectId === project.id ? 'rotate-180' : ''}`} />
												</button>
												{/* Conteúdo principal - título e descrição resumida */}
												<div>
													<h3 className='text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate'>{project.name}</h3>
													{project.shortDescription && <p className='text-zinc-600 dark:text-zinc-400 truncate text-sm'>{project.shortDescription}</p>}
												</div>
											</div>

											{/* Container: Botões de ação */}
											<div className='px-6 flex items-center justify-center gap-2'>
												{/* Botões de ação - sempre visíveis */}
												<div className='flex items-center justify-center gap-2'>
													<button onClick={() => handleProjectClick(project.id)} className='size-10 flex items-center justify-center  rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors' title='Visualizar projeto'>
														<span className='icon-[lucide--eye] size-4 text-blue-600 dark:text-blue-400' />
													</button>
													<button onClick={(e) => openViewDescription(project, e)} className='size-10 flex items-center justify-center  rounded-full hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors' title='Ver descrição completa'>
														<span className='icon-[lucide--file-text] size-4 text-purple-600 dark:text-purple-400' />
													</button>
													<button onClick={(e) => openEditForm(project, e)} className='size-10 flex items-center justify-center  rounded-full hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors' title='Editar projeto'>
														<span className='icon-[lucide--edit] size-4 text-green-600 dark:text-green-400' />
													</button>
												</div>
											</div>
										</div>

										{/* Linha expandida com detalhes (Status, Prioridade, Datas) */}
										{expandedProjectId === project.id && (
											<div className='px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 transition-opacity duration-700 ease-in-out animate-in fade-in'>
												<div className='flex flex-wrap items-center gap-6'>
													{/* Status */}
													<div className='flex items-center gap-2'>
														<span className='icon-[lucide--check-circle] size-4 text-zinc-400' />
														<span className='text-sm'>{getStatusIcon(project.status)}</span>
													</div>

													{/* Prioridade */}
													<div className='flex items-center gap-2'>
														<span className='icon-[lucide--triangle-alert] size-4 text-zinc-400' />
														<span className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>Prioridade:</span>
														<span className='text-sm'>{getPriorityIcon(project.priority)}</span>
													</div>

													{/* Usuários/Membros */}
													<div className='flex items-center gap-2'>
														<span className='icon-[lucide--users] size-4 text-zinc-400' />
														<div className='flex items-center gap-1.5'>
															<span className='text-zinc-400 text-sm px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-md'>Não atribuído</span>
														</div>
													</div>

													{/* Período */}
													<div className='flex items-center gap-2'>
														<span className='icon-[lucide--calendar] size-4 text-zinc-400' />
														<div className='flex items-center gap-2 text-sm bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-md'>
															{project.startDate && <span className='text-zinc-700 dark:text-zinc-300 font-medium'>{formatDate(project.startDate)}</span>}
															{project.startDate && project.endDate && <span className='text-zinc-400'>→</span>}
															{project.endDate && <span className='text-zinc-700 dark:text-zinc-300 font-medium'>{formatDate(project.endDate)}</span>}
															{!project.startDate && !project.endDate && <span className='text-zinc-400'>Não definido</span>}
														</div>
													</div>

													{/* Progresso */}
													<div className='flex items-center gap-2'>
														<span className='icon-[lucide--trending-up] size-4 text-zinc-400' />
														<span className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>Progresso:</span>
														<div className='flex items-center gap-3'>
															<div className='w-20 bg-zinc-200 dark:bg-zinc-700 rounded-full h-2'>
																<div className='h-2 rounded-full transition-all duration-300 bg-orange-500' style={{ width: '0%' }} />
															</div>
															<span className='text-sm font-semibold text-zinc-800 dark:text-zinc-200'>0%</span>
														</div>
													</div>
												</div>
											</div>
										)}
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Formulário de Projeto (Criar/Editar) */}
			<ProjectFormOffcanvas isOpen={formOpen} onClose={closeForm} project={editingProject} onSubmit={handleProjectSubmit} onDelete={openDeleteDialog} />

			{/* Dialog de Exclusão */}
			<ProjectDeleteDialog isOpen={deleteDialogOpen} onClose={closeDeleteDialog} project={projectToDelete} onConfirm={handleProjectDelete} />

			{/* Offcanvas de Visualização de Descrição */}
			<Offcanvas open={!!viewDescriptionProject} onClose={() => setViewDescriptionProject(null)} title={`${viewDescriptionProject?.name || ''}`} width='lg'>
				{viewDescriptionProject && (
					<div className='space-y-6'>
						{/* Informações principais do projeto */}
						<div className='bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4'>
							<div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
								{/* Status */}
								<div className='flex items-center gap-2'>
									<span className='icon-[lucide--check-circle] size-4 text-zinc-400' />
									<span className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>Status:</span>
									<span className='text-sm'>{getStatusIcon(viewDescriptionProject.status)}</span>
								</div>

								{/* Prioridade */}
								<div className='flex items-center gap-2'>
									<span className='icon-[lucide--triangle-alert] size-4 text-zinc-400' />
									<span className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>Prioridade:</span>
									<span className='text-sm'>{getPriorityIcon(viewDescriptionProject.priority)}</span>
								</div>

								{/* Data de início */}
								<div className='flex items-center gap-2'>
									<span className='icon-[lucide--calendar-days] size-4 text-zinc-400' />
									<span className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>Início:</span>
									<span className='text-sm text-zinc-600 dark:text-zinc-400'>{formatDate(viewDescriptionProject.startDate)}</span>
								</div>

								{/* Data de fim */}
								<div className='flex items-center gap-2'>
									<span className='icon-[lucide--calendar-check] size-4 text-zinc-400' />
									<span className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>Fim:</span>
									<span className='text-sm text-zinc-600 dark:text-zinc-400'>{formatDate(viewDescriptionProject.endDate)}</span>
								</div>
							</div>
						</div>

						{/* Descrição completa */}
						<div>
							<h3 className='text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3'>Descrição do Projeto</h3>
							{viewDescriptionProject.description?.trim() ? (
								<div className={getMarkdownClasses('base', 'text-zinc-800 dark:text-zinc-200')}>
									<ReactMarkdown>{viewDescriptionProject.description}</ReactMarkdown>
								</div>
							) : (
								<div className='text-center py-8'>
									<span className='icon-[lucide--file-text] size-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-3 block' />
									<p className='text-zinc-500 italic'>Este projeto ainda não possui uma descrição detalhada.</p>
								</div>
							)}
						</div>
					</div>
				)}
			</Offcanvas>
		</>
	)
}
