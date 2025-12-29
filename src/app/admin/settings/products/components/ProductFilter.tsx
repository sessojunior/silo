import React, { useState } from 'react'

interface ProductFilterProps {
	value: string
	onChange: (value: string) => void
	onSubmit: () => void
	loading: boolean
}

export default function ProductFilter({ value, onChange, onSubmit, loading }: ProductFilterProps) {
	const [input, setInput] = useState(value)

	function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
		setInput(e.target.value)
		onChange(e.target.value)
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === 'Enter') onSubmit()
	}

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault()
				onSubmit()
			}}
			className='flex gap-2 items-center mb-2'
		>
			<input type='text' className='border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 w-full max-w-xs bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500' placeholder='Buscar por nome...' value={input} onChange={handleInput} onKeyDown={handleKeyDown} disabled={loading} />
			<button type='submit' className='px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-60' disabled={loading}>
				{loading ? 'Buscando...' : 'Buscar'}
			</button>
		</form>
	)
}
