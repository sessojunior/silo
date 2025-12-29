'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useChat } from '@/context/ChatContext'
import ChatSidebar from '@/components/admin/chat/ChatSidebar'
import ChatArea from '@/components/admin/chat/ChatArea'

export default function ChatLayout() {
	const pathname = usePathname()
	
	// Estado global do chat
	const { groups, users } = useChat()

	// Estado local para responsividade e seleção
	const [showSidebar, setShowSidebar] = useState(true)
	const [activeTargetId, setActiveTargetId] = useState<string | null>(null)
	const [activeTargetType, setActiveTargetType] = useState<'group' | 'user' | null>(null)

	// Extrair informações da rota atual
	useEffect(() => {
		
		// Extrair tipo e ID da rota
		const pathParts = pathname.split('/').filter(Boolean)
		const chatIndex = pathParts.indexOf('chat')
		
		if (chatIndex !== -1 && pathParts.length > chatIndex + 1) {
			const type = pathParts[chatIndex + 1] // 'groups' ou 'users'
			const id = pathParts[chatIndex + 2] // ID específico
			
			
			if (type === 'groups' && id) {
				setActiveTargetId(id)
				setActiveTargetType('group')
			} else if (type === 'users' && id) {
				setActiveTargetId(id)
				setActiveTargetType('user')
			} else if (type === 'groups') {
				setActiveTargetId(null)
				setActiveTargetType('group')
			} else if (type === 'users') {
				setActiveTargetId(null)
				setActiveTargetType('user')
			}
		} else {
			setActiveTargetId(null)
			setActiveTargetType(null)
		}
	}, [pathname])

	// Debug: carregar dados e verificar se há grupos/usuários
	useEffect(() => {


		if (groups?.length > 0) {
			const groupsData = groups.map((g) => ({ id: g.id, name: g.name }))
			console.log('ℹ️ [LAYOUT_CHAT] Grupos disponíveis:', { groups: groupsData })

		}

		if (users?.length > 0) {
			const usersData = users.map((u) => ({ id: u.id, name: u.name }))
			console.log('ℹ️ [LAYOUT_CHAT] Usuários com conversas:', { users: usersData })

		}
	}, [groups, users])

	// Debug: monitorar mudanças de target ativo
	useEffect(() => {

	}, [activeTargetId, activeTargetType])

	// Handler para seleção de target (grupo ou usuário)
	const handleTargetSelect = (targetId: string, type: 'group' | 'user') => {
		setActiveTargetId(targetId)
		setActiveTargetType(type)
	}

	// Encontrar dados do target ativo
	const activeTarget = activeTargetType === 'group' ? groups.find((g) => g.id === activeTargetId) : users.find((u) => u.id === activeTargetId)

	return (
		<div className='flex h-full min-h-0 bg-zinc-50 dark:bg-zinc-900 overflow-hidden'>
			{/* Sidebar de Chat - 384px (w-96) */}
			<div
				className={`
					${showSidebar ? 'w-96' : 'w-0'} 
					transition-all duration-300 border-r border-zinc-200 dark:border-zinc-700 
					bg-white dark:bg-zinc-800 flex-shrink-0 overflow-hidden
				`}
			>
				<ChatSidebar activeTargetId={activeTargetId} activeTargetType={activeTargetType} onTargetSelect={handleTargetSelect} />
			</div>

			{/* Área Principal de Chat */}
			<div className='flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden'>
				{activeTargetId && activeTargetType ? (
					<ChatArea activeTargetId={activeTargetId} activeTargetType={activeTargetType} activeTarget={activeTarget} onToggleSidebar={() => setShowSidebar(!showSidebar)} />
				) : (
					<div className='flex-1 flex items-center justify-center bg-zinc-50 dark:bg-zinc-900'>
						<div className='text-center text-zinc-500 dark:text-zinc-400'>
							<span className='icon-[lucide--message-circle] w-16 h-16 mx-auto mb-4 opacity-50' />
							<h3 className='text-lg font-medium mb-2'>Selecione uma conversa</h3>
							<p className='text-sm'>Escolha um grupo ou usuário para começar a conversar</p>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
