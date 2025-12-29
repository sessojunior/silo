'use client'

import React from 'react'

interface LoadingSpinnerProps {
	text?: string
	size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
	variant?: 'horizontal' | 'vertical' | 'centered'
	className?: string
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
	text = 'Carregando...',
	size = 'md',
	variant = 'horizontal',
	className = ''
}) => {
	const sizeClasses = {
		xs: 'size-3',
		sm: 'size-4', 
		md: 'size-6',
		lg: 'size-8',
		xl: 'size-10'
	}

	const textSizeClasses = {
		xs: 'text-xs',
		sm: 'text-sm',
		md: 'text-sm',
		lg: 'text-base',
		xl: 'text-lg'
	}

	const spinnerElement = (
		<span className={`icon-[lucide--loader-circle] animate-spin text-zinc-400 ${sizeClasses[size]}`} />
	)

	const textElement = (
		<span className={`text-zinc-600 dark:text-zinc-400 ${textSizeClasses[size]}`}>
			{text}
		</span>
	)

	if (variant === 'vertical') {
		return (
			<div className={`flex flex-col items-center gap-2 ${className}`}>
				{spinnerElement}
				{textElement}
			</div>
		)
	}

	if (variant === 'centered') {
		return (
			<div className={`flex items-center justify-center gap-3 ${className}`}>
				{spinnerElement}
				{textElement}
			</div>
		)
	}

	// variant === 'horizontal' (default)
	return (
		<div className={`flex items-center gap-3 ${className}`}>
			{spinnerElement}
			{textElement}
		</div>
	)
}

export default LoadingSpinner