import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDateBR as formatDateBRFromUtils } from './dateUtils'

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

// === FUNÇÕES DE FORMATAÇÃO DE DATAS COM FUSO HORÁRIO LOCAL ===

/**
 * Formata uma data para exibição no formato brasileiro (DD/MM/AAAA)
 * Usa fuso horário de São Paulo para evitar problemas de UTC
 */
export function formatDateBR(dateString: string | null): string {
	if (!dateString) return 'Não definida'

	// Usar função centralizada do dateUtils
	return formatDateBRFromUtils(dateString)
}

/**
 * Formata uma data para exibição completa no formato brasileiro
 * Inclui dia da semana, dia, mês e ano
 * Usa fuso horário de São Paulo para evitar problemas de UTC
 */
export function formatFullDateBR(dateString: string | null): string {
	if (!dateString) return 'Não definida'

	// Usar função centralizada do dateUtils
	return formatDateBRFromUtils(dateString)
}

/**
 * Cria uma data no fuso horário local de São Paulo
 * Evita problemas de conversão UTC
 */
export function createLocalDate(year: number, month: number, day: number): Date {
	return new Date(year, month, day) // Construtor local, não UTC
}

/**
 * Converte uma string de data para Date no fuso horário local
 * Garante que a data seja interpretada como local, não UTC
 */
export function parseLocalDate(dateString: string): Date {
	const [year, month, day] = dateString.split('-').map(Number)
	return new Date(year, month - 1, day) // month - 1 porque Date usa 0-11
}

export function normalizeUploadsSrc(input: string): string {
	const [pathPart, queryPart] = input.split('?')
	const query = queryPart ? `?${queryPart}` : ''
	const pathname = pathPart || ''

	if (pathname.startsWith('/uploads/')) return `${pathname}${query}`

	const uploadsIdx = pathname.indexOf('/uploads/')
	if (uploadsIdx !== -1) return `${pathname.slice(uploadsIdx)}${query}`

	const isAllowedKind = (kind: string): boolean =>
		kind === 'general' || kind === 'avatars' || kind === 'contacts' || kind === 'problems' || kind === 'solutions'

	const normalizePathname = (value: string): string => {
		if (!value.startsWith('/')) return value
		const segments = value.split('/').filter(Boolean)
		if (segments.length < 2) return value
		const [prefix, kind] = segments
		if (prefix === 'uploads') return value
		if (!isAllowedKind(kind)) return value
		return `/${['uploads', ...segments.slice(1)].join('/')}`
	}

	try {
		const url = new URL(input)
		const normalizedPathname = normalizePathname(url.pathname)
		if (normalizedPathname === url.pathname) return input
		return `${url.origin}${normalizedPathname}${url.search}`
	} catch {
		const normalizedPathname = normalizePathname(pathname)
		if (normalizedPathname === pathname) return input
		return `${normalizedPathname}${query}`
	}
}

/**
 * Transforma uma string em um slug seguro:
 * - Remove acentos (á, à, â, ã, ä, etc)
 * - Converte espaços em hífens
 * - Remove pontuações e símbolos especiais
 * - Mantém apenas letras [a-z], números [0-9] e hífens
 * - Exemplos:
 *   - formatSlug('Olá, mundo!') // "ola-mundo"
 *   - formatSlug('Àrvore com Ç e São João') // "arvore-com-c-e-sao-joao"
 *   - formatSlug('Espaço     em    excesso') // "espaco-em-excesso"
 *   - formatSlug('CRÁSE, TIL, CIRCUNFLEXO & TREMA üâêîôû') // "crase-til-circunflexo-trema-uaeiou"
 *   - formatSlug('AÇ~2[SDFA$%32;FD@`DFAF[}}³£¢54£5FGDSG') // "ac2sdfa32fddfaf545fgdsg"
 */
export function formatSlug(input: string): string {
	return input
		.normalize('NFD') // separa caracteres de acentos (ex: á → a + ́)
		.replace(/[\u0300-\u036f]/g, '') // remove os diacríticos combinados
		.replace(/[^a-zA-Z0-9\s-]/g, '') // remove qualquer outro caractere que não seja letra, número, espaço ou hífen
		.toLowerCase() // letras minúsculas
		.trim() // remove espaços no início/fim
		.replace(/\s+/g, '-') // espaços internos viram hífens
		.replace(/-+/g, '-') // hífens duplos/triplos viram um só
}
