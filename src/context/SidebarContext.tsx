'use client'

import { createContext, useContext, useState, useEffect } from 'react'

type SidebarContextType = {
	isOpenSidebar: boolean
	setIsOpenSidebar: (openSidebar: boolean) => void
	openSidebar: () => void
	closeSidebar: () => void
	toggleSidebar: () => void
}

const SidebarContext = createContext<SidebarContextType | null>(null)

export const useSidebar = () => {
	const context = useContext(SidebarContext)
	if (!context) throw new Error('useSidebar must be used within a SidebarProvider')
	return context
}

export const SidebarProvider = ({ children }: { children: React.ReactNode }) => {
	const [isOpenSidebar, setIsOpenSidebar] = useState(false)

	// Em telas lg+, o sidebar deve estar sempre aberto por padrão
	useEffect(() => {
		const checkScreenSize = () => {
			if (window.innerWidth >= 1024) {
				setIsOpenSidebar(true)
			} else {
				setIsOpenSidebar(false)
			}
		}

		// Verificar tamanho inicial
		checkScreenSize()

		// Listener para mudanças de tamanho
		window.addEventListener('resize', checkScreenSize)

		// Cleanup
		return () => {
			window.removeEventListener('resize', checkScreenSize)
		}
	}, [])

	const openSidebar = () => setIsOpenSidebar(true)
	const closeSidebar = () => setIsOpenSidebar(false)
	const toggleSidebar = () => setIsOpenSidebar((prev) => !prev)

	return <SidebarContext.Provider value={{ isOpenSidebar, setIsOpenSidebar, openSidebar, closeSidebar, toggleSidebar }}>{children}</SidebarContext.Provider>
}
