'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function ChatPage() {
	const router = useRouter()
	const searchParams = useSearchParams()

	// Redirecionar para nova estrutura de rotas
	useEffect(() => {
		const groupId = searchParams.get('groupId')
		const userId = searchParams.get('userId')

		if (groupId) {
			router.replace(`/admin/chat/groups/${groupId}`)
		} else if (userId) {
			router.replace(`/admin/chat/users/${userId}`)
		} else {
			router.replace('/admin/chat/groups')
		}
	}, [router, searchParams])

	// Mostrar loading durante redirecionamento
	return (
		<div className='flex flex-1 min-h-0 bg-zinc-50 dark:bg-zinc-900 overflow-hidden'>
			<div className='flex-1 flex items-center justify-center'>
				<div className='text-center text-zinc-500 dark:text-zinc-400'>
					<div className='animate-spin w-8 h-8 mx-auto mb-4 text-zinc-400'>
						<span className='icon-[lucide--loader-2] w-8 h-8' />
					</div>
					<p className='text-sm'>Redirecionando...</p>
				</div>
			</div>
		</div>
	)
}
