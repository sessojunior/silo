'use client'

import Link from 'next/link'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx' // Usado para juntar classes condicionalmente
import { twMerge } from 'tailwind-merge' // Junta classes do Tailwind com priorização de estilos

type ButtonStyle = 'filled' | 'bordered' | 'unstyled'

interface CommonProps {
	children?: ReactNode
	icon?: string | null
	style?: ButtonStyle
	className?: string
}

type AnchorProps = CommonProps &
	AnchorHTMLAttributes<HTMLAnchorElement> & {
		href: string
	}

type ButtonElementProps = CommonProps &
	ButtonHTMLAttributes<HTMLButtonElement> & {
		href?: undefined
	}

type ButtonProps = AnchorProps | ButtonElementProps

export default function Button(props: ButtonProps) {
	const { children, icon, style = 'filled', className, href, ...rest } = props

	const baseStyles: Record<ButtonStyle, string> = {
		filled: 'inline-flex items-center justify-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 focus:bg-blue-700 focus:outline-none disabled:pointer-events-none disabled:opacity-50 transition-all duration-500',
		bordered: 'inline-flex items-center justify-center gap-x-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 font-medium shadow-xs hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-none disabled:pointer-events-none disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800 transition-all duration-500',
		unstyled: 'inline-flex items-center justify-center gap-x-2 rounded-lg px-4 py-3 text-sm text-zinc-800 hover:bg-zinc-100 border border-transparent hover:border-zinc-200 transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:hover:border-zinc-600',
	}

	const finalClass = twMerge(clsx(baseStyles[style as ButtonStyle], className))
	const Icon = icon ? <span className={clsx(icon, 'size-4 shrink-0')} /> : null

	if (href) {
		const anchorProps = rest as AnchorHTMLAttributes<HTMLAnchorElement>
		
		// Desabilita prefetch para URLs de API (ex: /api/logout) para evitar ações destrutivas automáticas
		const isApiRoute = href.startsWith('/api/')
		const prefetch = isApiRoute ? false : undefined

		return (
			<Link href={href} prefetch={prefetch} className={finalClass} role='button' {...anchorProps}>
				{Icon}
				{children}
			</Link>
		)
	}

	const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>

	return (
		<button className={finalClass} {...buttonProps}>
			{Icon}
			{children}
		</button>
	)
}
