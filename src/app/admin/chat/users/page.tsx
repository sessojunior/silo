'use client'

export default function ChatUsersPage() {
	return (
		<div className='flex-1 flex items-center justify-center bg-zinc-50 dark:bg-zinc-900'>
			<div className='text-center text-zinc-500 dark:text-zinc-400'>
				<span className='icon-[lucide--user] w-16 h-16 mx-auto mb-4 opacity-50' />
				<h3 className='text-lg font-medium mb-2'>Usuários</h3>
				<p className='text-sm'>Selecione um usuário para começar a conversar</p>
			</div>
		</div>
	)
}
