'use client'

import { useParams } from 'next/navigation'
import { Project } from '@/types/projects'
import Button from '@/components/ui/Button'
import ProductTabs from '@/components/admin/nav/ProductTabs'

interface ProjectDetailsHeaderProps {
	project: Project
	onEdit?: (project: Project) => void
}

export default function ProjectDetailsHeader({ project, onEdit }: ProjectDetailsHeaderProps) {
	const params = useParams()
	const projectId = params.id as string

	// Abas de navegação do projeto
	const tabs = [
		{
			label: 'Atividades',
			url: `/admin/projects/${projectId}`,
		},
		{
			label: 'Gantt',
			url: `/admin/projects/${projectId}/gantt`,
		},
	]

	return (
		<div className='w-full'>
			{/* Navegação por Abas */}
			<div className='flex'>
				<div className='flex w-full border-b border-zinc-200 bg-zinc-100 px-4 py-3 transition dark:border-zinc-700 dark:bg-zinc-700'>
					<ProductTabs tabs={tabs} />
				</div>
			</div>

			{/* Header Principal */}
			<div className='p-6 border-b border-zinc-200 dark:border-zinc-700'>
				<div className='flex items-center justify-between'>
					<div>
						<h1 className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>{project.name}</h1>
						{project.description && <p className='text-zinc-600 dark:text-zinc-400 mt-1'>{project.description}</p>}
					</div>

					{onEdit && (
						<Button onClick={() => onEdit(project)} className='flex items-center gap-2'>
							<span className='icon-[lucide--edit] size-4' />
							<span className='hidden sm:inline'>Editar projeto</span>
						</Button>
					)}
				</div>
			</div>
		</div>
	)
}
