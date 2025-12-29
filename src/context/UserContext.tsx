'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

// === TIPOS ===

interface User {
	id: string
	name: string
	email: string
	isActive: boolean
	emailVerified: boolean
	image: string
}

interface UserProfile {
	genre?: string
	role?: string
	phone?: string
	company?: string
	location?: string
	team?: string
}

interface UserPreferences {
	chatEnabled?: boolean
	showWelcome?: boolean
}

interface UserContextType {
	// Estados principais
	user: User | null
	userProfile: UserProfile | null
	userPreferences: UserPreferences | null
	loading: boolean
	error: string | null

	// Funções de atualização
	updateUser: (updates: Partial<User>) => void
	updateUserProfile: (updates: Partial<UserProfile>) => void
	updateUserPreferences: (updates: Partial<UserPreferences>) => void
	refreshUser: () => Promise<void>
	refreshUserProfile: () => Promise<void>
	refreshUserPreferences: () => Promise<void>

	// Funções de sincronização
	syncUserData: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

// === PROVIDER ===

export function UserProvider({ children }: { children: React.ReactNode }) {
	// Estados principais
	const [user, setUser] = useState<User | null>(null)
	const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
	const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	// === FUNÇÕES DE BUSCA ===

	const fetchUser = useCallback(async (): Promise<User | null> => {
		try {
			const response = await fetch('/api/user-profile')
			
			if (response.ok) {
				const data = await response.json()
				if (data.user) {
					const userData: User = {
						id: data.user.id,
						name: data.user.name,
						email: data.user.email,
						isActive: data.user.isActive,
						emailVerified: data.user.emailVerified,
						image: data.user.image || '/images/profile.png'
					}
					return userData
				}
			} else if (response.status === 401) {
				console.warn('⚠️ [CONTEXT_USER] Usuário não autenticado')
				return null
			}
		} catch (err) {
			console.error('❌ [CONTEXT_USER] Erro ao buscar usuário:', { error: err })
		}
		return null
	}, [])

	const fetchUserProfile = useCallback(async (): Promise<UserProfile | null> => {
		try {
			const response = await fetch('/api/user-profile')
			
			if (response.ok) {
				const data = await response.json()
				if (data.userProfile) {
					const profileData: UserProfile = {
						genre: data.userProfile.genre,
						role: data.userProfile.role,
						phone: data.userProfile.phone,
						company: data.userProfile.company,
						location: data.userProfile.location,
						team: data.userProfile.team,
					}
					return profileData
				}
			}
		} catch (err) {
			console.error('❌ [CONTEXT_USER] Erro ao buscar perfil:', { error: err })
		}
		return null
	}, [])

	const fetchUserPreferences = useCallback(async (): Promise<UserPreferences | null> => {
		try {
			const response = await fetch('/api/user-preferences')
			
			if (response.ok) {
				const data = await response.json()
				if (data.userPreferences) {
					const preferencesData: UserPreferences = {
						chatEnabled: data.userPreferences.chatEnabled,
						showWelcome: data.userPreferences.showWelcome,
					}
					return preferencesData
				}
			}
		} catch (err) {
			console.error('❌ [CONTEXT_USER] Erro ao buscar preferências:', { error: err })
		}
		return null
	}, [])

	// === FUNÇÕES DE ATUALIZAÇÃO ===

	const updateUser = useCallback((updates: Partial<User>) => {
		setUser(prev => prev ? { ...prev, ...updates } : null)
	}, [])

	const updateUserProfile = useCallback((updates: Partial<UserProfile>) => {
		setUserProfile(prev => prev ? { ...prev, ...updates } : updates)
	}, [])

	const updateUserPreferences = useCallback((updates: Partial<UserPreferences>) => {
		setUserPreferences(prev => prev ? { ...prev, ...updates } : updates)
		
		// Disparar evento customizado para notificar outros componentes
		window.dispatchEvent(new CustomEvent('userPreferencesChanged', { detail: updates }))
	}, [])

	// === FUNÇÕES DE REFRESH ===

	const refreshUser = useCallback(async () => {
		const userData = await fetchUser()
		if (userData) {
			setUser(userData)
		}
	}, [fetchUser])

	const refreshUserProfile = useCallback(async () => {
		const profileData = await fetchUserProfile()
		if (profileData) {
			setUserProfile(profileData)
		}
	}, [fetchUserProfile])

	const refreshUserPreferences = useCallback(async () => {
		const preferencesData = await fetchUserPreferences()
		if (preferencesData) {
			setUserPreferences(preferencesData)
		}
	}, [fetchUserPreferences])

	const syncUserData = useCallback(async () => {
		setLoading(true)
		setError(null)
		
		try {
			const [userData, profileData, preferencesData] = await Promise.all([
				fetchUser(),
				fetchUserProfile(),
				fetchUserPreferences()
			])
			
			if (userData) {
				setUser(userData)
			}
			if (profileData) {
				setUserProfile(profileData)
			}
			if (preferencesData) {
				setUserPreferences(preferencesData)
			}
			
		} catch (err) {
			console.error('❌ [CONTEXT_USER] Erro na sincronização:', { error: err })
			setError('Erro ao sincronizar dados do usuário')
		} finally {
			setLoading(false)
		}
	}, [fetchUser, fetchUserProfile, fetchUserPreferences])

	// === INICIALIZAÇÃO ===

	useEffect(() => {
		syncUserData()
	}, [syncUserData])

	// === LISTENERS PARA EVENTOS CUSTOMIZADOS ===

	useEffect(() => {
		// Listener para mudanças de preferências de chat
		const handleChatPreferenceChange = (event: CustomEvent) => {
			const { chatEnabled } = event.detail
			updateUserPreferences({ chatEnabled })
		}

		// Listener para mudanças de perfil
		const handleProfileChange = (event: CustomEvent) => {
			const updates = event.detail
			updateUserProfile(updates)
		}

		// Listener para mudanças de dados do usuário
		const handleUserChange = (event: CustomEvent) => {
			const updates = event.detail
			updateUser(updates)
		}

		window.addEventListener('chatPreferenceChanged', handleChatPreferenceChange as EventListener)
		window.addEventListener('userProfileChanged', handleProfileChange as EventListener)
		window.addEventListener('userDataChanged', handleUserChange as EventListener)

		return () => {
			window.removeEventListener('chatPreferenceChanged', handleChatPreferenceChange as EventListener)
			window.removeEventListener('userProfileChanged', handleProfileChange as EventListener)
			window.removeEventListener('userDataChanged', handleUserChange as EventListener)
		}
	}, [updateUserPreferences, updateUserProfile, updateUser])

	// === VALOR DO CONTEXTO ===

	const value: UserContextType = {
		user,
		userProfile,
		userPreferences,
		loading,
		error,
		updateUser,
		updateUserProfile,
		updateUserPreferences,
		refreshUser,
		refreshUserProfile,
		refreshUserPreferences,
		syncUserData,
	}

	return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

// === HOOKS ===

/**
 * Hook para usar o contexto do usuário
 */
export function useUser(): UserContextType {
	const context = useContext(UserContext)
	if (context === undefined) {
		throw new Error('useUser deve ser usado dentro de um UserProvider')
	}
	return context
}

/**
 * Hook para obter apenas os dados básicos do usuário (compatibilidade com useCurrentUser)
 */
export function useCurrentUser(): { currentUser: User | null; loading: boolean; error: string | null } {
	const { user, loading, error } = useUser()
	return { currentUser: user, loading, error }
}

/**
 * Hook para obter apenas o perfil do usuário
 */
export function useUserProfile(): { userProfile: UserProfile | null; loading: boolean; error: string | null } {
	const { userProfile, loading, error } = useUser()
	return { userProfile, loading, error }
}

/**
 * Hook para obter apenas as preferências do usuário
 */
export function useUserPreferences(): { userPreferences: UserPreferences | null; loading: boolean; error: string | null } {
	const { userPreferences, loading, error } = useUser()
	return { userPreferences, loading, error }
}
