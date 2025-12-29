'use client'

import { toggleTheme } from '@/lib/theme'

export default function SidebarButtonTheme() {
	const handleChangeTheme = (newTheme: 'light' | 'dark') => {
		toggleTheme(newTheme)
	}

	return (
		<div className='flex'>
			{/* Botão para modo claro */}
			<button type='button' onClick={() => handleChangeTheme('light')} className='hidden dark:block rounded-full font-medium text-zinc-100 transition-all duration-500 hover:bg-zinc-700 focus:bg-zinc-100 focus:outline-none dark:text-zinc-400'>
				<span className='group inline-flex size-8 shrink-0 items-center justify-center'>
					<span className='icon-[lucide--sun] size-4 shrink-0'></span>
				</span>
				<span className='sr-only'>Modo claro</span>
			</button>

			{/* Botão para modo escuro */}
			<button type='button' onClick={() => handleChangeTheme('dark')} className='block dark:hidden rounded-full font-medium text-zinc-400 transition-all duration-500 hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800'>
				<span className='group inline-flex size-8 shrink-0 items-center justify-center'>
					<span className='icon-[lucide--moon] size-4 shrink-0'></span>
				</span>
				<span className='sr-only'>Modo escuro</span>
			</button>
		</div>
	)
}
