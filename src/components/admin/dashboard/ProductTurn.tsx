import Popover from '@/components/ui/Popover'
import { formatDateBR } from '@/lib/dateUtils'
import { getStatusLabel, getStatusColor, ProductStatus, getStatusClasses as getCentralizedStatusClasses } from '@/lib/productStatus'

// Função para sanitizar e truncar descrição
function sanitizeDescription(description: string | null | undefined): string {
	if (!description) return ''

	// Remove HTML tags e caracteres especiais
	const sanitized = description
		.replace(/<[^>]*>/g, '') // Remove HTML tags
		.replace(/&[^;]+;/g, '') // Remove entidades HTML
		.replace(/[\r\n]+/g, ' ') // Substitui quebras de linha por espaços
		.replace(/\s+/g, ' ') // Remove espaços múltiplos
		.trim()

	// Trunca para máximo 4 linhas (aproximadamente 200 caracteres)
	const maxLength = 200
	if (sanitized.length <= maxLength) {
		return sanitized
	}

	return sanitized.substring(0, maxLength) + '...'
}

interface TurnCell {
	id?: string
	time: number
	status: string
	description?: string | null
	category_id?: string | null
	user_name?: string | null
}
interface DayItem {
	date: string
	turns: TurnCell[]
}
interface Props {
	productName: string
	days: DayItem[]
	onTurnClick?: (ctx: { id?: string; date: string; turn: number; status: string; description?: string | null; category_id?: string | null }) => void
}

// Função para obter classes CSS baseadas no status
const getStatusClasses = (status: string): string => {
	const color = getStatusColor(status as ProductStatus)
	return getCentralizedStatusClasses(color, 'timeline') // Usar mesma variante da barra de 28 dias
}

export default function ProductTurn({ productName, days, onTurnClick }: Props) {
	// Função para verificar se uma data é futura
	const isFutureDate = (date: string): boolean => {
		const today = new Date()
		const targetDate = new Date(date)
		today.setHours(0, 0, 0, 0)
		targetDate.setHours(0, 0, 0, 0)
		return targetDate > today
	}

	// Filtrar apenas dias passados/atuais (não futuros)
	const filteredDays = days.filter((day) => !isFutureDate(day.date))

	return (
		<div className='relative h-8'>
			<div className='flex gap-1'>
				{filteredDays.map((day, i) => {
					// Contar apenas turnos com incidentes reais (baseado em category_id, não status)
					const totalIncidents = day.turns.filter((t) => t.category_id && t.category_id !== 'no_incidents').length

					return (
						<Popover
							key={i}
							position='top-right'
							content={
								<div className='w-72 text-sm'>
									{/* Cabeçalho */}
									<div className='rounded-t-xl border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-700'>
										<div className='flex items-center gap-2'>
											<span className='icon-[lucide--calendar-days] size-5 shrink-0 text-zinc-400'></span>
											<span className='text-lg font-medium'>{productName}</span>
										</div>
									</div>

									{/* Turnos detalhados */}
									<ul className='px-2 py-1 space-y-0.5'>
										{day.turns.map((turn, index) => (
											<li
												key={index}
												onClick={() => {
													onTurnClick?.({ id: turn.id, date: day.date, turn: turn.time, status: turn.status, description: turn.description, category_id: turn.category_id })
												}}
												className='flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-zinc-50 dark:hover:bg-zinc-900'
											>
												<div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs ${getStatusClasses(turn.status)}`}>{turn.time}</div>
												<div className='flex flex-col'>
													<span className='font-medium'>{getStatusLabel(turn.status as ProductStatus)}.</span>
													{turn.description && (
														<span className='text-xs text-zinc-500 dark:text-zinc-400 line-clamp-4' title={turn.description}>
															{sanitizeDescription(turn.description)}
														</span>
													)}
												</div>
											</li>
										))}
									</ul>

									{/* Rodapé */}
									<div className='flex items-center justify-between rounded-b-xl border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'>
										<span>{formatDateBR(day.date)}</span>
										{totalIncidents > 0 && (
											<span className='flex items-center gap-1'>
												<span className='icon-[lucide--flag] size-4 shrink-0 text-zinc-400'></span>
												{totalIncidents} alerta{totalIncidents > 1 && 's'}
											</span>
										)}
									</div>
								</div>
							}
						>
							<div className='rounded-full bg-zinc-50 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-700'>
								<div className='flex gap-x-0.5 rounded-full p-1.5'>
									{day.turns.map((turn, index) => {
										// Função para truncar e limpar descrição
										const truncateDescription = (desc: string | null | undefined): string => {
											if (!desc) return ''
											// Remove quebras de linha e caracteres inválidos
											const cleaned = desc
												.replace(/[\r\n\t]+/g, ' ')
												.replace(/\s+/g, ' ')
												.trim()
											// Trunca em 60 caracteres
											return cleaned.length > 60 ? cleaned.substring(0, 60) + '...' : cleaned
										}

										// Construir tooltip individual para cada turno
										const dateFormatted = formatDateBR(day.date)
										const description = turn.description ? truncateDescription(turn.description) : ''
										const userName = turn.user_name ? ` (${turn.user_name})` : ''
										const tooltipContent = `${dateFormatted}\nTurno ${turn.time}: ${getStatusLabel(turn.status as ProductStatus)}${userName}${description ? ' - ' + description : ''}`

										return (
											<div key={index} className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-center text-xs hover:scale-110 transition-transform ${getStatusClasses(turn.status)}`} title={tooltipContent}>
												{turn.time}
											</div>
										)
									})}
								</div>
							</div>
						</Popover>
					)
				})}
			</div>
		</div>
	)
}
