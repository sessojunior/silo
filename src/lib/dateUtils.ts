/**
 * Utilitários de data para o projeto SILO
 * Timezone: São Paulo (America/Sao_Paulo)
 *
 * Este arquivo centraliza todas as operações de data do projeto
 * para garantir consistência de timezone em toda a aplicação.
 */

import { DATE_CONFIG } from './dateConfig'

export const TIMEZONE = DATE_CONFIG.TIMEZONE
export const DATE_FORMAT = DATE_CONFIG.DATE_FORMAT
export const DATETIME_FORMAT = DATE_CONFIG.DATETIME_FORMAT
export const DISPLAY_DATE_FORMAT = DATE_CONFIG.DISPLAY_DATE_FORMAT
export const DISPLAY_DATETIME_FORMAT = DATE_CONFIG.DISPLAY_DATETIME_FORMAT

/**
 * Obtém a data atual no timezone de São Paulo
 */
export function getToday(): string {
	const now = new Date()
	const saoPauloDate = new Date(now.toLocaleString('en-US', { timeZone: DATE_CONFIG.TIMEZONE }))
	return saoPauloDate.toISOString().split('T')[0] // YYYY-MM-DD
}

/**
 * Obtém a data atual no timezone de São Paulo como Date
 */
export function getTodayDate(): Date {
	const now = new Date()
	return new Date(now.toLocaleString('en-US', { timeZone: DATE_CONFIG.TIMEZONE }))
}

/**
 * Formata uma data para o formato YYYY-MM-DD no timezone de São Paulo
 */
export function formatDate(date: Date | string): string {
	const dateObj = typeof date === 'string' ? new Date(date) : date
	const saoPauloDate = new Date(dateObj.toLocaleString('en-US', { timeZone: DATE_CONFIG.TIMEZONE }))
	return saoPauloDate.toISOString().split('T')[0]
}

/**
 * Converte uma string de data para Date no timezone de São Paulo
 */
export function parseDate(dateString: string): Date {
	const date = new Date(dateString + 'T00:00:00')
	return new Date(date.toLocaleString('en-US', { timeZone: DATE_CONFIG.TIMEZONE }))
}

/**
 * Obtém a data de N dias atrás no timezone de São Paulo
 */
export function getDaysAgo(days: number): string {
	const today = getTodayDate()
	today.setDate(today.getDate() - days)
	return formatDate(today)
}

/**
 * Obtém a data de N meses atrás no timezone de São Paulo
 */
export function getMonthsAgo(months: number): string {
	const today = getTodayDate()
	today.setMonth(today.getMonth() - months)
	today.setDate(1) // Primeiro dia do mês
	return formatDate(today)
}

/**
 * Verifica se uma data é hoje no timezone de São Paulo
 */
export function isToday(dateString: string): boolean {
	return dateString === getToday()
}

/**
 * Obtém o timestamp atual no timezone de São Paulo
 */
export function getNowTimestamp(): string {
	const now = new Date()
	return now.toLocaleString('en-US', { timeZone: DATE_CONFIG.TIMEZONE })
}

/**
 * Converte uma data para o formato de exibição brasileiro
 */
export function formatDateBR(dateString: string): string {
	const date = parseDate(dateString)
	return date.toLocaleDateString(DATE_CONFIG.LOCALE)
}

/**
 * Converte uma data para o formato de exibição brasileiro com hora
 */
export function formatDateTimeBR(dateString: string, timeString?: string): string {
	const date = parseDate(dateString)
	if (timeString) {
		const [hours, minutes] = timeString.split(':')
		date.setHours(parseInt(hours), parseInt(minutes), 0, 0)
	}
	return date.toLocaleString(DATE_CONFIG.LOCALE, {
		timeZone: DATE_CONFIG.TIMEZONE,
	})
}

/**
 * Converte uma data para o formato de exibição brasileiro com data e hora completas
 * Formato: dd/mm/yyyy, hh:mm:ss
 */
export function formatDateTimeFullBR(dateString: string): string {
	if (!dateString) return 'Data inválida'

	let date: Date

	// Se a string já contém hora (formato YYYY-MM-DD HH:mm:ss), usar diretamente
	if (dateString.includes(' ')) {
		date = new Date(dateString.replace(' ', 'T'))
	} else {
		// Se for apenas data (YYYY-MM-DD), usar parseDate
		date = parseDate(dateString)
	}

	// Verificar se a data é válida
	if (isNaN(date.getTime())) {
		return 'Data inválida'
	}

	return date.toLocaleString(DATE_CONFIG.LOCALE, {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
		timeZone: DATE_CONFIG.TIMEZONE,
	})
}

/**
 * Converte uma data para o formato de exibição brasileiro com data e hora (sem segundos)
 * Formato: dd/mm/yyyy, hh:mm
 */
export function formatDateTimeShortBR(dateString: string): string {
	if (!dateString) return 'Data inválida'

	let date: Date

	// Se a string já contém hora (formato YYYY-MM-DD HH:mm:ss), usar diretamente
	if (dateString.includes(' ')) {
		date = new Date(dateString.replace(' ', 'T'))
	} else {
		// Se for apenas data (YYYY-MM-DD), usar parseDate
		date = parseDate(dateString)
	}

	// Verificar se a data é válida
	if (isNaN(date.getTime())) {
		return 'Data inválida'
	}

	return date.toLocaleString(DATE_CONFIG.LOCALE, {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		timeZone: DATE_CONFIG.TIMEZONE,
	})
}
