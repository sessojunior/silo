'use client'

import { useState, useRef, useEffect } from 'react'
import { twMerge } from 'tailwind-merge'
import clsx from 'clsx'

type Position = 'top-left' | 'top-right' | 'top-center' | 'bottom-left' | 'bottom-right' | 'bottom-center' | 'right-bottom' | 'left-bottom'

interface PopoverProps {
	children: React.ReactNode
	content: React.ReactNode
	position?: Position
	className?: string
	onClick?: () => void
}

const positionMap: Record<Position, string> = {
	'top-left': 'bottom-full left-0 mb-2',
	'top-right': 'bottom-full right-0 mb-2',
	'top-center': 'bottom-full left-1/2 -translate-x-1/2 mb-2',
	'bottom-left': 'top-full left-0 mt-2',
	'bottom-right': 'top-full right-0 mt-2',
	'bottom-center': 'top-full left-1/2 -translate-x-1/2 mt-2',
	'right-bottom': 'left-full top-full ml-2',
	'left-bottom': 'right-full top-full mr-2',
}

export default function Popover({ children, content, position = 'top-center', className, onClick }: PopoverProps) {
	const [open, setOpen] = useState(false)
	const buttonRef = useRef<HTMLButtonElement>(null)
	const popoverRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (buttonRef.current && !buttonRef.current.contains(e.target as Node) && popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
				setOpen(false)
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	const handleClick = () => {
		setOpen((prev) => !prev)
		if (onClick) {
			onClick()
		}
	}

	return (
		<div className='relative inline-block'>
			<button ref={buttonRef} onClick={handleClick} className='focus:outline-none'>
				{children}
			</button>

			{open && (
				<div ref={popoverRef} className={twMerge(clsx('absolute z-50 rounded-xl border bg-white shadow-md transition-opacity dark:bg-zinc-800', 'border-zinc-200 dark:border-zinc-700', positionMap[position], className))}>
					{content}
				</div>
			)}
		</div>
	)
}
