import { getStatusLabel, ProductStatus, StatusColor, getStatusClasses as getCentralizedStatusClasses } from '@/lib/productStatus'

interface DateTurn {
	dateTurn: number
	dateStatus: 'green' | 'orange' | 'red' | string
	realStatus: string
}

interface CalendarDate {
	dateWeek: string
	dateDay: number
	dateTurns: DateTurn[]
}

interface Calendar {
	year: number
	month: number
	dates: CalendarDate[]
}

interface ProductCalendarProps {
	calendar: Calendar
	turns: string[]
	onDotClick?: (ctx: { date: string; turn: number }) => void
}

export default function ProductCalendar({ calendar, turns, onDotClick }: ProductCalendarProps) {
	const monthFullName = (month: number): string => ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][month - 1] || ''
	const weekDayLetter = (day: string): string => ({ sunday: 'D', monday: 'S', tuesday: 'T', wednesday: 'Q', thursday: 'Q', friday: 'S', saturday: 'S' })[day.toLowerCase()] || ''
	const turnNumbers = turns.map((t) => parseInt(t))

	// Função para verificar se uma data é futura
	const isFutureDate = (date: string): boolean => {
		// Obter data atual em São Paulo usando Intl.DateTimeFormat
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

		// Data de hoje em São Paulo (meia-noite)
		const today = new Date(parseInt(year!), parseInt(month!) - 1, parseInt(day!))

		// Data alvo (meia-noite) - usar parsing explícito para evitar problemas de timezone
		const targetDate = new Date(date + 'T00:00:00')
		targetDate.setHours(0, 0, 0, 0)

		// Comparação
		const isFuture = targetDate.getTime() > today.getTime()

		return isFuture
	}

	// Classes Tailwind
	const turn = 'flex h-6 items-center justify-end px-1.5 text-center text-sm font-semibold text-zinc-400 dark:text-zinc-400'
	const dayNormal = 'py-2 flex-col rounded-sm bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800'
	const dayWeekend = 'py-2 bg-amber-50 rounded-sm hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-600'
	const dayWeekNormal = 'flex h-6 w-6 items-center justify-center text-base text-zinc-300 dark:text-zinc-500'
	const dayWeekWeekend = 'flex h-6 w-6 items-center justify-center text-base text-zinc-400 dark:text-zinc-500'
	const dayNumber = 'flex h-6 w-6 items-center justify-center text-sm font-semibold text-zinc-400 dark:text-zinc-400'
	const dayTurn = 'flex h-6 w-6 items-center justify-center'
	const dayButton = 'flex h-4 w-4 items-center justify-center rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-600'
	// Função para obter classes CSS dos pontos do calendário
	const getDayClasses = (color: string): string => {
		const baseClasses = 'h-2.5 w-2.5 rounded-full'
		const statusClasses = getCentralizedStatusClasses(color as StatusColor, 'calendar') // Mesma tonalidade da timeline
		return `${baseClasses} ${statusClasses}`
	}
	const monthName = 'flex h-6 w-24 items-center justify-end px-1.5 text-base font-semibold text-zinc-400 dark:text-zinc-400'

	return (
		<div className='flex'>
			{/* Turnos */}
			<div className='flex-col py-2'>
				<div className={monthName}>{monthFullName(calendar.month)}</div>
				<div className='h-6 w-6'></div>
				{turnNumbers.map((turnValue, index) => (
					<div key={index} className={turn}>
						{turnValue}
					</div>
				))}
			</div>

			{/* Dias do mês */}
			{calendar.dates.map((date, index) => (
				<div
					key={index}
					className={`${date.dateWeek === 'saturday' || date.dateWeek === 'sunday' ? dayWeekend : dayNormal}
							${index === 0 ? 'border-r border-l border-zinc-200 dark:border-zinc-700' : ''}
							${index !== calendar.dates.length - 1 ? 'border-r border-zinc-200 dark:border-zinc-700' : ''}`}
				>
					<div className={date.dateWeek === 'saturday' || date.dateWeek === 'sunday' ? dayWeekWeekend : dayWeekNormal}>{weekDayLetter(date.dateWeek)}</div>
					<div className={dayNumber}>{date.dateDay}</div>

					{/* Turnos */}
					{date.dateTurns.map((turn, index) => {
						const fullDate = `${calendar.year}-${String(calendar.month).padStart(2, '0')}-${String(date.dateDay).padStart(2, '0')}`
						const isFuture = isFutureDate(fullDate)

						return (
							<div key={index} className={dayTurn}>
								{!isFuture && (
									// Dia passado/atual - com clique (dias futuros não aparecem)
									<button
										type='button'
										onClick={() => {
											onDotClick?.({ date: fullDate, turn: turn.dateTurn })
										}}
										className={dayButton}
										title={`Turno ${turn.dateTurn}h - ${getStatusLabel(turn.realStatus as ProductStatus)}`}
									>
										<div className={getDayClasses(turn.dateStatus)}></div>
									</button>
								)}
							</div>
						)
					})}
				</div>
			))}
		</div>
	)
}
