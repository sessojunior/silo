import Image from 'next/image'

interface AvatarProps {
	src?: string | null
	name: string
	size?: 'sm' | 'md' | 'lg'
	className?: string
	showPresence?: boolean
	presenceColor?: string
}

export default function Avatar({ 
	src, 
	name, 
	size = 'md', 
	className = '', 
	showPresence = false,
	presenceColor
}: AvatarProps) {
	// Definir tamanhos
	const sizeClasses = {
		sm: 'w-8 h-8 text-xs',
		md: 'w-10 h-10 text-sm',
		lg: 'w-12 h-12 text-base'
	}

	const sizePx = {
		sm: 32,
		md: 40,
		lg: 48
	}

	const sizeClass = sizeClasses[size]
	const sizePixel = sizePx[size]

	// Se tem imagem, usar Image do Next.js
	if (src && src !== '/images/profile.png') {
		return (
			<div className='relative inline-block'>
				<Image 
					src={src} 
					alt={name} 
					width={sizePixel} 
					height={sizePixel} 
					className={`${sizeClass} rounded-full object-cover ${className}`}
					unoptimized={src?.startsWith('blob:')}
				/>
				{showPresence && presenceColor && (
					<span className={`absolute right-0 bottom-0 block h-3 w-3 rounded-full ring-2 ring-white dark:ring-zinc-800 ${presenceColor} transition-opacity duration-300`} />
				)}
			</div>
		)
	}

	// Se não tem imagem, usar primeira letra com gradiente azul
	return (
		<div className='relative inline-block'>
			<div className={`${sizeClass} rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold ${className}`}>
				{name.charAt(0).toUpperCase()}
			</div>
			{showPresence && presenceColor && (
				<span className={`absolute right-0 bottom-0 block h-3 w-3 rounded-full ring-2 ring-white dark:ring-zinc-800 ${presenceColor} transition-opacity duration-300`} />
			)}
		</div>
	)
}
