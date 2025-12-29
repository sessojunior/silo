'use client'

import Link, { LinkProps } from 'next/link'
import { twMerge } from 'tailwind-merge'
import clsx from 'clsx'

type NavButtonProps = Omit<LinkProps, 'href'> & {
	children: React.ReactNode
	href?: string | null
	disabled?: boolean
	icon?: string | null
	active?: boolean
}

export default function NavButton({ children, href = '#', disabled = false, icon = null, active = false, ...props }: NavButtonProps) {
	const finalClassName = twMerge(
		clsx('inline-flex items-center gap-x-2 rounded-lg border px-4 py-2 text-base font-medium transition-all duration-500 focus:outline-hidden', 'disabled:pointer-events-none disabled:opacity-50', 'dark:text-zinc-200', {
			'text-zinc-800 hover:text-zinc-500': !disabled,
			'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-800': active && !disabled,
			'border-transparent bg-transparent dark:bg-zinc-700': !active && !disabled,
			'pointer-events-none opacity-50': disabled,
		}),
	)

	// Desabilita prefetch para URLs de API (ex: /api/logout) para evitar ações destrutivas automáticas
	const isApiRoute = (href || '#').startsWith('/api/')
	const prefetch = isApiRoute ? false : undefined

	return (
		<Link href={href || '#'} prefetch={prefetch} aria-disabled={disabled} role='button' className={finalClassName} {...props}>
			{icon && <span className={clsx(icon, 'size-4 shrink-0')} aria-hidden='true' />}
			{children}
		</Link>
	)
}
