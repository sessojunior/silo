'use client'

import { useState, useEffect, useCallback } from 'react'
import { useChat } from '@/context/ChatContext'

export function useChatPresence() {
	const [localPresence, setLocalPresence] = useState<'visible' | 'invisible'>('invisible')
	const { currentPresence, updatePresence } = useChat()

	// Sincronizar com o contexto
	useEffect(() => {
		if (currentPresence && currentPresence !== 'invisible') {
			setLocalPresence(currentPresence)
		}
	}, [currentPresence])

	// Buscar status atual da API
	const fetchCurrentPresence = useCallback(async () => {
		try {
			const response = await fetch('/api/admin/chat/presence')
			if (response.ok) {
				const data = await response.json()
				if (data.currentUserPresence) {
					setLocalPresence(data.currentUserPresence.status)
				}
			}
		} catch (error) {
			console.error('❌ [HOOK_CHAT_PRESENCE] Erro ao buscar status atual:', { error })
		}
	}, [])

	// Alterar status de presença
	const changePresence = useCallback(async (status: 'visible' | 'invisible') => {
		setLocalPresence(status)
		await updatePresence(status)
	}, [updatePresence])

	return {
		localPresence,
		changePresence,
		fetchCurrentPresence,
	}
}
