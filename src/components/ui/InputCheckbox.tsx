'use client'

import { InputHTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'
import { clsx } from 'clsx'

type InputCheckboxProps = {
	id: string
	name: string
	label: string
	className?: string
} & InputHTMLAttributes<HTMLInputElement>

export default function InputCheckbox({ id, name, label, className, ...props }: InputCheckboxProps) {
	return (
		<label htmlFor={id} className='flex items-center cursor-pointer select-none'>
			<input id={id} name={name} type='checkbox' className={twMerge(clsx('shrink-0 rounded-sm border-zinc-300 text-blue-600 focus:ring-blue-500', 'dark:border-zinc-600 dark:bg-zinc-800 dark:checked:border-blue-500 dark:checked:bg-blue-500 dark:focus:ring-offset-zinc-800', className))} {...props} />
			<span className='ms-2 text-sm text-zinc-500 dark:text-zinc-400'>{label}</span>
		</label>
	)
}
