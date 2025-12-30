import React, { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

interface LightboxProps {
	open: boolean
	image: string
	alt?: string
	onClose: () => void
}

type NaturalSize = { width: number; height: number }
type DisplaySize = { width: number; height: number }

const toPublicUploadsSrc = (input: string): string => {
	const [pathPart, queryPart] = input.split('?')
	const query = queryPart ? `?${queryPart}` : ''

	if (pathPart?.startsWith('/uploads/')) return `${pathPart}${query}`
	if (pathPart?.includes('/uploads/')) return `${pathPart.slice(pathPart.indexOf('/uploads/'))}${query}`

	return input
}

const getContainedSize = (natural: NaturalSize, maxWidth: number, maxHeight: number): DisplaySize => {
	const safeWidth = Math.max(1, maxWidth)
	const safeHeight = Math.max(1, maxHeight)
	const ratio = natural.width / natural.height

	let width = safeWidth
	let height = width / ratio

	if (height > safeHeight) {
		height = safeHeight
		width = height * ratio
	}

	return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) }
}

export default function Lightbox({ open, image, alt, onClose }: LightboxProps) {
	const overlayRef = useRef<HTMLDivElement>(null)
	const [naturalSize, setNaturalSize] = useState<NaturalSize | null>(null)
	const [displaySize, setDisplaySize] = useState<DisplaySize | null>(null)
	const normalizedImage = toPublicUploadsSrc(image)

	useEffect(() => {
		if (!open) return
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') onClose()
		}
		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [open, onClose])

	useEffect(() => {
		if (!open) return
		setNaturalSize(null)
		setDisplaySize(null)
	}, [open, normalizedImage])

	useEffect(() => {
		if (!open) return
		if (!naturalSize) return

		const recalc = () => {
			const maxWidth = window.innerWidth * 0.9
			const maxHeight = window.innerHeight * 0.8
			setDisplaySize(getContainedSize(naturalSize, maxWidth, maxHeight))
		}

		recalc()
		window.addEventListener('resize', recalc)
		return () => window.removeEventListener('resize', recalc)
	}, [open, naturalSize])

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
				<div
					className='relative'
					style={{
						width: displaySize ? `${displaySize.width}px` : '90vw',
						height: displaySize ? `${displaySize.height}px` : '80vh',
					}}
				>
					<Image
						src={normalizedImage}
						alt={alt || 'Imagem ampliada'}
						fill
						sizes={displaySize ? `${displaySize.width}px` : '90vw'}
						className='rounded-lg shadow-2xl border-2 border-zinc-200 dark:border-zinc-600 object-contain'
						unoptimized
						onLoadingComplete={(img) => {
							const w = img.naturalWidth || 1
							const h = img.naturalHeight || 1
							setNaturalSize({ width: w, height: h })
						}}
					/>
				</div>
			</div>
		</div>
	)
}
