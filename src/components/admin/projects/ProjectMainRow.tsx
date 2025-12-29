'use client'

import { Project } from '@/types/projects'
import Button from '@/components/ui/Button'
import { formatDateBR } from '@/lib/dateUtils'

interface ProjectMainRowProps {
	project: Project
	isExpanded: boolean
	onToggleExpansion: () => void
	onEdit: (project: Project) => void
	onDelete: (project: Project) => void
	onViewDetails: (projectId: string) => void
}

export default function ProjectMainRow({ project, isExpanded, onToggleExpansion, onEdit, onDelete, onViewDetails }: ProjectMainRowProps) {
	// Função para status badge
	const getStatusBadge = (status: Project['status']) => {
		const statusStyles = {
			active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
			completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
			paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
			cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
		}

		const statusLabels = {
			active: '🟢 Ativo',
			completed: '🔵 Finalizado',
			paused: '🟡 Pausado',
			cancelled: '🔴 Cancelado',
		}

		return <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusStyles[status as keyof typeof statusStyles]}`}>{statusLabels[status as keyof typeof statusLabels]}</span>
	}

	// Função para priority badge
	const getPriorityBadge = (priority: Project['priority']) => {
		const priorityStyles = {
			low: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200',
			medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
			high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
			urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
		}

		const priorityLabels = {
			low: '⬇️ Baixa',
			medium: '➡️ Média',
			high: '⬆️ Alta',
			urgent: '🚨 Urgente',
		}

		return <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${priorityStyles[priority as keyof typeof priorityStyles]}`}>{priorityLabels[priority as keyof typeof priorityLabels]}</span>
	}

	// Função para formatar data
	const formatDate = (dateString: string | null) => {
		if (!dateString) return 'Não definida'
		return formatDateBR(dateString)
	}

	return (
		<tr className='hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors group'>
			<td className='px-6 py-4 whitespace-nowrap'>
				<div className='flex items-center gap-3'>
					{/* Botão de Expansão */}
					<Button onClick={onToggleExpansion} className='size-6 p-0 rounded-md bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-700'>
						<span className={`icon-[lucide--chevron-down] size-4 text-zinc-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
					</Button>

					{/* Ícone do Projeto */}
					<div className='size-8 rounded-lg flex items-center justify-center bg-blue-100 dark:bg-blue-900/30'>
						<span className='icon-[lucide--folder] size-4 text-blue-600 dark:text-blue-400' />
					</div>

					{/* Nome e Descrição */}
					<div className='min-w-0'>
						<div className='font-medium text-zinc-900 dark:text-zinc-100'>{project.name}</div>
						{project.description && <div className='text-sm text-zinc-500 dark:text-zinc-400 truncate max-w-xs'>{project.description}</div>}
					</div>
				</div>
			</td>

			{/* Status Badge */}
			<td className='px-6 py-4 whitespace-nowrap'>{getStatusBadge(project.status)}</td>

			{/* Prioridade */}
			<td className='px-6 py-4 whitespace-nowrap hidden sm:table-cell'>{getPriorityBadge(project.priority)}</td>

			{/* Progresso */}
			<td className='px-6 py-4 whitespace-nowrap'>
				<div className='flex items-center gap-2'>
					<div className='w-24 bg-zinc-200 dark:bg-zinc-700 rounded-full h-2'>
						<div className='bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500' style={{ width: '0%' }} />
					</div>
					<span className='text-sm text-zinc-600 dark:text-zinc-400 min-w-10'>0%</span>
				</div>
			</td>

			{/* Datas */}
			<td className='px-6 py-4 whitespace-nowrap hidden md:table-cell'>
				<div className='text-sm'>
					<div className='text-zinc-900 dark:text-zinc-100'>Início: {formatDate(project.startDate)}</div>
					<div className='text-zinc-500 dark:text-zinc-400'>Fim: {formatDate(project.endDate)}</div>
				</div>
			</td>

			{/* Membros */}
			<td className='px-6 py-4 whitespace-nowrap hidden lg:table-cell'>
				<div className='flex items-center gap-1'>
					{/* Avatar Stack (max 3) */}
					<div className='flex -space-x-2'>
						<div className='size-6 bg-blue-100 dark:bg-blue-900/30 rounded-full border-2 border-white dark:border-zinc-800 flex items-center justify-center' title='Sem membros'>
							<span className='icon-[lucide--user] size-3 text-blue-600 dark:text-blue-400' />
						</div>
					</div>
				</div>
			</td>

			{/* Ações */}
			<td className='px-6 py-4 whitespace-nowrap'>
				<div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
					<Button onClick={() => onViewDetails(project.id)} className='size-7 p-0 rounded-md bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900/20' title='Ver detalhes'>
						<span className='icon-[lucide--eye] size-3.5 text-blue-600 dark:text-blue-400' />
					</Button>

					<Button onClick={() => onEdit(project)} className='size-7 p-0 rounded-md bg-transparent hover:bg-yellow-50 dark:hover:bg-yellow-900/20' title='Editar projeto'>
						<span className='icon-[lucide--edit] size-3.5 text-yellow-600 dark:text-yellow-400' />
					</Button>

					<Button onClick={() => onDelete(project)} className='size-7 p-0 rounded-md bg-transparent hover:bg-red-50 dark:hover:bg-red-900/20' title='Excluir projeto'>
						<span className='icon-[lucide--trash] size-3.5 text-red-600 dark:text-red-400' />
					</Button>
				</div>
			</td>
		</tr>
	)
}
