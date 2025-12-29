'use client'

import { useCurrentUser as useUserContext } from '@/context/UserContext'

/**
 * Hook para obter informações do usuário atual
 * Agora usa o UserContext para dados em tempo real
 * @returns {CurrentUserResult} Estado do usuário atual
 */
export function useCurrentUser() {
	return useUserContext()
}
