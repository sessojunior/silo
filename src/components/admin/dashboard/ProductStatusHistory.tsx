'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from '@/lib/toast'
import TruncatedDescription from '@/components/ui/TruncatedDescription'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface StatusHistoryEntry {
	id: string
	status: string
	description?: string | null
	createdAt: string
	user: {
		id: string
		name: string
		email: string
		image?: string | null
	}
}

interface ProductStatusHistoryProps {
	productId: string
	date: string
	turn: number
}

// Mapear status para nomes amigáveis
const STATUS_NAMES: Record<string, string> = {
	completed: 'Concluído',
	pending: 'Pendente',
	in_progress: 'Em progresso',
	not_run: 'Não executado',
	with_problems: 'Com problemas',
	run_again: 'Executar novamente',
	under_support: 'Em suporte',
	suspended: 'Suspenso',
	off: 'Desligado',
}

export default function ProductStatusHistory({ productId, date, turn }: ProductStatusHistoryProps) {
	const [history, setHistory] = useState<StatusHistoryEntry[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const fetchHistory = useCallback(async () => {
		try {
			setLoading(true)
			setError(null)

			const response = await fetch(`/api/admin/products/${productId}/history?date=${date}&turn=${turn}`)
			const data = await response.json()

		if (!response.ok || !data.success) {
			throw new Error(data.error || 'Erro ao carregar histórico')
		}

			setHistory(data.history || [])
		} catch (error) {
			console.error('❌ [COMPONENT_PRODUCT_STATUS_HISTORY] Erro ao carregar histórico:', { error })
			setError(error instanceof Error ? error.message : 'Erro desconhecido')
			toast({
				type: 'error',
				title: 'Erro ao carregar histórico',
				description: 'Não foi possível carregar o histórico de status.',
			})
		} finally {
			setLoading(false)
		}
	}, [productId, date, turn])

	useEffect(() => {
		fetchHistory()
	}, [fetchHistory])

	if (loading) {
		return (
			<div className='flex items-center justify-center py-8'>
				<LoadingSpinner 
					text="Carregando histórico..." 
					size="sm" 
					variant="horizontal" 
				/>
			</div>
		)
	}

	if (error) {
		return (
			<div className='bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4'>
				<div className='flex items-center gap-2 text-red-700 dark:text-red-300'>
					<span className='icon-[lucide--alert-circle] size-5' />
					<span className='font-medium'>Erro ao carregar histórico</span>
				</div>
				<p className='text-red-600 dark:text-red-400 text-sm mt-1'>{error}</p>
			</div>
		)
	}

	console.log('ℹ️ [COMPONENT_PRODUCT_STATUS_HISTORY] Renderizando com history:', { history })

	return (
		<div className='space-y-3'>
			{history.length === 0 ? (
				<div className='text-center py-8'>
					<span className='icon-[lucide--history] size-12 text-zinc-300 dark:text-zinc-600 mx-auto block mb-3' />
					<p className='text-zinc-500 dark:text-zinc-400'>Nenhum histórico encontrado</p>
					<p className='text-sm text-zinc-400 dark:text-zinc-500 mt-1'>Este turno ainda não possui alterações de status</p>
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
									<span className='icon-[lucide--activity] size-4 text-blue-600 dark:text-blue-400' />
								</div>

								{/* Conteúdo */}
								<div className='flex-1 min-w-0 py-1'>
									<div className='flex items-center gap-2 mb-1'>
										<span className='font-medium text-zinc-900 dark:text-zinc-100'>{entry.user.name}</span>
										<span className='px-2 py-0.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-full'>{STATUS_NAMES[entry.status] || entry.status}</span>
									</div>
									<div className='text-sm text-zinc-500 dark:text-zinc-400'>
										{(() => {
											const date = new Date(entry.createdAt)
											return isNaN(date.getTime())
												? 'Data inválida'
												: date.toLocaleString('pt-BR', {
														day: '2-digit',
														month: '2-digit',
														year: 'numeric',
														hour: '2-digit',
														minute: '2-digit',
														second: '2-digit',
														timeZone: 'America/Sao_Paulo',
													})
										})()}
									</div>
									{entry.description && <TruncatedDescription description={entry.description} maxLines={3} className='mt-2 text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 rounded px-2 py-1' />}
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	)
}
