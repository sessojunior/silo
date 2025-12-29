'use client'

import { useState, useCallback, useRef } from 'react'
import { useChat } from '@/context/ChatContext'

interface UnreadMessage {
	content: string
	senderName: string
	createdAt: Date
}

interface ConversationData {
	messages: UnreadMessage[]
	totalCount: number
}

export function useChatNotifications() {
	const [unreadMessages, setUnreadMessages] = useState<Record<string, ConversationData>>({})
	const [isLoading, setIsLoading] = useState(false)
	const { groups, users, totalUnread } = useChat()
	const isLoadingRef = useRef(false)

	// Carregar mensagens não lidas
	const loadUnreadMessages = useCallback(async () => {
		if (isLoadingRef.current) return

		try {
			isLoadingRef.current = true
			setIsLoading(true)
			const response = await fetch('/api/admin/chat/unread-messages')
			
			if (response.ok) {
				const data = await response.json()
				setUnreadMessages(data.unreadMessages || {})
			}
		} catch (error) {
			console.error('❌ [HOOK_CHAT_NOTIFICATIONS] Erro ao carregar mensagens não lidas:', { error })
		} finally {
			isLoadingRef.current = false
			setIsLoading(false)
		}
	}, [])

	// Limpar mensagens não lidas
	const clearUnreadMessages = useCallback(() => {
		setUnreadMessages({})
	}, [])

	// Obter conversas com mensagens não lidas
	const getConversationsWithUnread = useCallback(() => {

		// Usar dados das mensagens não lidas carregadas da API
		const conversations = Object.entries(unreadMessages).map(([conversationId, conversationData]) => {
			// Buscar informações do grupo ou usuário
			const group = groups?.find(g => g.id === conversationId)
			const user = users?.find(u => u.id === conversationId)
			
			if (group) {
				// É um grupo
				return {
					id: group.id,
					name: group.name,
					type: 'group' as const,
					unreadCount: conversationData.totalCount,
					lastMessageAt: conversationData.messages[0]?.createdAt,
					lastMessage: conversationData.messages[0]?.content,
					presenceStatus: 'visible' as const,
					messages: conversationData.messages, // Mensagens já ordenadas pela API
				}
			} else if (user) {
				// É um usuário
				return {
					id: user.id,
					name: user.name,
					type: 'user' as const,
					unreadCount: conversationData.totalCount,
					lastMessageAt: conversationData.messages[0]?.createdAt,
					lastMessage: conversationData.messages[0]?.content,
					presenceStatus: user.presenceStatus,
					messages: conversationData.messages, // Mensagens já ordenadas pela API
				}
			}
			return null
		}).filter(Boolean) // Remover nulos

		const sortedConversations = conversations
			.sort((a, b) => {
				if (!a || !b) return 0
				// Prioridade: mensagens não lidas
				if (a.unreadCount !== b.unreadCount) {
					return b.unreadCount - a.unreadCount
				}
				// Por última mensagem mais recente
				if (a.lastMessageAt && b.lastMessageAt) {
					return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
				}
				return 0
			})
			.slice(0, 5) // Limitar a 5 conversas

		return sortedConversations
	}, [groups, users, unreadMessages])

	return {
		unreadMessages,
		isLoading,
		totalUnread,
		loadUnreadMessages,
		clearUnreadMessages,
		getConversationsWithUnread,
	}
}
