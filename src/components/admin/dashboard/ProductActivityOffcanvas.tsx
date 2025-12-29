import { useEffect, useState, useCallback } from 'react'
import Offcanvas from '@/components/ui/Offcanvas'
import Label from '@/components/ui/Label'
import Select, { SelectOption } from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import Markdown from '@/components/ui/Markdown'
import { toast } from '@/lib/toast'
import { formatDateBR } from '@/lib/dateUtils'
import { NO_INCIDENTS_CATEGORY_ID, isRealIncident } from '@/lib/constants'
import { STATUS_OPTIONS, INCIDENT_STATUS, ProductStatus } from '@/lib/productStatus'
import IncidentManagementOffcanvas from './IncidentManagementOffcanvas'

interface Props {
	open: boolean
	onClose: () => void
	productId: string
	productName: string
	date: string
	turn: number
	existingId?: string | null
	initialStatus?: string
	initialDescription?: string | null
	initialCategoryId?: string | null
	onSaved?: () => void
	onAddSaveLog?: (step: string, details: unknown, success?: boolean, error?: string) => void
	onViewHistory?: () => void
}

export default function ProductActivityOffcanvas({ open, onClose, productId, productName, date, turn, existingId = null, initialStatus = 'completed', initialDescription = '', initialCategoryId = null, onSaved, onAddSaveLog, onViewHistory }: Props) {
	const [status, setStatus] = useState<string>(initialStatus)
	const [description, setDescription] = useState<string>(initialDescription || '')
	const [incidentId, setIncidentId] = useState<string | null>(initialCategoryId || null)
	const [incidents, setIncidents] = useState<SelectOption[]>([])
	const [allIncidents, setAllIncidents] = useState<SelectOption[]>([])
	const [loading, setLoading] = useState(false)
	const [incidentManagementOpen, setIncidentManagementOpen] = useState(false)

	useEffect(() => {
		if (open) {
			// reset fields when reopened
			setStatus(initialStatus)
			setDescription(initialDescription || '')
			setIncidentId(initialCategoryId || null)
		}
	}, [open, initialStatus, initialDescription, initialCategoryId])

	const loadIncidents = useCallback(async () => {
		try {
			const response = await fetch('/api/admin/incidents', {
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
			})

			if (response.status === 401) {
				throw new Error('Usuário não autenticado')
			}
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`)
			}

			const data = await response.json()
			if (data.success && data.data) {
				const incidentOptions = [
					{ label: 'Não houve incidentes', value: NO_INCIDENTS_CATEGORY_ID },
					...data.data.map((incident: { name: string; id: string }) => ({
						label: incident.name,
						value: incident.id,
					})),
				]
				setAllIncidents(incidentOptions)
				updateIncidentsForStatus(incidentOptions, status)
			} else {
				const defaultOptions = [{ label: 'Não houve incidentes', value: NO_INCIDENTS_CATEGORY_ID }]
				setAllIncidents(defaultOptions)
				updateIncidentsForStatus(defaultOptions, status)
			}
		} catch (error) {
			console.error('❌ [COMPONENT_PRODUCT_ACTIVITY] Erro ao carregar incidentes:', { error })
			// Manter opção padrão
			const defaultOptions = [{ label: 'Não houve incidentes', value: NO_INCIDENTS_CATEGORY_ID }]
			setAllIncidents(defaultOptions)
			updateIncidentsForStatus(defaultOptions, status)
		}
	}, [status])

	const updateIncidentsForStatus = (allOptions: SelectOption[], currentStatus: string) => {
		// Se o status for "Concluído", permitir campo vazio OU seleção de incidentes
		// Caso contrário, obrigar seleção de incidente real
		if (currentStatus === 'completed') {
			// Incluir opção vazia para permitir null quando não há incidentes
			const optionsWithEmpty = [
				{ label: 'Nenhum incidente', value: '' },
				...allOptions.filter((option) => option.value !== NO_INCIDENTS_CATEGORY_ID)
			]
			setIncidents(optionsWithEmpty)
		} else {
			setIncidents(allOptions.filter((option) => option.value !== NO_INCIDENTS_CATEGORY_ID))
		}
	}

	// Carregar incidentes quando o offcanvas abre
	useEffect(() => {
		if (open) {
			loadIncidents()
		}
	}, [open, loadIncidents])

	// Atualizar opções de incidentes quando o status mudar
	useEffect(() => {
		if (allIncidents.length > 0) {
			updateIncidentsForStatus(allIncidents, status)

			// Se o status não for "Concluído" e o incidente selecionado for "Não houve incidentes",
			// limpar a seleção
			if (status !== 'completed' && incidentId === NO_INCIDENTS_CATEGORY_ID) {
				setIncidentId(null)
			}
		}
	}, [status, allIncidents, incidentId])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		onAddSaveLog?.('Iniciando salvamento', {
			productId,
			date,
			turn,
			status,
			description,
			incidentId,
			existingId,
		})

		// validate
		if (INCIDENT_STATUS.has(status as ProductStatus) && !incidentId) {
			toast({ type: 'error', title: 'Selecione o incidente' })
			return
		}

		// Validação: se há incidente real selecionado, descrição é obrigatória
		if (hasRealIncident && !description.trim()) {
			toast({ type: 'error', title: 'Descrição de incidentes é obrigatória quando um incidente é selecionado' })
			return
		}

		setLoading(true)
		try {
			const payload: { productId: string; date: string; turn: number; status: string; description: string; problemCategoryId: string | null; id?: string } = {
				productId,
				date,
				turn,
				status,
				description,
				problemCategoryId: incidentId === '' ? null : incidentId,
			}
			const url = '/api/admin/products/activities'
			let method: 'POST' | 'PUT' = 'POST'
			if (existingId) {
				method = 'PUT'
				payload.id = existingId
			}

			onAddSaveLog?.('Enviando requisição', {
				method,
				url,
				payload,
			})

			const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
			const json = await res.json()

			onAddSaveLog?.('Resposta da API', {
				status: res.status,
				ok: res.ok,
				json,
			})

			if (res.ok && json.success) {
				const action = json.action ?? (existingId ? 'updated' : 'created')
				onAddSaveLog?.(
					'Salvamento bem-sucedido',
					{
						action,
					},
					true,
				)
				toast({ type: 'success', title: action === 'updated' ? 'Acontecimento atualizado' : 'Acontecimento criado' })
				onClose()
				onSaved?.()
			} else {
				onAddSaveLog?.(
					'Erro no salvamento',
					{
						message: json.message,
					},
					false,
					json.message,
				)
				toast({ type: 'error', title: json.message || 'Erro' })
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
			onAddSaveLog?.(
				'Erro na requisição',
				{
					error: errorMessage,
				},
				false,
				errorMessage,
			)
			toast({ type: 'error', title: 'Erro na requisição' })
		} finally {
			setLoading(false)
		}
	}

	const requireIncident = INCIDENT_STATUS.has(status as ProductStatus)
	const hasRealIncident = isRealIncident(incidentId)

	return (
		<Offcanvas open={open} onClose={onClose} title='Editar acontecimentos no turno' side='right' width='xl' zIndex={80}>
			{/* Bloco de contexto mais elegante */}
			<div className='mb-6 flex items-center gap-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-700/50 dark:bg-blue-950/20'>
				<div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-300'>
					<span className='icon-[lucide--calendar-clock] size-6'></span>
				</div>
				<div className='flex flex-col flex-1'>
					<span className='text-lg font-semibold text-blue-900 dark:text-blue-100'>{productName}</span>
					<div className='flex items-center gap-3 text-sm text-blue-700 dark:text-blue-300'>
						<span className='flex items-center gap-1'>
							<span className='icon-[lucide--calendar-days] size-4'></span>
							{formatDateBR(date)}
						</span>
						<span className='flex items-center gap-1'>
							<span className='icon-[lucide--clock] size-4'></span>
							{turn}h
						</span>
					</div>
				</div>
				{/* Botão de histórico */}
				{onViewHistory && (
					<Button icon='icon-[lucide--history]' style='bordered' onClick={onViewHistory} className='px-3 py-2' title='Ver histórico de status'>
						Histórico
					</Button>
				)}
			</div>

			<form onSubmit={handleSubmit} className='flex flex-col gap-4'>
				{/* Status e Incidentes na mesma linha */}
				<div className='flex gap-4'>
					<div className='flex-1'>
						<Label required>Status</Label>
						<Select name='status' options={STATUS_OPTIONS} selected={status} onChange={setStatus} placeholder='Selecione o status' required />
					</div>
					<div className='flex-1'>
						<Label required={requireIncident}>Incidentes</Label>
						<div className='flex items-center gap-2'>
							<Select name='incident' options={incidents} selected={incidentId ?? undefined} onChange={setIncidentId} placeholder='Selecione o incidente' required={requireIncident} />
							<Button icon='icon-[lucide--settings]' type='button' style='bordered' onClick={() => setIncidentManagementOpen(true)} className='px-3 py-3 h-12' title='Gerenciar incidentes'></Button>
						</div>
					</div>
				</div>
				{hasRealIncident && (
					<div>
						<Label required>Descrição de incidentes</Label>

						{/* Dicas de formatação Markdown */}
						<div className='mt-2 mb-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3'>
							<div className='flex items-start gap-3'>
								<span className='icon-[lucide--info] size-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0' />
								<div className='text-sm text-blue-700 dark:text-blue-300'>
									<p className='font-medium mb-1'>Dicas de formatação:</p>
									<ul className='text-sm'>
										<li>
											Use <code className='bg-blue-100 dark:bg-blue-800 px-1 rounded'>**negrito**</code> para destacar informações importantes e <code className='bg-blue-100 dark:bg-blue-800 px-1 rounded'>*itálico*</code> para ênfase
										</li>
										<li>
											Use <code className='bg-blue-100 dark:bg-blue-800 px-1 rounded'>- lista</code> para criar listas e <code className='bg-blue-100 dark:bg-blue-800 px-1 rounded'>`código`</code> para comandos ou erros
										</li>
									</ul>
								</div>
							</div>
						</div>

						<div className='mt-2'>
							<Markdown value={description} onChange={(value) => setDescription(value || '')} preview='edit' className='h-full w-full' height={250} compact />
						</div>
					</div>
				)}
				<div className='flex justify-end gap-2'>
					<Button style='bordered' type='button' onClick={onClose}>
						Cancelar
					</Button>
					<Button type='submit' disabled={loading}>
						{loading ? 'Salvando...' : 'Salvar'}
					</Button>
				</div>
			</form>

			{/* Offcanvas de gerenciamento de incidentes */}
			<IncidentManagementOffcanvas
				open={incidentManagementOpen}
				onClose={() => setIncidentManagementOpen(false)}
				onIncidentUpdated={() => {
					loadIncidents()
					onSaved?.()
				}}
			/>
		</Offcanvas>
	)
}
