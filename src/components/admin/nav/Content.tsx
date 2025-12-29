'use client'

import { HTMLAttributes } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

type NavContentProps = {
	children: React.ReactNode
	className?: string
} & HTMLAttributes<HTMLDivElement>

export default function NavContent({ children, className, ...props }: NavContentProps) {
	return (
		<div className={twMerge(clsx('bg-white dark:bg-zinc-800'), className)} {...props}>
			<div className='flex w-full flex-shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-700'>
				<div className='scrollbar size-full h-[calc(100vh-131px)] overflow-y-auto'>{children}</div>
			</div>
		</div>
	)
}
