'use client'

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
	isInvalid?: boolean
	required?: boolean
}

export default function Label({ children, isInvalid, required, className, ...props }: LabelProps) {
	const mergedClassName = twMerge(clsx('mb-2 flex items-center font-semibold', isInvalid && 'text-red-500', className))

	return (
		<label className={mergedClassName} {...props} title={required ? 'Campo obrigatório' : ''}>
			{children}
			{required && <span className='ml-1 text-red-500'>*</span>}
		</label>
	)
}
