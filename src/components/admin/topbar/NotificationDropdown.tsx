'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useChat } from '@/context/ChatContext'
import PresenceToggle from './PresenceToggle'
import ConversationList from './ConversationList'
import { useChatNotifications } from '@/hooks/useChatNotifications'
import { useChatPresence } from '@/hooks/useChatPresence'

interface NotificationDropdownProps {
	onClose: () => void
}

export default function NotificationDropdown({ onClose }: NotificationDropdownProps) {
	const router = useRouter()
	const { loadSidebarData } = useChat()
	const { totalUnread, isLoading, loadUnreadMessages, clearUnreadMessages, getConversationsWithUnread } = useChatNotifications()
	const { localPresence, changePresence, fetchCurrentPresence } = useChatPresence()

	// Carregar dados ao montar o componente (quando dropdown é aberto)
	useEffect(() => {
		fetchCurrentPresence()
		loadUnreadMessages()
	}, [fetchCurrentPresence, loadUnreadMessages])

	// Listener para atualizar mensagens quando marcadas como lidas
	useEffect(() => {
		const handleMessagesRead = () => {
			loadUnreadMessages()
		}

		window.addEventListener('messagesRead', handleMessagesRead)
		
		return () => {
			window.removeEventListener('messagesRead', handleMessagesRead)
		}
	}, [loadUnreadMessages])

	// Atualizar mensagens quando totalUnread aumenta (novas mensagens chegaram)
	useEffect(() => {
		if (totalUnread > 0) {
			loadUnreadMessages()
		}
	}, [totalUnread, loadUnreadMessages])

	// Atualizar notificações
	const handleRefresh = async () => {
		await loadSidebarData()
		await loadUnreadMessages()
	}

	// Fechar dropdown
	const handleClose = () => {
		clearUnreadMessages()
		onClose()
	}

	// Navegar para todas as conversas
	const handleViewAllConversations = () => {
		onClose()
		router.push('/admin/chat/groups')
	}

	// Obter conversas com mensagens não lidas
	const conversations = useMemo(() => {
		const rawConversations = getConversationsWithUnread()
		
		const mappedConversations = rawConversations
			.filter((conv): conv is NonNullable<typeof conv> => conv !== null)
			.map(conv => ({
				...conv,
				lastMessageAt: conv.lastMessageAt ? (conv.lastMessageAt instanceof Date ? conv.lastMessageAt.toISOString() : new Date(conv.lastMessageAt).toISOString()) : undefined,
				lastMessage: conv.lastMessage || undefined
			}))
		
		return mappedConversations
	}, [getConversationsWithUnread])

	return (
		<>
			{/* Overlay */}
			<div className='fixed inset-0 z-40' onClick={handleClose} />

			{/* Content */}
			<div className='absolute right-0 top-full z-50 mt-2 w-80 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg'>
				{/* Header */}
				<div className='px-4 py-2 border-b border-zinc-200 dark:border-zinc-700'>
					<div className='flex items-center justify-between'>
						<div className='flex items-center gap-2'>
							<h3 className='font-semibold text-zinc-900 dark:text-zinc-100'>Chat</h3>
							{totalUnread > 0 && (
								<span className='flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white'>
									{totalUnread > 99 ? '+99' : totalUnread}
								</span>
							)}
						</div>
						<div className='flex items-center gap-2'>
							<button 
								onClick={handleRefresh} 
								className='flex items-center justify-center size-8 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all duration-200'
								title='Verificar novas mensagens'
							>
								<span className='icon-[lucide--refresh-cw] w-4 h-4' />
							</button>
						</div>
					</div>
				</div>

				{/* Presence Toggle */}
				<PresenceToggle 
					currentPresence={localPresence}
					onPresenceChange={changePresence}
				/>

				{/* Conversation List */}
				<div className='max-h-80 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-500 [&::-webkit-scrollbar-track]:bg-zinc-100 dark:[&::-webkit-scrollbar-track]:bg-zinc-700'>
					<ConversationList 
						conversations={conversations}
						isLoading={isLoading}
						onConversationClick={() => handleClose()}
					/>
				</div>

				{/* Footer */}
				<div className='px-2 py-1 border-t border-zinc-200 dark:border-zinc-700'>
					<button
						className='w-full text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 py-2 rounded transition-colors'
						onClick={handleViewAllConversations}
					>
						Ver todas as conversas
					</button>
				</div>
			</div>
		</>
	)
}
