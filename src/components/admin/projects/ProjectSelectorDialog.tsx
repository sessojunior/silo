'use client'

import { useState } from 'react'

import Dialog from '@/components/ui/Dialog'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

import { Project } from '@/types/projects'

interface ProjectSelectorDialogProps {
	isOpen: boolean
	onClose: () => void
	projects: Project[]
	onSelectProject: (project: Project) => void
}

export default function ProjectSelectorDialog({ isOpen, onClose, projects, onSelectProject }: ProjectSelectorDialogProps) {
	const [search, setSearch] = useState('')

	// Filtrar projetos por busca
	const filteredProjects = projects.filter((project) => project.name.toLowerCase().includes(search.toLowerCase()) || project.description?.toLowerCase().includes(search.toLowerCase()))

	function handleSelectProject(project: Project) {
		onSelectProject(project)
		setSearch('')
		onClose()
	}

	return (
		<Dialog open={isOpen} onClose={onClose} title='Selecionar Projeto' description='Escolha um projeto para atribuir novos membros'>
			<div className='space-y-4 h-full flex flex-col'>
				{/* Busca + Filtros + Botão - TUDO NA MESMA LINHA */}
				<div className='flex gap-3 items-center'>
					{/* Campo de Busca - FLEX 1 */}
					<div className='relative flex-1'>
						<Input type='text' placeholder='Buscar projeto...' value={search} setValue={setSearch} className='pr-10' />
						<span className='icon-[lucide--search] absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 size-4' />
					</div>

					{/* Botão Selecionar Primeiro */}
					<Button type='button' onClick={() => filteredProjects.length > 0 && handleSelectProject(filteredProjects[0])} disabled={filteredProjects.length === 0} className='whitespace-nowrap'>
						<span className='icon-[lucide--zap] size-4 mr-2' />
						Selecionar Primeiro
					</Button>

					{/* Botão Cancelar */}
					<Button type='button' onClick={onClose} style='bordered' className='whitespace-nowrap'>
						<span className='icon-[lucide--x] size-4 mr-2' />
						Cancelar
					</Button>
				</div>

				{/* Lista de Projetos */}
				<div className='flex-1 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg'>
					{filteredProjects.length === 0 ? (
						<div className='text-center py-8'>
							<span className='icon-[lucide--folder-x] size-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2 block' />
							<p className='text-zinc-600 dark:text-zinc-400'>{search ? 'Nenhum projeto encontrado' : 'Nenhum projeto disponível'}</p>
						</div>
					) : (
						<div className='divide-y divide-zinc-200 dark:divide-zinc-700'>
							{filteredProjects.map((project) => (
								<div key={project.id} className='p-4 cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800' onClick={() => handleSelectProject(project)}>
									<div className='flex items-center gap-3'>
										{/* Ícone do Projeto */}
										<div className='size-10 rounded-lg flex items-center justify-center bg-blue-100 dark:bg-blue-900/30'>
											<span className='icon-[lucide--folder] size-5 text-blue-600 dark:text-blue-400' />
										</div>

										{/* Info do Projeto */}
										<div className='flex-1 min-w-0'>
											<div className='flex items-center gap-2'>
												<h3 className='font-medium text-zinc-900 dark:text-zinc-100 truncate'>{project.name}</h3>
												<span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${project.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' : project.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' : project.status === 'paused' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'}`}>
													{project.status === 'active' && '🟢 Ativo'}
													{project.status === 'completed' && '✅ Finalizado'}
													{project.status === 'paused' && '⏸️ Pausado'}
													{project.status === 'cancelled' && '❌ Cancelado'}
												</span>
											</div>
											{project.description && <p className='text-sm text-zinc-500 dark:text-zinc-400 truncate'>{project.description}</p>}
											<p className='text-sm text-zinc-500 dark:text-zinc-400'>
												0 membros
											</p>
										</div>

										{/* Ícone de Seleção */}
										<span className='icon-[lucide--chevron-right] size-5 text-zinc-400' />
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			{/* Rodapé com informações */}
			<div className='pt-4 border-t border-zinc-200 dark:border-zinc-700'>
				<p className='text-sm text-zinc-500 dark:text-zinc-400 text-center'>
					{filteredProjects.length} projeto{filteredProjects.length !== 1 ? 's' : ''} encontrado{filteredProjects.length !== 1 ? 's' : ''}
				</p>
			</div>
		</Dialog>
	)
}
