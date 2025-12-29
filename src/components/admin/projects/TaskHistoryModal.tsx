'use client'

import { useState, useEffect, useCallback } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { toast } from '@/lib/toast'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface TaskHistoryEntry {
	id: string
	action: string
	fromStatus?: string | null
	toStatus: string
	createdAt: string
	user: {
		name: string
		image?: string | null
	}
}

interface TaskHistoryModalProps {
	isOpen: boolean
	onClose: () => void
	taskId: string
	taskName: string
}

// Função para traduzir ações para português
const translateAction = (action: string): string => {
	const translations: Record<string, string> = {
		created: 'Criação da tarefa',
		status_change: 'Mudança de coluna',
		updated: 'Edição da tarefa',
		deleted: 'Exclusão da tarefa',
	}
	return translations[action] || action
}

export default function TaskHistoryModal({ isOpen, onClose, taskId, taskName }: TaskHistoryModalProps) {
	const [history, setHistory] = useState<TaskHistoryEntry[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const fetchHistory = useCallback(async () => {
		try {
			setLoading(true)
			setError(null)

			const response = await fetch(`/api/admin/tasks/${taskId}/history`)
			const data = await response.json()

			if (!response.ok || !data.success) {
				throw new Error(data.error || 'Erro ao carregar histórico')
			}

			setHistory(data.history || [])
		} catch (error) {
			console.error('❌ [COMPONENT_TASK_HISTORY_MODAL] Erro ao carregar histórico:', { error })
			setError(error instanceof Error ? error.message : 'Erro desconhecido')
			toast({
				type: 'error',
				title: 'Erro ao carregar histórico',
				description: 'Não foi possível carregar o histórico da tarefa.',
			})
		} finally {
			setLoading(false)
		}
	}, [taskId])

	useEffect(() => {
		if (isOpen && taskId) {
			fetchHistory()
		}
	}, [isOpen, taskId, fetchHistory])

	return (
		<Modal isOpen={isOpen} onClose={onClose} title='Histórico da Tarefa'>
			<div className='space-y-4'>
				<div className='p-6'>
					{/* Cabeçalho da tarefa */}
					<div className='bg-zinc-50 dark:bg-zinc-800 rounded-lg pb-6'>
						<div className='flex items-center gap-2'>
							<span className='icon-[lucide--file-text] size-4 text-zinc-500 dark:text-zinc-400' />
							<h3 className='font-medium text-zinc-900 dark:text-zinc-100 truncate'>{taskName}</h3>
						</div>
					</div>

					{/* Loading */}
					{loading && (
						<div className='flex items-center justify-center py-8'>
							<LoadingSpinner 
								text="Carregando histórico..." 
								size="sm" 
								variant="horizontal" 
							/>
						</div>
					)}

					{/* Error */}
					{error && (
						<div className='bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3'>
							<div className='flex items-center gap-2 text-red-700 dark:text-red-300'>
								<span className='icon-[lucide--alert-circle] size-4' />
								<span className='font-medium'>Erro ao carregar histórico</span>
							</div>
							<p className='text-red-600 dark:text-red-400 text-sm mt-1 ml-6'>{error}</p>
						</div>
					)}

					{/* Timeline do histórico */}
					{!loading && !error && (
						<div className='space-y-3'>
							{history.length === 0 ? (
								<div className='text-center py-8'>
									<span className='icon-[lucide--history] size-12 text-zinc-300 dark:text-zinc-600 mx-auto block mb-3' />
									<p className='text-zinc-500 dark:text-zinc-400'>Nenhum histórico encontrado</p>
									<p className='text-sm text-zinc-400 dark:text-zinc-500 mt-1'>Esta tarefa ainda não possui movimentações registradas</p>
								</div>
							) : (
								<div className='relative'>
									{/* Linha conectora vertical principal */}
									<div className='absolute left-5 top-5 bottom-5 w-px bg-zinc-200 dark:bg-zinc-700' />

									{/* Entradas do histórico */}
									<div className='space-y-2'>
										{history.map((entry) => (
											<div key={entry.id} className='relative flex items-start gap-3'>
												{/* Ícone da ação com fundo branco para sobrepor a linha */}
												<div className='relative z-10 flex-shrink-0 size-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center border-2 border-white dark:border-zinc-800'>
													<span className='icon-[lucide--history] size-4 text-blue-600 dark:text-blue-400' />
												</div>

												{/* Conteúdo */}
												<div className='flex-1 min-w-0 py-1'>
													<div className='flex items-center gap-2 mb-1'>
														<span className='font-medium text-zinc-900 dark:text-zinc-100'>{entry.user.name}</span>
														<span className='px-2 py-0.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-full'>{translateAction(entry.action)}</span>
													</div>
													<div className='text-sm text-zinc-500 dark:text-zinc-400'>
														{new Date(entry.createdAt).toLocaleString('pt-BR', {
															day: '2-digit',
															month: '2-digit',
															year: 'numeric',
															hour: '2-digit',
															minute: '2-digit',
														})}
													</div>
												</div>
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					)}
				</div>

				{/* Rodapé com botão */}
				<div className='flex justify-end pt-4 border-t border-zinc-200 dark:border-zinc-700 p-4'>
					<Button type='button' onClick={onClose} className='bg-zinc-500 hover:bg-zinc-600 text-white px-4 py-2'>
						Fechar
					</Button>
				</div>
			</div>
		</Modal>
	)
}
