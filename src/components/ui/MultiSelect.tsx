'use client'

import { useEffect, useRef, useState, KeyboardEvent, HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'
import clsx from 'clsx'
import Image from 'next/image'

export interface MultiSelectOption {
	label: string
	value: string
	image?: string | null
	disabled?: boolean
}

export interface MultiSelectProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
	placeholder?: string
	name: string
	selected?: string[]
	options: MultiSelectOption[]
	required?: boolean
	onChange?: (values: string[]) => void
	isInvalid?: boolean
	invalidMessage?: string
	maxSelections?: number
}

export default function MultiSelect({ placeholder = 'Selecione...', id, name, selected = [], isInvalid = false, invalidMessage, options, required = false, onChange, maxSelections, ...props }: MultiSelectProps) {
	const [isOpen, setIsOpen] = useState(false)
	const [search, setSearch] = useState('')
	const [highlight, setHighlight] = useState(0)
	const [openUpwards, setOpenUpwards] = useState(false)

	const containerRef = useRef<HTMLDivElement>(null)
	const dropdownRef = useRef<HTMLDivElement>(null)

	const filtered = options.filter((opt) => !selected.includes(opt.value) && opt.label.toLowerCase().includes(search.toLowerCase()))

	const canSelectMore = !maxSelections || selected.length < maxSelections

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
			const dropdownHeight = 240

			const spaceBelow = viewportHeight - rect.bottom
			const spaceAbove = rect.top

			setOpenUpwards(spaceBelow < dropdownHeight && spaceAbove > dropdownHeight)
		}
	}, [isOpen])

	const toggle = () => setIsOpen((prev) => !prev)

	const selectOption = (opt: MultiSelectOption) => {
		if (opt.disabled || !canSelectMore) return

		const newSelected = [...selected, opt.value]
		onChange?.(newSelected)
		setIsOpen(false)
		setSearch('')
		setHighlight(0)
	}

	const removeOption = (valueToRemove: string) => {
		const newSelected = selected.filter((value) => value !== valueToRemove)
		onChange?.(newSelected)
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
			if (filtered[highlight]) {
				selectOption(filtered[highlight])
			}
		}
		if (e.key === 'Escape') {
			e.preventDefault()
			setIsOpen(false)
		}
	}

	const getSelectedLabels = () => {
		return selected.map((value) => options.find((opt) => opt.value === value)?.label || value)
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
					clsx('relative w-full cursor-pointer rounded-lg border bg-white pl-4 pr-10 py-3 text-left text-base text-zinc-700 transition focus:outline-none min-h-[44px]', 'dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-200', isInvalid ? 'border-red-400 focus:border-red-400 focus:ring-1 focus:ring-red-600 dark:border-red-800 dark:focus:border-red-800 dark:focus:ring-red-800' : 'focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:focus:ring-zinc-600', {
						'border-blue-300': isOpen && !isInvalid,
						'border-zinc-200': !isOpen && !isInvalid,
					}),
				)}
			>
				{/* Selected values as chips */}
				{selected.length > 0 ? (
					<div className='flex flex-wrap gap-2'>
						{getSelectedLabels().map((label, index) => {
							const selectedOption = options.find((opt) => opt.value === selected[index])
							return (
								<span key={index} className='inline-flex items-center gap-2 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200'>
									{/* Avatar do usuário selecionado */}
									{selectedOption?.image ? <Image src={selectedOption.image} alt={label} width={16} height={16} className='w-4 h-4 rounded-full object-cover' /> : <div className='w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-xs font-medium text-white'>{label.charAt(0).toUpperCase()}</div>}
									{label}
									<span
										onClick={(e) => {
											e.stopPropagation()
											removeOption(selected[index])
										}}
										className='ml-1 rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 cursor-pointer'
										role='button'
										tabIndex={0}
										onKeyDown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault()
												removeOption(selected[index])
											}
										}}
									>
										<span className='icon-[lucide--x] size-3' />
									</span>
								</span>
							)
						})}
					</div>
				) : (
					<span className='text-zinc-400'>{placeholder}</span>
				)}

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

					{/* Max selections warning */}
					{maxSelections && selected.length >= maxSelections && (
						<div className='px-3 py-2 bg-amber-50 border-b border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'>
							<p className='text-xs text-amber-700 dark:text-amber-300'>Máximo de {maxSelections} seleções atingido</p>
						</div>
					)}

					<ul role='listbox' className='max-h-64 overflow-y-auto pb-1'>
						{filtered.length > 0 ? (
							filtered.map((opt, idx) => (
								<li
									key={opt.value}
									role='option'
									aria-selected={false}
									onClick={() => selectOption(opt)}
									onMouseEnter={() => setHighlight(idx)}
									className={twMerge(
										clsx('flex cursor-pointer items-center justify-between px-4 py-2 text-base transition group', {
											'bg-blue-100 dark:bg-zinc-700': idx === highlight,
											'opacity-50 cursor-not-allowed': opt.disabled || !canSelectMore,
										}),
									)}
								>
									<div className='flex items-center gap-3'>
										{/* Avatar do usuário */}
										{opt.image ? <Image src={opt.image} alt={opt.label} width={24} height={24} className='w-6 h-6 rounded-full object-cover' /> : <div className='w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-xs font-medium text-white'>{opt.label.charAt(0).toUpperCase()}</div>}
										<span className={twMerge(clsx({ 'group-hover:text-zinc-600': !opt.disabled && canSelectMore }))}>{opt.label}</span>
									</div>
									{!canSelectMore && <span className='icon-[lucide--lock] size-4 text-zinc-400' />}
								</li>
							))
						) : (
							<li className='px-4 py-2 text-base text-zinc-500'>{selected.length > 0 && filtered.length === 0 ? 'Todas as opções já selecionadas' : 'Nenhuma opção'}</li>
						)}
					</ul>
				</div>
			)}

			{/* Input hidden para formulário */}
			<input type='hidden' name={name} value={selected.join(',')} required={required} />

			{isInvalid && <Message>{invalidMessage}</Message>}
		</div>
	)
}

function Message({ children }: { children: React.ReactNode }) {
	return <p className='mt-2 text-xs text-red-500 dark:text-red-600'>{children}</p>
}
