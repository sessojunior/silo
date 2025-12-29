'use client'

import { useChat } from '@/context/ChatContext'
import { useChatMessages } from '@/hooks/useChatMessages'
import { ChatHeader } from './ChatHeader'
import { MessagesList } from './MessagesList'
import { MessageInput } from './MessageInput'
import { EmptyChatState } from './EmptyChatState'
import type { ChatGroup, ChatUser } from '@/context/ChatContext'

type ChatAreaProps = {
	activeTargetId: string | null
	activeTargetType: 'group' | 'user' | null
	activeTarget: ChatGroup | ChatUser | undefined
	onToggleSidebar: () => void
}

export default function ChatArea({ activeTargetId, activeTargetType, activeTarget, onToggleSidebar }: ChatAreaProps) {
	const { sendMessage } = useChat()
	
	const {
		// Estados
		isLoading,
		isLoadingOlder,
		isLoadingNewer,
		hasMoreOlderMessages,
		hasMoreNewerMessages,
		totalMessagesCount,
		
		// Dados
		targetMessages,
		olderMessagesRemaining,
		newerMessagesRemaining,
		
		// Funções
		handleLoadOlderMessages,
		handleLoadNewerMessages,
		
		// Referências
		currentUser
	} = useChatMessages({ activeTargetId, activeTargetType })

	// Enviar mensagem
	const handleSendMessage = async (messageText: string) => {
		if (!activeTargetId || !activeTargetType) return
		
		if (activeTargetType === 'group') {
			await sendMessage(messageText, activeTargetId, undefined)
		} else if (activeTargetType === 'user') {
			await sendMessage(messageText, undefined, activeTargetId)
		}
	}

	if (!activeTargetId || !activeTargetType) {
		return <EmptyChatState />
	}

	return (
		<div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-900">
			{/* Header */}
			<ChatHeader
				activeTarget={activeTarget}
				activeTargetType={activeTargetType}
				totalMessages={targetMessages.length}
				totalMessagesCount={totalMessagesCount}
				onToggleSidebar={onToggleSidebar}
			/>

			{/* Lista de Mensagens */}
			<MessagesList
				messages={targetMessages}
				isLoading={isLoading}
				isLoadingOlder={isLoadingOlder}
				isLoadingNewer={isLoadingNewer}
				hasMoreOlderMessages={hasMoreOlderMessages}
				hasMoreNewerMessages={hasMoreNewerMessages}
				olderMessagesRemaining={olderMessagesRemaining}
				newerMessagesRemaining={newerMessagesRemaining}
				currentUserId={currentUser?.id}
				activeTargetId={activeTargetId}
				onLoadOlderMessages={handleLoadOlderMessages}
				onLoadNewerMessages={handleLoadNewerMessages}
			/>

			{/* Input de Mensagem */}
			<MessageInput
				onSendMessage={handleSendMessage}
				isSending={false} // TODO: Implementar estado de envio se necessário
			/>
		</div>
	)
}