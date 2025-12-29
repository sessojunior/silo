'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import Dialog from '@/components/ui/Dialog'
import Button from '@/components/ui/Button'

interface LogoutContextType {
	openLogoutDialog: () => void
}

const LogoutContext = createContext<LogoutContextType | undefined>(undefined)

export function LogoutProvider({ children }: { children: ReactNode }) {
	const [showLogoutDialog, setShowLogoutDialog] = useState(false)

	const openLogoutDialog = () => {
		setShowLogoutDialog(true)
	}

	return (
		<LogoutContext.Provider value={{ openLogoutDialog }}>
			{children}
			{/* Dialog compartilhado de confirmação de logout */}
			<Dialog
				open={showLogoutDialog}
				onClose={() => setShowLogoutDialog(false)}
				title='Confirmar saída'
				description='Tem certeza que deseja sair do sistema?'
			>
				<div className='flex gap-3 justify-end mt-6'>
					<Button type='button' style='bordered' onClick={() => setShowLogoutDialog(false)}>
						Cancelar
					</Button>
					<Button
						type='button'
						onClick={() => {
							window.location.href = '/api/logout'
						}}
						className='bg-red-600 hover:bg-red-700 focus:bg-red-700'
					>
						<span className='icon-[lucide--log-out] size-4 mr-2' />
						Sair
					</Button>
				</div>
			</Dialog>
		</LogoutContext.Provider>
	)
}

export function useLogout() {
	const context = useContext(LogoutContext)
	if (context === undefined) {
		throw new Error('useLogout deve ser usado dentro de LogoutProvider')
	}
	return context
}

