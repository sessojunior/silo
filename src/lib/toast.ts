let id = 0

export type ToastType = 'success' | 'error' | 'info' | 'warning'
export type ToastPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface ToastOptions {
	type: ToastType
	title: string
	description?: string
	duration?: number // Em segundos
	position?: ToastPosition
}

export function toast({ type, title, description, duration = 5, position = 'top-right' }: ToastOptions) {
	const detail = {
		id: ++id,
		type,
		title,
		description,
		duration: duration * 1000, // Converte para milissegundos
		position,
	}

	window.dispatchEvent(new CustomEvent('toast', { detail }))
}
