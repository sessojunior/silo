'use client'

import { useState, useEffect } from 'react'
import { Project, ProjectFormData } from '@/types/projects'
import Offcanvas from '@/components/ui/Offcanvas'
import Input from '@/components/ui/Input'

import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import Label from '@/components/ui/Label'
import Markdown from '@/components/ui/Markdown'
import { toast } from '@/lib/toast'

interface ProjectFormOffcanvasProps {
	isOpen: boolean
	onClose: () => void
	project?: Project | null
	onSubmit: (projectData: ProjectFormData) => void
	onDelete?: (project: Project) => void
}

export default function ProjectFormOffcanvas({ isOpen, onClose, project, onSubmit, onDelete }: ProjectFormOffcanvasProps) {
	const [formData, setFormData] = useState<ProjectFormData>({
		name: '',
		shortDescription: '',
		description: '',
		startDate: null,
		endDate: null,
		priority: 'medium',
		status: 'active',
	})
	const [saving, setSaving] = useState(false)

	// Opções de status
	const statusOptions = [
		{ value: 'active', label: '🟢 Ativo' },
		{ value: 'completed', label: '🔵 Finalizado' },
		{ value: 'paused', label: '🟡 Pausado' },
		{ value: 'cancelled', label: '🔴 Cancelado' },
	]

	// Opções de prioridade
	const priorityOptions = [
		{ value: 'low', label: '⬇️ Baixa' },
		{ value: 'medium', label: '➡️ Média' },
		{ value: 'high', label: '⬆️ Alta' },
		{ value: 'urgent', label: '🚨 Urgente' },
	]

	// Carregar dados do projeto para edição
	useEffect(() => {
		if (project) {
			setFormData({
				name: project.name,
				shortDescription: project.shortDescription || '',
				description: project.description,
				status: project.status as 'active' | 'completed' | 'paused' | 'cancelled',
				priority: project.priority as 'low' | 'medium' | 'high' | 'urgent',
				startDate: project.startDate,
				endDate: project.endDate,
			})
		} else {
			// Reset para novo projeto
			setFormData({
				name: '',
				shortDescription: '',
				description: '',
				status: 'active',
				priority: 'medium',
				startDate: null,
				endDate: null,
			})
		}
	}, [project, isOpen])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		// Validações básicas
		if (!formData.name.trim()) {
			toast({
				type: 'error',
				title: 'Erro na validação',
				description: 'Nome do projeto é obrigatório',
			})
			return
		}

		if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
			toast({
				type: 'error',
				title: 'Erro na validação',
				description: 'Data de início deve ser anterior à data de fim',
			})
			return
		}

		try {
			setSaving(true)

			await onSubmit(formData)

			// ✅ Toast removido daqui - será exibido pela função onSubmit
			onClose()
		} catch (error) {
			console.error('❌ [COMPONENT_PROJECT_FORM] Erro ao salvar projeto:', { error })
			toast({
				type: 'error',
				title: 'Erro ao salvar',
				description: 'Não foi possível salvar o projeto. Tente novamente.',
			})
		} finally {
			setSaving(false)
		}
	}

	const handleFieldChange = (field: keyof ProjectFormData, value: string | null) => {
		setFormData((prev) => ({
			...prev,
			[field]: value,
		}))
	}

	const handleDelete = () => {
		if (project && onDelete) {
			onDelete(project)
			onClose()
		}
	}

	return (
		<Offcanvas open={isOpen} onClose={onClose} title={project ? 'Editar Projeto' : 'Novo Projeto'} width='xl'>
			<form onSubmit={handleSubmit} className='space-y-6'>
				{/* Nome do Projeto */}
				<div>
					<Label htmlFor='name'>Nome do Projeto *</Label>
					<Input id='name' type='text' placeholder='Ex: Sistema de Previsão BAM' value={formData.name} setValue={(value) => handleFieldChange('name', value)} disabled={saving} required />
				</div>

				{/* Descrição Resumida */}
				<div>
					<Label htmlFor='shortDescription'>Descrição Resumida</Label>
					<textarea id='shortDescription' value={formData.shortDescription} onChange={(e) => handleFieldChange('shortDescription', e.target.value)} placeholder='Breve descrição do projeto...' rows={2} disabled={saving} className='w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 resize-none' />
				</div>

				{/* Linha: Status e Prioridade */}
				<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
					{/* Status */}
					<div>
						<Label htmlFor='status'>Status</Label>
						<Select name='status' selected={formData.status} onChange={(value) => handleFieldChange('status', value)} options={statusOptions} placeholder='Selecionar status' />
					</div>

					{/* Prioridade */}
					<div>
						<Label htmlFor='priority'>Prioridade</Label>
						<Select name='priority' selected={formData.priority} onChange={(value) => handleFieldChange('priority', value)} options={priorityOptions} placeholder='Selecionar prioridade' />
					</div>
				</div>

				{/* Linha: Datas */}
				<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
					{/* Data de Início */}
					<div>
						<Label htmlFor='startDate'>Data de Início</Label>
						<input id='startDate' type='date' value={formData.startDate || ''} onChange={(e) => handleFieldChange('startDate', e.target.value || null)} disabled={saving} className='w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50' />
					</div>

					{/* Data de Fim */}
					<div>
						<Label htmlFor='endDate'>Data de Fim</Label>
						<input id='endDate' type='date' value={formData.endDate || ''} onChange={(e) => handleFieldChange('endDate', e.target.value || null)} disabled={saving} className='w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50' />
					</div>
				</div>

				{/* Descrição Completa com Markdown Editor */}
				<div>
					<Label htmlFor='description'>Descrição Completa</Label>
					<div className='mt-2'>
						<Markdown value={formData.description} onChange={(value) => handleFieldChange('description', value)} height={250} compact />
					</div>
				</div>

				{/* Botões - Excluir à esquerda, Cancelar/Salvar à direita */}
				<div className='flex justify-between pt-6 border-t border-zinc-200 dark:border-zinc-700'>
					{/* Botão Excluir (esquerda) */}
					<div>
						{project && onDelete && (
							<Button type='button' onClick={handleDelete} className='bg-red-600 hover:bg-red-700 text-white' disabled={saving}>
								<span className='icon-[lucide--trash] size-4 mr-2' />
								Excluir
							</Button>
						)}
					</div>

					{/* Botões Cancelar/Salvar (direita) */}
					<div className='flex gap-3'>
						<Button type='button' onClick={onClose} className='bg-zinc-500 hover:bg-zinc-600 text-white' disabled={saving}>
							Cancelar
						</Button>
						<Button type='submit' className='bg-blue-600 hover:bg-blue-700 text-white' disabled={saving}>
							{saving ? (
								<>
									<span className='icon-[lucide--loader-circle] size-4 animate-spin mr-2' />
									Salvando...
								</>
							) : (
								<>
									<span className='icon-[lucide--save] size-4 mr-2' />
									{project ? 'Salvar projeto' : 'Criar projeto'}
								</>
							)}
						</Button>
					</div>
				</div>
			</form>
		</Offcanvas>
	)
}
