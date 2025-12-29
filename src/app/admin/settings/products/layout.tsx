'use client'

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className='flex min-h-[calc(100vh-64px)] w-full flex-col bg-white dark:bg-zinc-900'>
			{/* Conteúdo */}
			<div className='flex min-h-full w-full flex-col items-start justify-start gap-8 text-zinc-600 dark:text-zinc-200'>{children}</div>
		</div>
	)
}
