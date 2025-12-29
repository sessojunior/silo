'use client'

import { useCallback, useEffect, useState } from 'react'
import { clsx } from 'clsx'

type ToastType = 'success' | 'error' | 'info' | 'warning'
type ToastPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

interface ToastMessage {
	id: number
	type: ToastType
	title: string
	description?: string
	duration: number
	position: ToastPosition
}

interface ToastWithState extends ToastMessage {
	isLeaving?: boolean
}

const positionClasses: Record<ToastPosition, string> = {
	'top-left': 'top-5 left-5',
	'top-right': 'top-5 right-5',
	'bottom-left': 'bottom-5 left-5',
	'bottom-right': 'bottom-5 right-5',
}

const toastColors: Record<ToastType, string> = {
	success: 'bg-green-600',
	error: 'bg-red-600',
	info: 'bg-blue-600',
	warning: 'bg-yellow-600',
}

const toastIcons: Record<ToastType, string> = {
	success: 'icon-[lucide--check-circle]',
	error: 'icon-[lucide--x-circle]',
	info: 'icon-[lucide--info]',
	warning: 'icon-[lucide--alert-triangle]',
}

export default function ToastContainer() {
	const [toasts, setToasts] = useState<ToastWithState[]>([])

	const dismiss = useCallback((id: number) => {
		setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, isLeaving: true } : t)))

		// Tempo da animação de saída antes de remover do DOM
		setTimeout(() => {
			setToasts((prev) => prev.filter((t) => t.id !== id))
		}, 400) // mesma duração da animação .toast-out
	}, [])

	useEffect(() => {
		const handler = (event: Event) => {
			const customEvent = event as CustomEvent<ToastMessage>
			const toast = customEvent.detail
			setToasts((prev) => [...prev, { ...toast }])

			if (toast.duration) {
				setTimeout(() => dismiss(toast.id), toast.duration)
			}
		}

		window.addEventListener('toast', handler)
		return () => window.removeEventListener('toast', handler)
	}, [dismiss])

	// CSS Styles inline para as animações do Toast
	const styles = `
		@keyframes progress-bar {
			from {
				width: 100%;
			}
			to {
				width: 0%;
			}
		}

		@keyframes toast-in {
			from {
				opacity: 0;
				transform: translateY(-20px);
			}
			to {
				opacity: 1;
				transform: translateY(0);
			}
		}

		@keyframes toast-out {
			from {
				opacity: 1;
				transform: translateY(0);
			}
			to {
				opacity: 0;
				transform: translateY(-20px);
			}
		}

		.animate-progress-bar {
			animation: progress-bar linear forwards;
		}

		.animate-toast-in {
			animation: toast-in 0.5s ease forwards;
		}

		.animate-toast-out {
			animation: toast-out 0.5s ease forwards;
		}
	`

	return (
		<>
			{/* Inject styles */}
			<style dangerouslySetInnerHTML={{ __html: styles }} />

			{(Object.keys(positionClasses) as ToastPosition[]).map((position) => (
				<div key={position} className={clsx('fixed z-[1000] flex flex-col gap-3 pointer-events-none', positionClasses[position])}>
					{toasts
						.filter((toast) => toast.position === position)
						.map((toast) => (
							<div key={toast.id} className={clsx('relative flex items-start gap-3 pointer-events-auto w-80 rounded-lg p-4 text-white shadow-md overflow-hidden', toastColors[toast.type], toast.isLeaving ? 'animate-toast-out' : 'animate-toast-in')} role='alert'>
								<span className={clsx(toastIcons[toast.type], 'size-5 shrink-0')} />

								<div className='flex-1 text-sm'>
									<strong className='block mt-px font-semibold leading-tight'>{toast.title}</strong>
									{toast.description && <p className='mt-1 text-sm opacity-90 leading-tight'>{toast.description}</p>}

									{toast.duration > 0 && (
										<div
											className='absolute bottom-0 left-0 h-1 bg-white/30 animate-progress-bar'
											style={{
												animationDuration: `${toast.duration}ms`,
											}}
										/>
									)}
								</div>

								<button onClick={() => dismiss(toast.id)} className='opacity-75 transition hover:opacity-100' aria-label='Fechar'>
									<span className='icon-[lucide--x] size-4'></span>
								</button>
							</div>
						))}
				</div>
			))}
		</>
	)
}
