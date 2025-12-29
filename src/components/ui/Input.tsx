'use client'

import { useRef } from 'react'
import { clsx } from 'clsx' // Usado para juntar classes condicionalmente
import { twMerge } from 'tailwind-merge' // Junta classes do Tailwind com priorização de estilos

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	ref?: React.RefObject<HTMLInputElement | null>
	type: 'text' | 'email'
	mask?: 'phone'
	value: string
	setValue: (value: string) => void
	isInvalid?: boolean
	invalidMessage?: string
}

export default function Input({ type, mask, value, setValue, isInvalid = false, invalidMessage, className, ...rest }: InputProps) {
	const inputRef = useRef<HTMLInputElement>(null)

	function handleInput(event: React.ChangeEvent<HTMLInputElement>) {
		const input = event.target

		if (mask === 'phone') {
			const cursor = input.selectionStart ?? 0
			const originalLength = input.value.length

			const masked = phoneMask(input.value)
			setValue(masked)

			const diff = masked.length - originalLength
			const newCursor = Math.max(0, cursor + diff)
			requestAnimationFrame(() => {
				input.setSelectionRange(newCursor, newCursor)
			})
		} else {
			setValue(type === 'email' ? input.value.toLowerCase() : input.value)
		}
	}

	function phoneMask(value: string) {
		value = value.replace(/\D/g, '')

		if (value.length > 10) {
			return value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3')
		} else if (value.length > 6) {
			return value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3')
		} else if (value.length > 2) {
			return value.replace(/^(\d{2})(\d{0,5})/, '($1) $2')
		} else {
			return value.replace(/^(\d*)/, '($1')
		}
	}

	const inputClasses = twMerge(clsx('block w-full rounded-lg py-3 ps-4 pe-10 border disabled:pointer-events-none disabled:opacity-50', 'border-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:placeholder-zinc-500 dark:focus:ring-zinc-600', isInvalid ? 'border-red-400 focus:border-red-400 focus:ring-red-600 dark:border-red-800 dark:focus:border-red-800 dark:focus:ring-red-800' : 'focus:border-blue-500 focus:ring-blue-500', className))

	return (
		<>
			<div className='relative'>
				<input ref={inputRef} type={type} value={value} onChange={handleInput} className={inputClasses} {...rest} />
				{isInvalid && (
					<div className='pointer-events-none absolute inset-y-0 end-0 flex items-center pe-4'>
						<span className='icon-[lucide--triangle-alert] size-5 text-red-400 dark:text-red-900'></span>
					</div>
				)}
			</div>
			{isInvalid && <Message>{invalidMessage}</Message>}
		</>
	)
}

function Message({ children }: { children: React.ReactNode }) {
	return <p className='mt-2 text-xs text-red-500 dark:text-red-600'>{children}</p>
}
