/**
 * Definições centralizadas de status de produtos
 * Este arquivo é a única fonte de verdade para status, cores e labels
 */

export type ProductStatus = 'completed' | 'with_problems' | 'run_again' | 'not_run' | 'under_support' | 'suspended' | 'in_progress' | 'pending'

export type StatusColor = 'green' | 'orange' | 'red' | 'gray' | 'transparent' | 'blue' | 'violet' | 'yellow' | 'white'

export interface StatusOption {
	label: string
	value: ProductStatus
}

export interface StatusDefinition {
	status: ProductStatus
	label: string
	color: StatusColor
	description: string
}

/**
 * Opções de status para selects (usado no ProductActivityOffcanvas)
 */
export const STATUS_OPTIONS: StatusOption[] = [
	{ label: 'Concluído', value: 'completed' },
	{ label: 'Com problemas', value: 'with_problems' },
	{ label: 'Rodar novamente', value: 'run_again' },
	{ label: 'Não rodou', value: 'not_run' },
	{ label: 'Sob intervenção', value: 'under_support' },
	{ label: 'Suspenso', value: 'suspended' },
	{ label: 'Em execução', value: 'in_progress' },
	{ label: 'Pendente', value: 'pending' },
]

/**
 * Definições completas de cada status
 */
export const STATUS_DEFINITIONS: Record<ProductStatus, StatusDefinition> = {
	completed: {
		status: 'completed',
		label: 'Concluído',
		color: 'green',
		description: 'Produto executado com sucesso.',
	},
	with_problems: {
		status: 'with_problems',
		label: 'Com problemas',
		color: 'red',
		description: 'Produto rodou com problemas.',
	},
	run_again: {
		status: 'run_again',
		label: 'Rodar novamente',
		color: 'orange',
		description: 'Produto deve ser rodado novamente.',
	},
	not_run: {
		status: 'not_run',
		label: 'Não rodou',
		color: 'yellow',
		description: 'Produto não rodou durante o turno devido a algum problema.',
	},
	under_support: {
		status: 'under_support',
		label: 'Sob intervenção',
		color: 'violet',
		description: 'Sob intervenção do suporte técnico.',
	},
	suspended: {
		status: 'suspended',
		label: 'Suspenso',
		color: 'blue',
		description: 'Rodada suspensa temporariamente.',
	},
	in_progress: {
		status: 'in_progress',
		label: 'Em execução',
		color: 'gray',
		description: 'Produto rodando normalmente no turno atual.',
	},
	pending: {
		status: 'pending',
		label: 'Pendente',
		color: 'white',
		description: 'Quando ainda não deu a hora de executar e terminar a execução.',
	},
}

/**
 * Status padrão quando não há dados no banco
 * Usado quando um turno ainda não foi executado ou não há registro
 */
export const DEFAULT_STATUS: ProductStatus = 'pending'

/**
 * Status que são considerados incidentes
 */
export const INCIDENT_STATUS = new Set<ProductStatus>(['pending', 'under_support', 'suspended', 'not_run', 'with_problems', 'run_again'])

/**
 * Mapeia status para cor (usado no Product.tsx)
 */
export const getStatusColor = (status?: ProductStatus): StatusColor => {
	if (!status) return STATUS_DEFINITIONS[DEFAULT_STATUS].color // Usar cor do status padrão

	const definition = STATUS_DEFINITIONS[status]
	if (!definition) return STATUS_DEFINITIONS[DEFAULT_STATUS].color // Fallback para cor do status padrão

	return definition.color
}

/**
 * Mapeia status para label (usado no ProductCalendar.tsx)
 */
export const getStatusLabel = (status: ProductStatus): string => {
	return STATUS_DEFINITIONS[status]?.label || STATUS_DEFINITIONS[DEFAULT_STATUS].label
}

/**
 * Mapeia status para descrição (usado em tooltips)
 */
export const getStatusDescription = (status: ProductStatus): string => {
	return STATUS_DEFINITIONS[status]?.description || STATUS_DEFINITIONS[DEFAULT_STATUS].description
}

/**
 * Obtém definição completa de um status
 */
export const getStatusDefinition = (status: ProductStatus): StatusDefinition => {
	return STATUS_DEFINITIONS[status] || STATUS_DEFINITIONS[DEFAULT_STATUS]
}

/**
 * Ordem de severidade dos status (menor número = menos severo)
 * Usado para determinar qual status é mais crítico quando há conflitos
 *
 * LÓGICA DE PRIORIDADE DE CORES:
 * 1. Red (mais crítico) - with_problems
 * 2. Orange - run_again
 * 3. Yellow - not_run
 * 4. Violet - under_support
 * 5. Blue - suspended
 * 6. Gray - in_progress
 * 7. White - pending
 * 8. Green - completed (só se TODOS os turnos foram concluídos)
 */
export const STATUS_SEVERITY_ORDER: Record<ProductStatus, number> = {
	completed: 8, // Green - só se todos os turnos foram concluídos
	in_progress: 6, // Gray - rodando normalmente
	pending: 7, // White - ainda não chegou a hora
	under_support: 4, // Violet - sob intervenção
	suspended: 5, // Blue - suspenso
	not_run: 3, // Yellow - não rodou
	with_problems: 1, // Red - com problemas (mais crítico)
	run_again: 2, // Orange - rodar novamente
}

/**
 * Obtém a ordem de severidade de um status
 */
export const getStatusSeverity = (status: ProductStatus): number => {
	return STATUS_SEVERITY_ORDER[status] || 5
}

/**
 * Mapeia cores para classes CSS padronizadas
 * Tonalidades baseadas na barra de 28 dias (ProductTimeline) como referência
 * Garante consistência de tonalidade em todos os componentes
 */
export const getStatusClasses = (color: StatusColor, variant: 'timeline' | 'calendar' | 'stats' = 'timeline'): string => {
	switch (color) {
		case 'green':
			switch (variant) {
				case 'timeline':
					return 'bg-green-600 text-white' // Referência: barra de 28 dias
				case 'calendar':
					return 'bg-green-600' // Mesma tonalidade da timeline
				case 'stats':
					return 'bg-green-600' // Mesma tonalidade da timeline
			}
		case 'orange':
			switch (variant) {
				case 'timeline':
					return 'bg-orange-500 text-white' // Referência: barra de 28 dias
				case 'calendar':
					return 'bg-orange-500' // Mesma tonalidade da timeline
				case 'stats':
					return 'bg-orange-500' // Mesma tonalidade da timeline
			}
		case 'red':
			switch (variant) {
				case 'timeline':
					return 'bg-red-600 text-white' // Referência: barra de 28 dias
				case 'calendar':
					return 'bg-red-600' // Mesma tonalidade da timeline
				case 'stats':
					return 'bg-red-600' // Mesma tonalidade da timeline
			}
		case 'gray':
			switch (variant) {
				case 'timeline':
					return 'bg-zinc-300 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300' // Referência: barra de 28 dias
				case 'calendar':
					return 'bg-zinc-300 dark:bg-zinc-700' // Mesma tonalidade da timeline
				case 'stats':
					return 'bg-zinc-300 dark:bg-zinc-700' // Mesma tonalidade da timeline
			}
		case 'transparent':
			switch (variant) {
				case 'timeline':
					return 'bg-transparent border border-zinc-300 text-zinc-600 dark:border-zinc-700' // Referência: barra de 28 dias
				case 'calendar':
					return 'bg-transparent border border-zinc-300 dark:border-zinc-700' // Mesma tonalidade da timeline
				case 'stats':
					return 'bg-transparent border border-zinc-300 dark:border-zinc-700' // Mesma tonalidade da timeline
			}
		case 'blue':
			switch (variant) {
				case 'timeline':
					return 'bg-blue-500 text-white' // Referência: barra de 28 dias
				case 'calendar':
					return 'bg-blue-500' // Mesma tonalidade da timeline
				case 'stats':
					return 'bg-blue-500' // Mesma tonalidade da timeline
			}
		case 'violet':
			switch (variant) {
				case 'timeline':
					return 'bg-violet-500 text-white' // Referência: barra de 28 dias
				case 'calendar':
					return 'bg-violet-500' // Mesma tonalidade da timeline
				case 'stats':
					return 'bg-violet-500' // Mesma tonalidade da timeline
			}
		case 'yellow':
			switch (variant) {
				case 'timeline':
					return 'bg-yellow-500 text-white' // Referência: barra de 28 dias
				case 'calendar':
					return 'bg-yellow-500' // Mesma tonalidade da timeline
				case 'stats':
					return 'bg-yellow-500' // Mesma tonalidade da timeline
			}
		case 'white':
			switch (variant) {
				case 'timeline':
					return 'bg-white text-zinc-800 border border-zinc-300 dark:bg-zinc-100 dark:text-zinc-900' // Referência: barra de 28 dias
				case 'calendar':
					return 'bg-white border border-zinc-300 dark:bg-zinc-100' // Mesma tonalidade da timeline
				case 'stats':
					return 'bg-white border border-zinc-300 dark:bg-zinc-100' // Mesma tonalidade da timeline
			}
		default:
			return 'bg-zinc-200 dark:bg-zinc-700'
	}
}

/**
 * Determina a cor do dia baseado nos turnos
 * Lógica: Red > Orange > Yellow > Violet > Blue > Gray > White > Green (só se todos concluídos)
 */
export const getDayColorFromTurns = (turns: ProductStatus[]): StatusColor => {
	if (turns.length === 0) return 'white'

	// Verificar se todos os turnos foram concluídos
	const allCompleted = turns.every((status) => status === 'completed')
	if (allCompleted) return 'green'

	// Caso contrário, pegar o status mais severo
	const severities = turns.map((status) => getStatusSeverity(status))
	const maxSeverity = Math.max(...severities)

	// Mapear severidade para cor (menor número = mais crítico, exibir primeiro)
	if (maxSeverity >= 1) {
		// with_problems (red) - prioridade 1, mais crítico
		if (turns.includes('with_problems')) return 'red'
	}
	if (maxSeverity >= 2) {
		// run_again (orange) - prioridade 2
		if (turns.includes('run_again')) return 'orange'
	}
	if (maxSeverity >= 3) {
		// not_run (yellow) - prioridade 3
		if (turns.includes('not_run')) return 'yellow'
	}
	if (maxSeverity >= 4) {
		// under_support (violet) - prioridade 4
		if (turns.includes('under_support')) return 'violet'
	}
	if (maxSeverity >= 5) {
		// suspended (blue) - prioridade 5
		if (turns.includes('suspended')) return 'blue'
	}
	if (maxSeverity >= 6) {
		// in_progress (gray) - prioridade 6
		if (turns.includes('in_progress')) return 'gray'
	}
	if (maxSeverity >= 7) {
		// pending (white) - prioridade 7
		if (turns.includes('pending')) return 'white'
	}
	// completed (green) - prioridade 8, só se todos concluídos
	return 'green'
}
