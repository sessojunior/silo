'use client'

import { useEffect, useState, HTMLAttributes } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

interface ModalProps extends HTMLAttributes<HTMLDivElement> {
	isOpen: boolean
	onClose: () => void
	title?: string
	children: React.ReactNode
	showFooter?: boolean
}

export default function Modal({ isOpen, onClose, title, children, className, showFooter = false, ...props }: ModalProps) {
	const [visible, setVisible] = useState(false)
	const [shouldAnimateIn, setShouldAnimateIn] = useState(false)

	useEffect(() => {
		let openTimeout: NodeJS.Timeout
		let closeTimeout: NodeJS.Timeout

		if (isOpen) {
			setVisible(true)
			document.body.style.overflow = 'hidden'

			openTimeout = setTimeout(() => {
				setShouldAnimateIn(true)
			}, 10)
		} else {
			setShouldAnimateIn(false)
			closeTimeout = setTimeout(() => {
				setVisible(false)
				document.body.style.overflow = 'auto'
			}, 300)
		}

		return () => {
			clearTimeout(openTimeout)
			clearTimeout(closeTimeout)
			document.body.style.overflow = 'auto'
		}
	}, [isOpen])

	useEffect(() => {
		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose()
		}
		if (isOpen) window.addEventListener('keydown', handleEsc)
		return () => window.removeEventListener('keydown', handleEsc)
	}, [isOpen, onClose])

	if (!visible) return null

	return (
		<div tabIndex={-1} className={twMerge(clsx('fixed inset-0 z-80 flex size-full items-center justify-center overflow-x-hidden overflow-y-auto transition-opacity duration-500 ease-in-out', shouldAnimateIn ? 'opacity-100' : 'opacity-0 pointer-events-none', className))} {...props}>
			{/* Fundo escuro com fade */}
			<div className={twMerge(clsx('fixed inset-0 bg-black/25 transition-opacity duration-500', shouldAnimateIn ? 'opacity-100' : 'opacity-0'))} />

			{/* Container principal do modal */}
			<div className={twMerge(clsx('relative z-10 m-4 w-full max-w-4xl transform rounded-xl border border-zinc-200 bg-white shadow-sm transition-all duration-500 ease-in-out', 'dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-zinc-800/70', shouldAnimateIn ? 'opacity-100 scale-100' : 'opacity-0 scale-50'))}>
				{/* Cabeçalho */}
				<div className='flex items-center justify-between rounded-xl border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800'>
					<div className='flex gap-3'>
						<span className='icon-[lucide--folder-git-2] size-6 shrink-0 text-zinc-400 dark:text-zinc-500' />
						{title && <h3 className='font-bold text-zinc-800 dark:text-zinc-100'>{title}</h3>}
					</div>
					<button onClick={onClose} aria-label='Fechar modal' className='inline-flex size-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-800 hover:bg-zinc-200 focus:bg-zinc-200 focus:outline-none dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600'>
						<span className='sr-only'>Fechar</span>
						<span className='icon-[lucide--x] size-4 shrink-0 text-zinc-400 dark:text-zinc-400' />
					</button>
				</div>

				{/* Conteúdo */}
				<div className='flex flex-col divide-y divide-zinc-200 dark:divide-zinc-700'>{children}</div>

				{/* Rodapé (opcional) */}
				{showFooter && (
					<div className='flex items-center justify-end gap-x-2 rounded-xl border-t border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800'>
						<button onClick={onClose} aria-label='Fechar modal' className='inline-flex items-center gap-x-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-2xs hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800'>
							Fechar
						</button>
					</div>
				)}
			</div>
		</div>
	)
}
