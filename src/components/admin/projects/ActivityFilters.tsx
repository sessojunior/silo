'use client'

import { useState } from 'react'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import { ProjectActivity } from '@/types/projects'

interface ActivityFiltersProps {
	onFilterChange: (filters: FilterOptions) => void
	members: { id: string; name: string }[]
	categories: string[]
}

export interface FilterOptions {
	search: string
	status: ProjectActivity['status'] | 'all'
	priority: ProjectActivity['priority'] | 'all'
	category: string | 'all'
	assignee: string | 'all'
}

export default function ActivityFilters({ onFilterChange, members, categories }: ActivityFiltersProps) {
	const [filters, setFilters] = useState<FilterOptions>({
		search: '',
		status: 'all',
		priority: 'all',
		category: 'all',
		assignee: 'all',
	})

	// Opções de status
	const statusOptions = [
		{ value: 'all', label: 'Todos os status' },
		{ value: 'todo', label: '📋 À fazer' },
		{ value: 'in_progress', label: '🔄 Em progresso' },
		{ value: 'review', label: '👀 Em revisão' },
		{ value: 'done', label: '✅ Concluído' },
		{ value: 'blocked', label: '🚫 Bloqueado' },
	]

	// Opções de prioridade
	const priorityOptions = [
		{ value: 'all', label: 'Todas prioridades' },
		{ value: 'urgent', label: '🚨 Urgente' },
		{ value: 'high', label: '⬆️ Alta' },
		{ value: 'medium', label: '➡️ Média' },
		{ value: 'low', label: '⬇️ Baixa' },
	]

	// Opções de categoria
	const categoryOptions = [{ value: 'all', label: 'Todas categorias' }, ...categories.map((cat) => ({ value: cat, label: cat }))]

	// Opções de assignee
	const assigneeOptions = [{ value: 'all', label: 'Todos os membros' }, ...members.map((member) => ({ value: member.id, label: member.name }))]

	const handleFilterChange = (key: keyof FilterOptions, value: string) => {
		const newFilters = { ...filters, [key]: value }
		setFilters(newFilters)
		onFilterChange(newFilters)
	}

	const clearFilters = () => {
		const clearedFilters: FilterOptions = {
			search: '',
			status: 'all',
			priority: 'all',
			category: 'all',
			assignee: 'all',
		}
		setFilters(clearedFilters)
		onFilterChange(clearedFilters)
	}

	const hasActiveFilters = filters.search !== '' || filters.status !== 'all' || filters.priority !== 'all' || filters.category !== 'all' || filters.assignee !== 'all'

	return (
		<div className='bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4'>
			<div className='flex flex-col gap-4'>
				{/* Linha 1: Busca e Botão Limpar */}
				<div className='flex flex-col sm:flex-row gap-3 items-start sm:items-center'>
					{/* Busca */}
					<div className='relative flex-1 max-w-md'>
						<Input type='text' placeholder='Buscar atividades...' value={filters.search} setValue={(value) => handleFilterChange('search', value)} className='pr-10' />
						<span className='icon-[lucide--search] absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 size-4' />
					</div>

					{/* Botão Limpar Filtros */}
					{hasActiveFilters && (
						<Button onClick={clearFilters} style='bordered' className='flex items-center gap-2 whitespace-nowrap'>
							<span className='icon-[lucide--x] size-4' />
							Limpar filtros
						</Button>
					)}
				</div>

				{/* Linha 2: Filtros */}
				<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
					{/* Status */}
					<Select name='status' selected={filters.status} onChange={(value) => handleFilterChange('status', value)} options={statusOptions} placeholder='Filtrar por status' />

					{/* Prioridade */}
					<Select name='priority' selected={filters.priority} onChange={(value) => handleFilterChange('priority', value)} options={priorityOptions} placeholder='Filtrar por prioridade' />

					{/* Categoria */}
					<Select name='category' selected={filters.category} onChange={(value) => handleFilterChange('category', value)} options={categoryOptions} placeholder='Filtrar por categoria' />

					{/* Assignee */}
					<Select name='assignee' selected={filters.assignee} onChange={(value) => handleFilterChange('assignee', value)} options={assigneeOptions} placeholder='Filtrar por membro' />
				</div>

				{/* Resumo de Filtros Ativos */}
				{hasActiveFilters && (
					<div className='flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-700'>
						<span className='text-sm text-zinc-500 dark:text-zinc-400'>Filtros ativos:</span>

						{filters.search && (
							<span className='inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-full text-xs'>
								<span className='icon-[lucide--search] size-3' />
								&ldquo;{filters.search}&rdquo;
							</span>
						)}

						{filters.status !== 'all' && (
							<span className='inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded-full text-xs'>
								<span className='icon-[lucide--circle-dot] size-3' />
								{statusOptions.find((opt) => opt.value === filters.status)?.label}
							</span>
						)}

						{filters.priority !== 'all' && (
							<span className='inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300 rounded-full text-xs'>
								<span className='icon-[lucide--alert-triangle] size-3' />
								{priorityOptions.find((opt) => opt.value === filters.priority)?.label}
							</span>
						)}

						{filters.category !== 'all' && (
							<span className='inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300 rounded-full text-xs'>
								<span className='icon-[lucide--tag] size-3' />
								{filters.category}
							</span>
						)}

						{filters.assignee !== 'all' && (
							<span className='inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300 rounded-full text-xs'>
								<span className='icon-[lucide--user] size-3' />
								{assigneeOptions.find((opt) => opt.value === filters.assignee)?.label}
							</span>
						)}
					</div>
				)}
			</div>
		</div>
	)
}
