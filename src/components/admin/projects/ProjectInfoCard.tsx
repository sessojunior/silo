'use client'

import React from 'react'
import { formatDateBR } from '@/lib/dateUtils'

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

interface ProjectInfoCardProps {
	project: Project
}

export default function ProjectInfoCard({ project }: ProjectInfoCardProps) {
	// Formatar data
	const formatDate = (dateString: string | null) => {
		if (!dateString) return 'Não definida'
		return formatDateBR(dateString)
	}

	return (
		<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
			{/* Status */}
			<div className='bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-3'>
				<div className='flex items-center gap-3'>
					<div className={`w-3 h-3 rounded-full ${project.status === 'active' ? 'bg-green-500' : project.status === 'completed' ? 'bg-blue-500' : project.status === 'paused' ? 'bg-yellow-500' : 'bg-red-500'}`} />
					<div>
						<p className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>Status</p>
						<p className='text-sm text-zinc-600 dark:text-zinc-400 capitalize'>{project.status === 'active' ? 'Ativo' : project.status === 'completed' ? 'Concluído' : project.status === 'paused' ? 'Pausado' : 'Cancelado'}</p>
					</div>
				</div>
			</div>

			{/* Prioridade */}
			<div className='bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-3'>
				<div className='flex items-center gap-3'>
					<div className={`w-3 h-3 rounded-full ${project.priority === 'urgent' ? 'bg-red-500' : project.priority === 'high' ? 'bg-orange-500' : project.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
					<div>
						<p className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>Prioridade</p>
						<p className='text-sm text-zinc-600 dark:text-zinc-400 capitalize'>{project.priority === 'urgent' ? 'Urgente' : project.priority === 'high' ? 'Alta' : project.priority === 'medium' ? 'Média' : 'Baixa'}</p>
					</div>
				</div>
			</div>

			{/* Data de Início */}
			<div className='bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-3'>
				<div className='flex items-center gap-3'>
					<span className='icon-[lucide--calendar-days] size-4 text-zinc-400' />
					<div>
						<p className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>Início</p>
						<p className='text-sm text-zinc-600 dark:text-zinc-400'>{project.startDate ? formatDate(project.startDate) : 'Não definida'}</p>
					</div>
				</div>
			</div>

			{/* Data de Fim */}
			<div className='bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-3'>
				<div className='flex items-center gap-3'>
					<span className='icon-[lucide--calendar-check] size-4 text-zinc-400' />
					<div>
						<p className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>Fim</p>
						<p className='text-sm text-zinc-600 dark:text-zinc-400'>{project.endDate ? formatDate(project.endDate) : 'Não definida'}</p>
					</div>
				</div>
			</div>
		</div>
	)
}
