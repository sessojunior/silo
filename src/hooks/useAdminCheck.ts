'use client'

import { useState, useEffect } from 'react'

interface AdminCheckResult {
	isAdmin: boolean
	loading: boolean
	error: string | null
}

/**
 * Hook para verificar se o usuário atual é administrador
 * @returns {AdminCheckResult} Estado da verificação de administrador
 */
export function useAdminCheck(): AdminCheckResult {
	const [isAdmin, setIsAdmin] = useState(false)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		checkAdminStatus()
	}, [])

	const checkAdminStatus = async () => {
		try {
			setLoading(true)
			setError(null)
			
			console.log('ℹ️ [HOOK_ADMIN_CHECK] Verificando se usuário atual é administrador...')
			
			// Fazer uma chamada para a API específica de verificação de administrador
			const response = await fetch('/api/admin/check-admin')
			
			if (response.ok) {
				const data = await response.json()
				if (data.success) {
					setIsAdmin(data.isAdmin)
				} else {
					setIsAdmin(false)
					setError(data.error || 'Erro ao verificar permissões')
					console.error('❌ [HOOK_ADMIN_CHECK] Erro na resposta da API:', { error: data.error })
				}
			} else if (response.status === 401) {
				// Usuário não autenticado
				setIsAdmin(false)
				console.warn('⚠️ [HOOK_ADMIN_CHECK] Usuário não autenticado')
			} else {
				// Outros erros
				setIsAdmin(false)
				setError('Erro ao verificar permissões')
				console.warn('⚠️ [HOOK_ADMIN_CHECK] Erro ao verificar permissões:', { status: response.status })
			}
		} catch (err) {
			console.error('❌ [HOOK_ADMIN_CHECK] Erro ao verificar status de administrador:', { error: err })
			setIsAdmin(false)
			setError('Erro ao verificar permissões')
		} finally {
			setLoading(false)
		}
	}

	return { isAdmin, loading, error }
}
