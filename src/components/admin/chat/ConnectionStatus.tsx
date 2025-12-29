'use client'

import { useChat } from '@/context/ChatContext'

export default function ConnectionStatus() {
	const { currentPresence, isLoading } = useChat()

	// Se está visível, não mostrar nada
	if (currentPresence === 'visible') {
		return null
	}

	return (
		<div className='flex items-center justify-center gap-2 bg-yellow-50 px-4 py-2 text-sm text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'>
			{isLoading ? (
				<>
					<div className='h-2 w-2 animate-spin rounded-full border border-yellow-600 border-t-transparent'></div>
					<span>Conectando ao chat...</span>
				</>
			) : (
				<>
					<span className='h-2 w-2 rounded-full bg-red-500'></span>
					<span>Status: {currentPresence}</span>
				</>
			)}
		</div>
	)
}
