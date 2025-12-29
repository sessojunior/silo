'use client'

export default function ChatUserPage() {
	return (
		<div className='flex-1 flex items-center justify-center bg-zinc-50 dark:bg-zinc-900'>
			<div className='text-center text-zinc-500 dark:text-zinc-400'>
				<span className='icon-[lucide--user] w-16 h-16 mx-auto mb-4 opacity-50' />
				<h3 className='text-lg font-medium mb-2'>Usuário</h3>
				<p className='text-sm'>Conversa com o usuário será carregada aqui</p>
			</div>
		</div>
	)
}
