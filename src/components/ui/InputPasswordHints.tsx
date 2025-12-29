'use client'

import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

type InputPasswordHintsProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> & {
	value: string
	setValue: (value: string) => void
	isInvalid?: boolean
	invalidMessage?: string
	ref?: React.Ref<HTMLInputElement>
	minLength?: number
}

export default function InputPasswordHints({ value, setValue, isInvalid = false, invalidMessage, ref, minLength = 2, className, autoFocus = false, placeholder, autoComplete, required, maxLength = 255, id, name, ...props }: InputPasswordHintsProps) {
	const [showPassword, setShowPassword] = useState(false)
	const [strength, setStrength] = useState(0)
	const [rules, setRules] = useState({
		minLength: false,
		lowercase: false,
		uppercase: false,
		numbers: false,
		specialChars: false,
	})

	useEffect(() => {
		const minLengthCheck = value.length >= minLength
		const lowercaseCheck = /[a-z]/.test(value)
		const uppercaseCheck = /[A-Z]/.test(value)
		const numberCheck = /[0-9]/.test(value)
		const specialCharCheck = /[^A-Za-z0-9]/.test(value)

		const checks = [minLengthCheck, lowercaseCheck, uppercaseCheck, numberCheck, specialCharCheck]
		const passed = checks.filter(Boolean).length

		setRules({
			minLength: minLengthCheck,
			lowercase: lowercaseCheck,
			uppercase: uppercaseCheck,
			numbers: numberCheck,
			specialChars: specialCharCheck,
		})

		setStrength(passed)
	}, [value, minLength])

	const strengthLabels = ['Nenhuma', 'Fraca', 'Média', 'Boa', 'Forte', 'Excelente']
	const barColors = ['bg-zinc-300', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400', 'bg-teal-500']

	function togglePasswordVisibility() {
		setShowPassword((prev) => !prev)
	}

	return (
		<>
			<div className='flex'>
				<div className='flex-1'>
					{/* Campo de senha */}
					<div className='relative'>
						<input ref={ref} id={id} name={name} type={showPassword ? 'text' : 'password'} placeholder={placeholder} autoComplete={autoComplete} maxLength={maxLength} required={required} value={value} onChange={(e) => setValue(e.target.value)} autoFocus={autoFocus} className={twMerge(clsx('block rounded-lg py-3 ps-4 pe-10 disabled:pointer-events-none disabled:opacity-50 border-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:placeholder-zinc-500 dark:focus:ring-zinc-600', isInvalid ? 'border-red-600 focus:border-red-600 focus:ring-red-500' : 'focus:border-blue-500 focus:ring-blue-500', className ?? 'w-full'))} {...props} />
						{/* Toggle */}
						<button type='button' onClick={togglePasswordVisibility} aria-label='Exibir ou ocultar senha' className={twMerge(clsx('absolute inset-y-0 end-0 z-20 flex cursor-pointer items-center rounded-e-md pe-4 text-zinc-400 focus:outline-none dark:text-zinc-400', isInvalid ? 'focus:text-red-400 dark:focus:text-red-600' : 'focus:text-blue-400 dark:focus:text-blue-600'))}>
							{showPassword ? <span className='icon-[lucide--eye-off] size-5' /> : <span className='icon-[lucide--eye] size-5' />}
						</button>
					</div>

					{/* Barra de progresso */}
					<div className='mt-2 flex h-1 overflow-hidden rounded-full'>
						{Array.from({ length: 5 }).map((_, i) => (
							<div key={i} className={clsx('flex-1 mx-0.5 rounded-full transition-all duration-300', strength > i ? barColors[strength] : 'bg-zinc-300 dark:bg-zinc-700')} />
						))}
					</div>

					{/* Mensagem de força */}
					<div className='mt-2 text-sm font-medium text-zinc-500 dark:text-zinc-400'>
						Força da senha: <span className='font-semibold'>{strengthLabels[strength]}</span>
					</div>

					{/* Mensagem de erro */}
					{isInvalid && <Message>{invalidMessage}</Message>}
				</div>
			</div>

			{/* Dicas de senha */}
			<ul className='mt-4 space-y-1 text-sm text-zinc-500 dark:text-zinc-400'>
				<PasswordRule checked={rules.minLength} message={`Pelo menos ${minLength} caracteres`} />
				<PasswordRule checked={rules.lowercase} message='Letra minúscula' />
				<PasswordRule checked={rules.uppercase} message='Letra maiúscula' />
				<PasswordRule checked={rules.numbers} message='Número' />
				<PasswordRule checked={rules.specialChars} message='Caractere especial' />
			</ul>
		</>
	)
}

function PasswordRule({ checked, message }: { checked: boolean; message: string }) {
	return (
		<li
			className={clsx('flex items-center gap-x-2', {
				'text-teal-500': checked,
				'text-zinc-500': !checked,
			})}
		>
			{checked ? <span className='icon-[lucide--check] size-4 text-teal-500' /> : <span className='icon-[lucide--x] size-4 text-zinc-400' />}
			{message}
		</li>
	)
}

function Message({ children }: { children: React.ReactNode }) {
	return <p className='dark:text-red-600 mt-2 text-xs text-red-500'>{children}</p>
}
