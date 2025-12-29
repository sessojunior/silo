import React, { useEffect, useRef } from 'react'

interface DialogProps {
	open: boolean
	onClose: () => void
	title?: React.ReactNode
	description?: string
	children?: React.ReactNode
}

// Componente de modal genérico
export default function Dialog({ open, onClose, title, description, children }: DialogProps) {
	const dialogRef = useRef<HTMLDivElement>(null)
	const contentRef = useRef<HTMLDivElement>(null)

	// Fecha ao pressionar ESC
	useEffect(() => {
		if (!open) return
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') onClose()
		}
		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [open, onClose])

	// Fecha ao clicar fora
	function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
		// Só fecha se o clique foi realmente fora do conteúdo
		if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
			onClose()
		}
	}

	if (!open) return null

	return (
		<div ref={dialogRef} className='fixed inset-0 z-[200] flex items-center justify-center bg-black/40' onClick={handleOverlayClick} aria-modal='true' role='dialog' tabIndex={-1}>
			<div ref={contentRef} className='bg-white dark:bg-zinc-800 rounded-lg shadow-lg max-w-full w-[90vw] sm:w-[400px] p-6 animate-fade-in relative flex flex-col'>
				{/* Botão de fechar */}
				<button onClick={onClose} className='absolute top-4 right-4 p-1 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors' aria-label='Fechar'>
					<span className='icon-[lucide--x] size-4' />
				</button>

				{title && <h2 className='text-lg font-semibold mb-2 text-zinc-900 dark:text-zinc-100 pr-8'>{title}</h2>}
				{description && <p className='text-zinc-600 dark:text-zinc-400 mb-4'>{description}</p>}
				<div className='text-zinc-900 dark:text-zinc-100 flex-1 overflow-hidden'>{children}</div>
			</div>
		</div>
	)
}
