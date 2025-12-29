'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

interface InputPasswordProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
	ref?: React.RefObject<HTMLInputElement | null>
	value: string
	setValue: (value: string) => void
	isInvalid?: boolean
	invalidMessage?: string
}

export default function InputPassword({ ref, value, setValue, isInvalid = false, invalidMessage, className, ...rest }: InputPasswordProps) {
	const [showPassword, setShowPassword] = useState(false)

	function togglePasswordVisibility() {
		setShowPassword((prev) => !prev)
	}

	const inputClasses = twMerge(clsx('block w-full rounded-lg py-3 ps-4 pe-10 border disabled:pointer-events-none disabled:opacity-50', 'border-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:placeholder-zinc-500 dark:focus:ring-zinc-600', isInvalid ? 'border-red-400 focus:border-red-400 focus:ring-red-600 dark:border-red-800 dark:focus:border-red-800 dark:focus:ring-red-800' : 'focus:border-blue-500 focus:ring-blue-500', className))

	const buttonClasses = twMerge(clsx('absolute inset-y-0 end-0 z-20 flex items-center pe-4 text-zinc-400 focus:outline-none rounded-e-md', isInvalid ? 'focus:text-red-400 dark:focus:text-red-600' : 'focus:text-blue-400 dark:focus:text-blue-600'))

	return (
		<>
			<div className='relative'>
				<input ref={ref} type={showPassword ? 'text' : 'password'} value={value} onChange={(e) => setValue(e.target.value)} className={inputClasses} {...rest} />

				<button type='button' onClick={togglePasswordVisibility} className={buttonClasses} aria-label='Exibir ou ocultar senha'>
					{showPassword ? <span className='icon-[lucide--eye-off] size-5' /> : <span className='icon-[lucide--eye] size-5' />}
				</button>
			</div>

			{isInvalid && <Message>{invalidMessage}</Message>}
		</>
	)
}

function Message({ children }: { children: React.ReactNode }) {
	return <p className='mt-2 text-xs text-red-500 dark:text-red-600'>{children}</p>
}
