import React, { useEffect, useRef } from 'react'

const WIDTH_MAP = {
	sm: '320px',
	md: '480px',
	lg: '640px',
	xl: '800px',
}

interface OffcanvasProps {
	open: boolean
	onClose: () => void
	title?: React.ReactNode
	children: React.ReactNode
	side?: 'right' | 'left'
	width?: 'sm' | 'md' | 'lg' | 'xl' | string
	zIndex?: number
}

export default function Offcanvas({ open, onClose, title, children, side = 'right', width = 'md', zIndex = 70 }: OffcanvasProps) {
	const ref = useRef<HTMLDivElement>(null)
	const panelRef = useRef<HTMLDivElement>(null)

	// Fecha ao pressionar ESC
	useEffect(() => {
		if (!open) return
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') onClose()
		}
		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [open, onClose])

	if (!open) return null

	// Calcula largura
	let panelWidth = WIDTH_MAP[width as keyof typeof WIDTH_MAP] || width
	if (!panelWidth) panelWidth = '480px'

	return (
		<div ref={ref} className='fixed inset-0 flex' style={{ justifyContent: side === 'right' ? 'flex-end' : 'flex-start', zIndex }} aria-modal='true' role='dialog' tabIndex={-1}>
			<div
				ref={panelRef}
				className={`h-full bg-white shadow-xl flex flex-col transition-transform duration-300 ease-in-out dark:bg-zinc-800 ` + (side === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left')}
				style={{
					width: panelWidth,
					maxWidth: '100vw',
				}}
			>
				<div className='flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-700'>
					{title && <div className='font-semibold text-lg text-zinc-900 dark:text-zinc-100'>{title}</div>}
					<button onClick={onClose} className='flex items-center justify-center size-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition' aria-label='Fechar painel'>
						<span className='icon-[lucide--x] size-5 text-zinc-500 dark:text-zinc-400' />
					</button>
				</div>
				<div className='flex-1 overflow-y-auto p-6 text-zinc-900 dark:text-zinc-100'>{children}</div>
			</div>
			{/* Overlay */}
			<div className='fixed inset-0 bg-black/40 -z-10'></div>
			<style>{`
        @media (max-width: 768px) {
          .h-full.bg-white.shadow-xl.flex.flex-col {
            width: 100vw !important;
            min-width: 0 !important;
            max-width: 100vw !important;
          }
        }
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes slide-in-left {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right { animation: slide-in-right 0.3s cubic-bezier(.4,0,.2,1); }
        .animate-slide-in-left { animation: slide-in-left 0.3s cubic-bezier(.4,0,.2,1); }
        .animate-fade-in { animation: fade-in 0.2s cubic-bezier(.4,0,.2,1); }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
		</div>
	)
}
