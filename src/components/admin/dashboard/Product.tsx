'use client'

import { useState, useMemo } from 'react'

import ProductTimeline from '@/components/admin/dashboard/ProductTimeline'
import ProductTurn from '@/components/admin/dashboard/ProductTurn'
import ProductCalendar from '@/components/admin/dashboard/ProductCalendar'
import Modal from '@/components/ui/Modal'
import ProductActivityOffcanvas from '@/components/admin/dashboard/ProductActivityOffcanvas'
import ProductStatusHistoryOffcanvas from '@/components/admin/dashboard/ProductStatusHistoryOffcanvas'
import { STATUS_DEFINITIONS, ProductStatus, StatusColor, getStatusSeverity, getStatusColor, getStatusClasses as getCentralizedStatusClasses, DEFAULT_STATUS } from '@/lib/productStatus'

interface ProductDateStatus {
	id?: string
	date: string
	turn: number
	status: string
	description?: string | null
	category_id?: string | null
	user_name?: string | null
}

interface ProductProps {
	id: string
	name: string
	turns: string[]
	progress: number
	priority: string
	date: string
	lastDaysStatus: ProductDateStatus[]
	last28DaysStatus: ProductDateStatus[] // para timeline
	calendarStatus: ProductDateStatus[] // para calendário 3 meses
	onSaved?: () => void
	onAddSaveLog?: (step: string, details: unknown, success?: boolean, error?: string) => void
}

export default function Product({ id, name, turns, progress, priority, date, lastDaysStatus, last28DaysStatus, calendarStatus, onSaved, onAddSaveLog }: ProductProps) {
	const [isModalOpen, setIsModalOpen] = useState(false)
	const [activityCtx, setActivityCtx] = useState<{ id?: string; date: string; turn: number; status: string; description?: string | null; category_id?: string | null } | null>(null)
	const [activityPanelOpen, setActivityPanelOpen] = useState(false)
	const [historyPanelOpen, setHistoryPanelOpen] = useState(false)

	// Função para abrir o histórico
	const handleViewHistory = () => {
		setHistoryPanelOpen(true)
	}

	// Filtra status conforme turnos configurados do produto
	const filteredLastDays = useMemo(() => {
		const result = lastDaysStatus.filter((d) => turns.includes(String(d.turn)))
		return result
	}, [lastDaysStatus, turns])
	// A timeline de 28 dias é agregada por dia; não deve ser filtrada por turno
	const filteredCalendar = useMemo(() => calendarStatus.filter((d) => turns.includes(String(d.turn))), [calendarStatus, turns])

	// Usar status de 28 dias para a timeline (filtrados por turnos para consistência)
	const timelineStatuses = last28DaysStatus.filter((d) => turns.includes(String(d.turn))).map((d) => d.status)

	// Build days array for ProductTurn - timeline completa dos últimos turnos
	const days = useMemo(() => {
		const daysMap: Record<string, { date: string; turns: { id?: string; time: number; status: string; description?: string | null; category_id?: string | null; user_name?: string | null }[] }> = {}

		// Primeiro, criar entradas para todos os dias dos últimos turnos
		const lastDaysDates = [...new Set(lastDaysStatus.map((d) => d.date))]
		lastDaysDates.forEach((date) => {
			daysMap[date] = { date, turns: [] }
		})

		// Para cada dia dos últimos turnos, garantir que todos os turnos configurados apareçam
		filteredLastDays.forEach((d) => {
			const existingTurn = daysMap[d.date].turns.find((t) => t.time === d.turn)
			if (!existingTurn) {
				daysMap[d.date].turns.push({ id: d.id, time: d.turn, status: d.status, description: d.description, category_id: d.category_id, user_name: d.user_name })
			} else {
				// Se já existe, escolher status mais severo (orange/red substitui green) – simples prioridade
				if (getStatusSeverity(d.status as ProductStatus) > getStatusSeverity(existingTurn.status as ProductStatus)) {
					existingTurn.status = d.status
					existingTurn.description = d.description
					existingTurn.category_id = d.category_id
					existingTurn.id = d.id
					existingTurn.user_name = d.user_name
				}
			}
		})

		// Garantir que todos os turnos configurados apareçam para cada dia
		Object.values(daysMap).forEach((day) => {
			turns.forEach((turnStr) => {
				const turnNum = parseInt(turnStr)
				const existingTurn = day.turns.find((t) => t.time === turnNum)
				if (!existingTurn) {
					// Verificar se existe um registro no banco para este turno
					const dbRecord = lastDaysStatus.find((d) => d.date === day.date && d.turn === turnNum)
					if (dbRecord) {
						// Se existe no banco, usar os dados reais
						day.turns.push({
							id: dbRecord.id,
							time: turnNum,
							status: dbRecord.status,
							description: dbRecord.description,
							category_id: dbRecord.category_id,
							user_name: dbRecord.user_name,
						})
					} else {
						// Se não existe no banco, criar com status padrão sem ID
						day.turns.push({
							time: turnNum,
							status: DEFAULT_STATUS,
							description: null,
							category_id: null,
							user_name: null,
						})
					}
				}
			})
			// Ordenar turnos por horário
			day.turns.sort((a, b) => a.time - b.time)
		})

		const result = Object.values(daysMap).sort((a, b) => a.date.localeCompare(b.date))

		return result
	}, [lastDaysStatus, filteredLastDays, turns])

	/* ----------- Construção de calendários para os últimos 28 dias ----------- */
	type CalendarDate = {
		dateWeek: string
		dateDay: number
		dateTurns: { dateTurn: number; dateStatus: 'green' | 'orange' | 'red' | 'gray' | 'transparent' | 'blue' | 'violet' | 'yellow' | 'white'; realStatus: string }[]
	}

	type Calendar = { year: number; month: number; dates: CalendarDate[] }

	const dayOfWeekName = (d: number): string => ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d]

	// Função para gerar classes CSS da legenda baseadas na cor do status
	const getLegendClasses = (color: string): string => {
		return getCentralizedStatusClasses(color as StatusColor, 'stats') // Mesma tonalidade da timeline
	}

	// Mapa status por (date + turn) para calendário
	const statusMap = new Map<string, string>()
	filteredCalendar.forEach((d) => {
		statusMap.set(`${d.date}_${d.turn}`, d.status)
	})

	// Gera lista dos 3 últimos meses a partir da data atual (mês atual primeiro)
	// Usar fuso horário de São Paulo, Brasil (UTC-3)
	const now = new Date()
	const saoPauloFormatter = new Intl.DateTimeFormat('pt-BR', {
		timeZone: 'America/Sao_Paulo',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	})

	const parts = saoPauloFormatter.formatToParts(now)
	const year = parts.find((part) => part.type === 'year')?.value
	const month = parts.find((part) => part.type === 'month')?.value
	const day = parts.find((part) => part.type === 'day')?.value

	const today = new Date(parseInt(year!), parseInt(month!) - 1, parseInt(day!))
	const monthsArr: string[] = []
	for (let i = 0; i < 3; i++) {
		const dt = new Date(today.getFullYear(), today.getMonth() - i, 1)
		const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
		monthsArr.push(ym)
	}
	// Não ordenar - manter ordem: atual, anterior, mais anterior

	const calendars: Calendar[] = monthsArr.map((ym) => {
		const [yearStr, monthStr] = ym.split('-')
		const year = Number(yearStr)
		const month = Number(monthStr) // 1-12

		const daysInMonth = new Date(Number(yearStr), month, 0).getDate()
		const dates: CalendarDate[] = []

		for (let day = 1; day <= daysInMonth; day++) {
			const dateStr = `${ym}-${String(day).padStart(2, '0')}`
			const weekName = dayOfWeekName(new Date(dateStr).getDay())

			const dateTurns = turns.map((t) => {
				const turnNum = parseInt(t)
				const realStatus = statusMap.get(`${dateStr}_${turnNum}`)
				const statusColor = getStatusColor((realStatus as ProductStatus) || DEFAULT_STATUS)
				return {
					dateTurn: turnNum,
					dateStatus: statusColor, // Usar cor individual do turno
					realStatus: realStatus || DEFAULT_STATUS, // Status real para tooltip - status padrão quando não há dados
				}
			})
			dates.push({ dateWeek: weekName, dateDay: day, dateTurns })
		}

		return { year, month, dates }
	})

	return (
		<>
			<div key={id} className='flex flex-col rounded-lg border border-dashed border-zinc-200 bg-white p-4 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800'>
				<div className='flex items-center justify-between'>
					{/* Produto */}
					<div className='flex flex-col'>
						<div className='flex items-center gap-2'>
							<span className='icon-[lucide--folder-git-2] size-5 shrink-0 text-zinc-400'></span>
							<span className='text-lg font-medium'>{name}</span>
						</div>
						<div className='text-sm'>
							<span title='Porcentagem de turnos concluídos nos últimos 28 dias'>{progress}%</span> <span className='text-zinc-300'>•</span>
							<span title='Data da última atividade registrada'>{date}</span>
						</div>
					</div>

					{/* Barra de turno */}
					<div className='flex flex-col'>
						<ProductTurn
							productName={name}
							days={days}
							onTurnClick={(ctx) => {
								setActivityCtx({ id: ctx.id, date: ctx.date, turn: ctx.turn, status: ctx.status, description: ctx.description, category_id: ctx.category_id })
								setActivityPanelOpen(true)
							}}
						/>
					</div>
				</div>
				<div className='mt-1.5 flex items-center justify-between'>
					{/* Modal Trigger - DIV ao invés de BUTTON */}
					<div onClick={() => setIsModalOpen(true)} className='rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 cursor-pointer'>
						{/* Linha do tempo */}
						<ProductTimeline
							statuses={timelineStatuses}
							timelineData={last28DaysStatus
								.filter((d) => turns.includes(String(d.turn)))
								.map((d) => ({
									date: d.date,
									turn: d.turn,
									status: d.status,
									description: d.description,
									category_id: d.category_id,
								}))}
						/>
					</div>

					{/* Prioridade */}
					<div className='flex items-center text-xs leading-none'>
						{priority == 'urgent' && (
							<div className='inline-block rounded-md bg-red-100 px-2 py-1.5 dark:bg-red-600' title='Prioridade Urgente'>
								<span className='text-xs font-medium text-nowrap text-red-500 uppercase dark:text-white'>Urgente</span>
							</div>
						)}
						{priority == 'high' && (
							<div className='inline-block rounded-md bg-orange-100 px-2 py-1.5 dark:bg-red-600' title='Prioridade Alta'>
								<span className='text-xs font-medium text-nowrap text-red-500 uppercase dark:text-white'>Alta</span>
							</div>
						)}
						{priority == 'normal' && (
							<div className='inline-block rounded-md bg-orange-100 px-2 py-1.5 dark:bg-orange-600' title='Prioridade Normal'>
								<span className='text-xs font-medium text-nowrap text-orange-500 uppercase dark:text-white'>Normal</span>
							</div>
						)}
						{priority == 'low' && (
							<div className='inline-block rounded-md bg-green-200 px-2 py-1.5 dark:bg-green-700' title='Prioridade Baixa'>
								<span className='text-xs font-medium text-nowrap text-green-600 uppercase dark:text-white'>Baixa</span>
							</div>
						)}
					</div>
				</div>
			</div>
			<Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Detalhes de ${name}`}>
				{/* Calendário gerado dinamicamente (últimos 28 dias) */}
				{calendars.map((cal, idx) => (
					<ProductCalendar
						key={idx}
						calendar={cal}
						turns={turns}
						onDotClick={({ date: d, turn }) => {
							// Buscar dados reais do turno, se existirem
							const target = filteredCalendar.find((ds) => ds.date === d && ds.turn === turn)

							// Se não encontrou dados reais, criar contexto com status padrão
							if (target) {
								setActivityCtx({
									id: target.id,
									date: target.date,
									turn: target.turn,
									status: target.status,
									description: target.description,
									category_id: target.category_id,
								})
							} else {
								// Turno sem registro - usar status padrão 'not_run'
								setActivityCtx({
									date: d,
									turn: turn,
									status: 'not_run',
									description: null,
									category_id: null,
								})
							}

							setActivityPanelOpen(true)
						}}
					/>
				))}

				{/* Legenda */}
				<div className='p-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm'>
					{Object.values(STATUS_DEFINITIONS).map((statusDef) => (
						<div key={statusDef.status} className='flex items-center gap-1.5' title={statusDef.description}>
							<span className={`size-3 rounded-full ${getLegendClasses(statusDef.color)}`}></span> {statusDef.label}
						</div>
					))}
				</div>
			</Modal>

			{/* Offcanvas edição de turno */}
			{activityCtx && (
				<ProductActivityOffcanvas
					open={activityPanelOpen}
					onClose={() => setActivityPanelOpen(false)}
					productId={id}
					productName={name}
					date={activityCtx.date}
					turn={activityCtx.turn}
					existingId={activityCtx.id || null}
					initialStatus={activityCtx.status}
					initialDescription={activityCtx.description || ''}
					initialCategoryId={activityCtx.category_id || null}
					onSaved={() => {
						onSaved?.()
					}}
					onAddSaveLog={onAddSaveLog}
					onViewHistory={handleViewHistory}
				/>
			)}

			{/* Offcanvas histórico de status */}
			{activityCtx && <ProductStatusHistoryOffcanvas open={historyPanelOpen} onClose={() => setHistoryPanelOpen(false)} productId={id} productName={name} date={activityCtx.date} turn={activityCtx.turn} />}
		</>
	)
}
