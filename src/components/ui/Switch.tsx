import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { InputHTMLAttributes } from 'react'

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'onChange'> {
	id: string
	name: string
	checked?: boolean
	onChange?: (value: boolean) => void
	size?: 'lg' | 'md' | 'sm' | 'xs'
	title?: string
	description?: string
	isInvalid?: boolean
	invalidMessage?: string
}

const sizeClasses = {
	lg: {
		container: 'h-8 w-15',
		thumb: 'size-7',
	},
	md: {
		container: 'h-7 w-13',
		thumb: 'size-6',
	},
	sm: {
		container: 'h-6 w-11',
		thumb: 'size-5',
	},
	xs: {
		container: 'h-5 w-9',
		thumb: 'size-4',
	},
}

export default function Switch({ id, name, checked = false, onChange, size = 'md', title, description, isInvalid, invalidMessage, ...props }: SwitchProps) {
	const selectedSize = sizeClasses[size]

	return (
		<div className='space-y-2'>
			<div className='flex items-center justify-between gap-3'>
				<label htmlFor={id} className='flex-1'>
					{title && <h3 className='text-lg font-bold tracking-tight text-zinc-600 dark:text-zinc-200'>{title}</h3>}
					{description && <p className='text-base text-zinc-400 dark:text-zinc-600'>{description}</p>}
				</label>

				<label htmlFor={id} className={twMerge(clsx('relative inline-block shrink-0 cursor-pointer', selectedSize.container))}>
					<input id={id} name={name} type='checkbox' checked={checked} onChange={(e) => onChange?.(e.target.checked)} className='peer sr-only' {...props} />

					<span className={twMerge('absolute inset-0 rounded-full transition-colors duration-200 ease-in-out', 'bg-gray-200 peer-checked:bg-blue-600 peer-disabled:pointer-events-none peer-disabled:opacity-50', 'dark:bg-zinc-700 dark:peer-checked:bg-blue-500')} />

					<span className={twMerge(clsx('absolute start-0.5 top-1/2 -translate-y-1/2 rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out', 'peer-checked:translate-x-full', 'dark:bg-zinc-400 dark:peer-checked:bg-white', selectedSize.thumb))} />
				</label>
			</div>

			{isInvalid && invalidMessage && <p className='mt-2 text-xs text-red-500 dark:text-red-600'>{invalidMessage}</p>}
		</div>
	)
}
