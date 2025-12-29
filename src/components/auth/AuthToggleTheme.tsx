'use client'

import { useEffect } from 'react'
import { toggleTheme, applySavedTheme } from '@/lib/theme'

export default function AuthToggleTheme() {
	useEffect(() => {
		applySavedTheme()
	}, [])

	return (
		<>
			<div className='fixed right-5 bottom-5 z-20'>
				<button type='button' onClick={() => toggleTheme()} aria-label='Trocar tema' className='font-medium text-zinc-200 focus:outline-none'>
					<span className='group inline-flex size-9 items-center justify-center'>
						<span className='icon-[lucide--moon] dark:hidden size-5'></span>
						<span className='icon-[lucide--sun] hidden dark:inline size-5'></span>
					</span>
				</button>
			</div>
		</>
	)
}
