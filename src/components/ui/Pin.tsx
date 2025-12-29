'use client'

import { useRef, useState, useEffect, InputHTMLAttributes } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

interface PinProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'name' | 'id'> {
	id: string
	name: string
	length: number
	value?: string
	setValue?: (value: string) => void
	isInvalid?: boolean
	invalidMessage?: string
	placeholder?: string
	compact?: boolean
}

export default function Pin({ id, name, value = '', setValue, length, isInvalid = false, invalidMessage = '', compact = false, className, ...props }: PinProps) {
	const [values, setValues] = useState<string[]>(() => Array.from({ length }, (_, i) => value[i]?.toUpperCase() || ''))

	const inputRefs = useRef<(HTMLInputElement | null)[]>([])

	// Atualiza valor externo (concatenado)
	useEffect(() => {
		const joined = values.join('')
		if (joined !== value) {
			setValue?.(joined)
		}
		// eslint quer todas dependências usadas na função
	}, [values, value, setValue])

	const prevValueRef = useRef(value)
	const prevValuesRef = useRef(values)

	// Atualiza inputs se valor externo mudar (ex: colar o código)
	useEffect(() => {
		const incoming = Array.from({ length }, (_, i) => value[i]?.toUpperCase() || '')
		const current = prevValuesRef.current.join('')
		const next = incoming.join('')

		if (value.length === length && current !== next) {
			setValues(incoming)
		}

		prevValueRef.current = value
		prevValuesRef.current = values
	}, [value, length, values])

	const handleChange = (index: number, val: string) => {
		if (!/^[0-9a-zA-Z]?$/.test(val)) return
		const upperVal = val.toUpperCase()

		setValues((prev) => {
			const next = [...prev]
			next[index] = upperVal
			return next
		})

		if (val && index < length - 1) {
			inputRefs.current[index + 1]?.focus()
		}
	}

	const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
		switch (e.key) {
			case 'Backspace':
				if (!values[index] && index > 0) {
					inputRefs.current[index - 1]?.focus()
					setValues((prev) => {
						const next = [...prev]
						next[index - 1] = ''
						return next
					})
					e.preventDefault()
				}
				break
			case 'ArrowLeft':
				if (index > 0) {
					inputRefs.current[index - 1]?.focus()
					e.preventDefault()
				}
				break
			case 'ArrowRight':
				if (index < length - 1) {
					inputRefs.current[index + 1]?.focus()
					e.preventDefault()
				}
				break
		}
	}

	const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
		const paste = e.clipboardData.getData('text')
		if (!paste) return

		const sanitized = paste
			.slice(0, length)
			.toUpperCase()
			.replace(/[^0-9A-Z]/g, '')
		const chars = sanitized.split('')

		if (chars.length === 0) return

		setValues((prev) => {
			const next = [...prev]
			for (let i = 0; i < length; i++) {
				next[i] = chars[i] || ''
			}
			return next
		})

		// Move foco para o último campo preenchido
		const lastIndex = Math.min(chars.length - 1, length - 1)
		setTimeout(() => {
			inputRefs.current[lastIndex]?.focus()
		}, 0)

		e.preventDefault()
	}

	return (
		<>
			<div id={id} className={compact ? 'flex justify-start gap-4' : 'flex justify-between gap-x-3'}>
				{Array.from({ length }).map((_, index) => (
					<input
						key={index}
						{...props}
						ref={(el) => {
							inputRefs.current[index] = el
						}}
						type='text'
						inputMode='numeric'
						name={`${name}-${index}`}
						value={values[index]}
						autoComplete={index === 0 ? 'one-time-code' : 'off'}
						autoFocus={index === 0}
						maxLength={1}
						placeholder={props.placeholder ?? ''}
						onChange={(e) => handleChange(index, e.target.value)}
						onKeyDown={(e) => handleKeyDown(index, e)}
						onPaste={handlePaste}
						className={twMerge(clsx('block w-12 rounded-md p-3 text-center text-lg uppercase border focus:outline-none focus:ring-2', isInvalid ? 'border-red-400 focus:ring-red-500' : 'border-zinc-200 focus:ring-blue-500', 'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:placeholder-zinc-500 dark:focus:ring-zinc-600', className))}
					/>
				))}
			</div>
			{isInvalid && <Message>{invalidMessage}</Message>}
		</>
	)
}

function Message({ children }: { children: React.ReactNode }) {
	return <p className='mt-2 text-xs text-red-500 dark:text-red-600'>{children}</p>
}
