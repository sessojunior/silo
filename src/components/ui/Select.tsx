'use client'

import { useState, useRef, useEffect, KeyboardEvent, HTMLAttributes } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export interface SelectOption {
	label: string
	value: string
	disabled?: boolean
}

export interface SelectProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
	placeholder?: string
	name: string
	selected?: string | null
	options: SelectOption[]
	required?: boolean
	onChange?: (value: string) => void
	isInvalid?: boolean
	invalidMessage?: string
}

export default function Select({ placeholder = 'Selecione...', id, name, selected = null, isInvalid = false, invalidMessage, options, required = false, onChange, ...props }: SelectProps) {
	const [isOpen, setIsOpen] = useState(false)
	const [search, setSearch] = useState('')
	const [highlight, setHighlight] = useState(0)
	const [openUpwards, setOpenUpwards] = useState(false)

	const containerRef = useRef<HTMLDivElement>(null)
	const dropdownRef = useRef<HTMLDivElement>(null)

	const filtered = options.filter((opt) => opt.label.toLowerCase().includes(search.toLowerCase()))
	const selectedLabel = options.find((opt) => opt.value === selected)?.label || 'Selecione...'

	useEffect(() => {
		function onClickOutside(e: MouseEvent) {
			if (!containerRef.current?.contains(e.target as Node) && !dropdownRef.current?.contains(e.target as Node)) {
				setIsOpen(false)
			}
		}
		document.addEventListener('mousedown', onClickOutside)
		return () => document.removeEventListener('mousedown', onClickOutside)
	}, [])

	useEffect(() => {
		if (isOpen && containerRef.current) {
			const rect = containerRef.current.getBoundingClientRect()
			const viewportHeight = window.innerHeight
			const dropdownHeight = 240 // altura aproximada: search (40px) + lista (200px)

			const spaceBelow = viewportHeight - rect.bottom
			const spaceAbove = rect.top

			setOpenUpwards(spaceBelow < dropdownHeight && spaceAbove > dropdownHeight)
		}
	}, [isOpen])

	const toggle = () => setIsOpen((prev) => !prev)

	const selectOption = (opt: SelectOption) => {
		if (opt.disabled) return
		if (opt.value !== selected) {
			onChange?.(opt.value)
		}
		setIsOpen(false)
		setSearch('')
		setHighlight(0)
	}

	const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
		if (!isOpen) return

		if (e.key === 'ArrowDown') {
			e.preventDefault()
			setHighlight((h) => Math.min(h + 1, filtered.length - 1))
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault()
			setHighlight((h) => Math.max(h - 1, 0))
		}
		if (e.key === 'Enter') {
			e.preventDefault()
			selectOption(filtered[highlight])
		}
		if (e.key === 'Escape') {
			e.preventDefault()
			setIsOpen(false)
		}
	}

	return (
		<div ref={containerRef} onKeyDown={onKeyDown} className='relative w-full' {...props}>
			{/* Toggle */}
			<button
				id={id}
				type='button'
				onClick={toggle}
				aria-haspopup='listbox'
				aria-expanded={isOpen}
				className={twMerge(
					clsx('relative w-full cursor-pointer rounded-lg border bg-white pl-4 pr-10 py-3 text-left text-base text-zinc-700 transition focus:outline-none', 'dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-200', isInvalid ? 'border-red-400 focus:border-red-400 focus:ring-1 focus:ring-red-600 dark:border-red-800 dark:focus:border-red-800 dark:focus:ring-red-800' : 'focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:focus:ring-zinc-600', {
						'border-blue-300': isOpen && !isInvalid,
						'border-zinc-200': !isOpen && !isInvalid,
					}),
				)}
			>
				<span className='block w-full truncate'>{selected ? selectedLabel : <span className='text-zinc-400'>{placeholder ?? 'Selecione...'}</span>}</span>

				{/* Ícone */}
				<span className='pointer-events-none absolute inset-y-0 right-3 flex items-center text-zinc-400 dark:text-zinc-500'>
					<span className={twMerge('icon-[lucide--chevron-down] size-4 transition-transform duration-200 ease-in-out', isOpen && 'rotate-180')} />
				</span>
			</button>

			{/* Dropdown */}
			{isOpen && (
				<div ref={dropdownRef} className={twMerge(clsx('absolute z-50 w-full max-h-80 overflow-hidden rounded-lg bg-white shadow-lg dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700', openUpwards ? 'bottom-full mb-1' : 'top-full mt-1'))}>
					{/* Search */}
					<div className='px-3 py-2'>
						<input
							type='text'
							name='search'
							value={search}
							onChange={(e) => {
								setSearch(e.target.value)
								setHighlight(0)
							}}
							className='block w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200'
							placeholder='Buscar...'
							autoFocus
						/>
					</div>

					<ul role='listbox' className='max-h-64 overflow-y-auto pb-1'>
						{filtered.length > 0 ? (
							filtered.map((opt, idx) => (
								<li
									key={opt.value}
									role='option'
									aria-selected={selected === opt.value}
									onClick={() => selectOption(opt)}
									onMouseEnter={() => setHighlight(idx)}
									className={twMerge(
										clsx('flex cursor-pointer items-center justify-between px-4 py-2 text-base transition group', {
											'bg-blue-100 dark:bg-zinc-700': idx === highlight,
											'opacity-50 cursor-not-allowed': opt.disabled,
										}),
									)}
								>
									<span className={twMerge(clsx({ 'group-hover:text-zinc-600': !opt.disabled }))}>{opt.label}</span>
									{selected === opt.value && <span className='icon-[lucide--check] size-4 text-blue-600 dark:text-blue-500' />}
								</li>
							))
						) : (
							<li className='px-4 py-2 text-base text-zinc-500'>Nenhuma opção</li>
						)}
					</ul>
				</div>
			)}

			{/* Input hidden para formulário */}
			<input type='hidden' name={name} value={selected || ''} required={required} />

			{isInvalid && <Message>{invalidMessage}</Message>}
		</div>
	)
}

function Message({ children }: { children: React.ReactNode }) {
	return <p className='mt-2 text-xs text-red-500 dark:text-red-600'>{children}</p>
}
