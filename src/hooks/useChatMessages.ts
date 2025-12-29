import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useChat, MESSAGES_PER_PAGE } from '@/context/ChatContext'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { ChatMessage } from '@/context/ChatContext'

interface UseChatMessagesProps {
	activeTargetId: string | null
	activeTargetType: 'group' | 'user' | null
}

export function useChatMessages({ activeTargetId, activeTargetType }: UseChatMessagesProps) {
	const { messages, loadMessages, getMessagesCount, getUnreadMessages, loadMessagesBeforeUnread, loadMessagesAfterUnread, markMessagesAsRead, setMessages } = useChat()
	const { currentUser, loading: userLoading } = useCurrentUser()

	// Estados de carregamento
	const [isLoading, setIsLoading] = useState(false)
	const [isLoadingOlder, setIsLoadingOlder] = useState(false)
	const [isLoadingNewer, setIsLoadingNewer] = useState(false)
	
	// Estados de paginação
	const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(false)
	const [hasMoreNewerMessages, setHasMoreNewerMessages] = useState(false)
	// const [currentPage, setCurrentPage] = useState(1) // Não usado atualmente
	const [totalMessagesCount, setTotalMessagesCount] = useState(0)
	
	// Referências
	const lastTargetRef = useRef<string | null>(null)

	// Mensagens do target ativo (garantir ordem cronológica)
	const targetMessages = useMemo(() => {
		if (!activeTargetId) {
			return []
		}
		const msgs = messages[activeTargetId] || []

		// Garantir ordenação cronológica (mais antiga primeiro)
		return msgs.sort((a: ChatMessage, b: ChatMessage) => 
			new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
		)
	}, [messages, activeTargetId])

	// Calcular mensagens restantes
	const olderMessagesRemaining = Math.max(0, totalMessagesCount - targetMessages.length)
	const newerMessagesRemaining = 0 // Por enquanto sempre 0, pois carregamos mensagens não lidas primeiro

	// Carregar mensagens quando trocar de conversa
	useEffect(() => {
		if (activeTargetId && activeTargetType && activeTargetId !== lastTargetRef.current) {
			// Resetar estados de paginação
			// setCurrentPage(1) // Não usado atualmente
			setHasMoreOlderMessages(true)
			setHasMoreNewerMessages(true)
			setIsLoadingOlder(false)
			setIsLoadingNewer(false)
			lastTargetRef.current = activeTargetId

			// Carregamento inicial centrado nas mensagens não lidas
			setIsLoading(true)
			const loadInitialMessages = async () => {
				try {
					// 1. Buscar mensagens não lidas
					const unreadMessages = await getUnreadMessages(activeTargetId, activeTargetType, MESSAGES_PER_PAGE)

					// 2. Se não há mensagens não lidas, carregar mensagens recentes normalmente 
					if (unreadMessages.length === 0) {
						const result = await loadMessages(activeTargetId, activeTargetType)
						
						// Calcular hasMore baseado no total real de mensagens
						const loadedMessages = result.messages.length
						
						const totalCount = await getMessagesCount(activeTargetId, activeTargetType)
						
						const hasMoreOlderBasedOnTotal = loadedMessages < totalCount
						
						setHasMoreOlderMessages(hasMoreOlderBasedOnTotal)
						setHasMoreNewerMessages(false) // Mensagens recentes não têm mensagens posteriores
						setTotalMessagesCount(totalCount)
					} else {
						// 3. Há mensagens não lidas - armazenar no estado e definir como mensagens iniciais
						
						// Armazenar mensagens não lidas no estado do ChatContext
						setMessages(prev => ({
							...prev,
							[activeTargetId]: unreadMessages
						}))
						
						const totalCount = await getMessagesCount(activeTargetId, activeTargetType)
						const hasMoreOlderBasedOnTotal = unreadMessages.length < totalCount
						
						setHasMoreOlderMessages(hasMoreOlderBasedOnTotal)
						setHasMoreNewerMessages(false) // Por enquanto, assumir que não há mensagens posteriores às não lidas
						setTotalMessagesCount(totalCount)
					}
				} catch (error) {
					console.error('❌ [USE_CHAT_MESSAGES] Erro no carregamento inicial', { error })
				} finally {
					setIsLoading(false)
				}
			}

			loadInitialMessages()
		}
	}, [activeTargetId, activeTargetType, getUnreadMessages, loadMessages, getMessagesCount, setMessages])

	// Função para carregar mensagens mais antigas
	const handleLoadOlderMessages = useCallback(async () => {
		if (!activeTargetId || !activeTargetType || isLoadingOlder || !hasMoreOlderMessages) return
		
		setIsLoadingOlder(true)

		try {
			// Encontrar a mensagem mais antiga carregada
			const oldestMessage = targetMessages[0]
			if (!oldestMessage) {
				return
			}

			// Carregar mensagens anteriores à mensagem mais antiga
			const result = await loadMessagesBeforeUnread(
				activeTargetId, 
				activeTargetType, 
				new Date(oldestMessage.createdAt).toISOString(),
				MESSAGES_PER_PAGE
			)

			if (result.messages.length > 0) {
				// setCurrentPage((prev) => prev + 1) // Não usado atualmente
				
				// Atualizar hasMore baseado no resultado da API
				setHasMoreOlderMessages(result.hasMore)
			} else {
				setHasMoreOlderMessages(false)
			}
		} catch (error) {
			console.error('❌ [USE_CHAT_MESSAGES] Erro ao carregar mensagens antigas', { error })
		} finally {
			setIsLoadingOlder(false)
		}
	}, [activeTargetId, activeTargetType, loadMessagesBeforeUnread, targetMessages, isLoadingOlder, hasMoreOlderMessages])

	// Função para carregar mensagens mais recentes
	const handleLoadNewerMessages = useCallback(async () => {
		if (!activeTargetId || !activeTargetType || isLoadingNewer || !hasMoreNewerMessages) return
		
		setIsLoadingNewer(true)

		try {
			// Encontrar a mensagem mais recente carregada
			const newestMessage = targetMessages[targetMessages.length - 1]
			if (!newestMessage) {
				return
			}

			// Carregar mensagens posteriores à mensagem mais recente
			const result = await loadMessagesAfterUnread(
				activeTargetId, 
				activeTargetType, 
				new Date(newestMessage.createdAt).toISOString(),
				MESSAGES_PER_PAGE
			)

			if (result.messages.length > 0) {
				// Atualizar hasMore baseado no resultado da API
				setHasMoreNewerMessages(result.hasMore)
			} else {
				setHasMoreNewerMessages(false)
			}
		} catch (error) {
			console.error('❌ [USE_CHAT_MESSAGES] Erro ao carregar mensagens recentes', { error })
		} finally {
			setIsLoadingNewer(false)
		}
	}, [activeTargetId, activeTargetType, loadMessagesAfterUnread, targetMessages, isLoadingNewer, hasMoreNewerMessages])

	// Marcar mensagens como lidas quando usuário visualiza a conversa
	useEffect(() => {
		if (activeTargetId && activeTargetType && targetMessages.length > 0) {
			// Verificar se há mensagens não lidas de outros usuários
			const hasUnreadMessages = targetMessages.some(
				(msg) => !msg.readAt && msg.senderUserId !== currentUser?.id
			)

			if (hasUnreadMessages) {
				// Marcar todas as mensagens não lidas como lidas
				markMessagesAsRead(activeTargetId, activeTargetType)
			}
		}
	}, [activeTargetId, activeTargetType, targetMessages, currentUser?.id, markMessagesAsRead])

	return {
		// Estados
		isLoading: isLoading || userLoading, // Incluir carregamento do usuário
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
		currentUser,
		userLoading // Expor estado de carregamento do usuário
	}
}