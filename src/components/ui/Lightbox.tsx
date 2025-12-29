import React, { useEffect, useRef } from 'react'
import Image from 'next/image'

interface LightboxProps {
	open: boolean
	image: string
	alt?: string
	onClose: () => void
}

export default function Lightbox({ open, image, alt, onClose }: LightboxProps) {
	const overlayRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!open) return
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') onClose()
		}
		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [open, onClose])

	if (!open) return null

	function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
		if (e.target === overlayRef.current) onClose()
	}

	return (
		<div ref={overlayRef} className='fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm' onClick={handleOverlayClick} aria-modal='true' role='dialog'>
			<div className='relative max-w-full max-h-full flex flex-col items-center justify-center p-4'>
				<button onClick={onClose} className='absolute -top-0.5 -right-0.5 z-10 rounded-full bg-red-600 size-10 flex items-center justify-center text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-blue-500' aria-label='Fechar'>
					<span className='icon-[lucide--x] size-5' />
				</button>
				<Image
					src={image}
					alt={alt || 'Imagem ampliada'}
					width={800}
					height={600}
					className='rounded-lg shadow-2xl max-h-[75vh] max-w-[75vw] border-2 border-zinc-200 dark:border-zinc-600 object-contain bg-white'
					style={{
						maxHeight: '75vh',
						maxWidth: '75vw',
						objectFit: 'contain',
					}}
					unoptimized
				/>
			</div>
		</div>
	)
}
