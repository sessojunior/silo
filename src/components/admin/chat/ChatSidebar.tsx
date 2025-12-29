'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useChat, ChatGroup, ChatUser } from '@/context/ChatContext'
import { formatDateBR } from '@/lib/dateUtils'
import Avatar from '@/components/ui/Avatar'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

type ChatSidebarProps = {
	activeTargetId: string | null
	activeTargetType: 'group' | 'user' | null
	onTargetSelect: (targetId: string, type: 'group' | 'user') => void
}

export default function ChatSidebar({ activeTargetId, activeTargetType, onTargetSelect }: ChatSidebarProps) {
	const router = useRouter()

	const { currentUser } = useCurrentUser()
	const { groups, users, totalUnread, currentPresence, updatePresence, isLoading } = useChat()

	const [searchQuery, setSearchQuery] = useState('')
	const [activeTab, setActiveTab] = useState<'groups' | 'users'>(
		activeTargetType === 'user' ? 'users' : 'groups'
	)
	const [showStatusMenu, setShowStatusMenu] = useState(false)

	// Sincronizar aba ativa com o tipo de target selecionado
	useEffect(() => {
		if (activeTargetType === 'user') {
			setActiveTab('users')
		} else if (activeTargetType === 'group') {
			setActiveTab('groups')
		}
	}, [activeTargetType])

	// Filtrar grupos baseado na busca
	const filteredGroups = groups.filter((group) => group.name?.toLowerCase().includes(searchQuery.toLowerCase()) || group.description?.toLowerCase().includes(searchQuery.toLowerCase()))

	// Filtrar usuários baseado na busca
	const filteredUsers = users.filter((chatUser) => chatUser.name?.toLowerCase().includes(searchQuery.toLowerCase()) || chatUser.email?.toLowerCase().includes(searchQuery.toLowerCase()))

	// Alterar status do usuário
	const handleStatusChange = async (newStatus: 'visible' | 'invisible') => {
		try {
			await updatePresence(newStatus)
			setShowStatusMenu(false)
		} catch (error) {
			console.error('❌ [COMPONENT_CHAT_SIDEBAR] Erro ao alterar status:', { newStatus, error })
		}
	}

	// Navegar para aba específica
	const handleTabChange = (tab: 'groups' | 'users') => {
		setActiveTab(tab)
		router.push(`/admin/chat/${tab}`)
	}

	// Navegar para conversa específica
	const handleConversationSelect = (targetId: string, type: 'group' | 'user') => {
		onTargetSelect(targetId, type)
		router.push(`/admin/chat/${type === 'group' ? 'groups' : 'users'}/${targetId}`)
	}

	// Obter informações do status atual
	const getStatusInfo = (status: string) => {
		switch (status) {
			case 'visible':
				return { label: 'Visível', color: 'bg-green-400', textColor: 'text-green-500' }
			case 'invisible':
				return { label: 'Invisível', color: 'bg-red-400', textColor: 'text-red-500' }
			default:
				return { label: 'Invisível', color: 'bg-red-400', textColor: 'text-red-500' }
		}
	}

	const statusInfo = getStatusInfo(currentPresence)

	return (
		<div className='flex flex-col h-full'>
			{/* Header da Sidebar */}
			<div className='border-b border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800'>
				<div className='flex items-center gap-3 mb-3 p-4 border-b border-zinc-200 dark:border-zinc-700'>
					<Avatar 
						src={currentUser?.image} 
						name={currentUser?.name || 'Usuário'} 
						size="md"
						showPresence={true}
						presenceColor={statusInfo.color}
					/>
					<div className='flex-1'>
						<h2 className='font-semibold text-sm text-zinc-900 dark:text-white'>{currentUser?.name || 'Usuário'}</h2>
						<div className='flex items-center gap-2'>
							<p className={`text-xs ${statusInfo.textColor}`}>{statusInfo.label}</p>
						</div>
					</div>
					<div className='relative'>
						<button onClick={() => setShowStatusMenu(!showStatusMenu)} className='flex items-center justify-center size-10 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors'>
							<span className='icon-[lucide--more-vertical] size-5 text-zinc-600 dark:text-zinc-300' />
						</button>

						{/* Dropdown de Status */}
						{showStatusMenu && (
							<>
								{/* Overlay para fechar */}
								<div className='fixed inset-0 z-40' onClick={() => setShowStatusMenu(false)} />

								<div className='absolute right-0 top-full mt-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-2 w-48 z-50'>
									<div className='px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700'>Alterar Status</div>
									{[
										{ key: 'visible', label: 'Visível', color: 'bg-green-400' },
										{ key: 'invisible', label: 'Invisível', color: 'bg-red-400' },
									].map((status) => (
										<button 
											key={status.key} 
											onClick={() => handleStatusChange(status.key as 'visible' | 'invisible')} 
											className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors ${currentPresence === status.key ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
											title={status.key === 'invisible' ? 'Status usado para férias, licença, aposentado, saiu da empresa, usuário inativo etc.' : ''}
										>
											<div className={`w-3 h-3 rounded-full ${status.color}`} />
											<span className='text-sm text-zinc-900 dark:text-white'>{status.label}</span>
											{currentPresence === status.key && <span className='icon-[lucide--check] w-4 h-4 text-blue-500 ml-auto' />}
										</button>
									))}
								</div>
							</>
						)}
					</div>
				</div>

				{/* Abas */}
				<div className='flex mb-3 bg-white dark:bg-zinc-700 rounded-lg p-1 m-4'>
					<button onClick={() => handleTabChange('groups')} className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-colors ${activeTab === 'groups' ? 'bg-blue-500 text-white' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-600'}`}>
						<span className='icon-[lucide--users] w-3 h-3 inline mr-1' />
						Grupos ({groups.length})
					</button>
					<button onClick={() => handleTabChange('users')} className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-colors ${activeTab === 'users' ? 'bg-blue-500 text-white' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-600'}`}>
						<span className='icon-[lucide--user] w-3 h-3 inline mr-1' />
						Usuários ({users.length})
					</button>
				</div>
			</div>

			<div className='border-b border-zinc-200 dark:border-zinc-700 p-4'>
				{/* Busca */}
				<div className='relative flex flex-1 h-10'>
					<input type='text' placeholder={activeTab === 'groups' ? 'Procurar conversas em grupos...' : 'Procurar conversas com usuários...'} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className='block w-full rounded-lg border-zinc-200 px-4 py-2.5 pe-11 sm:py-3 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:placeholder-zinc-500 focus:border-blue-500 focus:ring-blue-500' />
					<div className='pointer-events-none absolute inset-y-0 end-0 z-20 flex items-center pe-4'>
						<span className='icon-[lucide--search] ml-1 size-4 shrink-0 text-zinc-400 dark:text-zinc-500'></span>
					</div>
				</div>
			</div>

			{/* Conteúdo baseado na aba ativa */}
			<div className='flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-500 [&::-webkit-scrollbar-track]:bg-zinc-100 dark:[&::-webkit-scrollbar-track]:bg-zinc-700'>
				{activeTab === 'groups' ? (
					// Lista de Grupos
					isLoading ? (
						<div className='p-6 text-center text-zinc-500 dark:text-zinc-400'>
							<LoadingSpinner 
								text="Carregando grupos..." 
								size="xs" 
								variant="horizontal" 
							/>
						</div>
					) : filteredGroups.length === 0 ? (
						<div className='p-6 text-center text-zinc-500 dark:text-zinc-400'>
							<span className='icon-[lucide--users] w-8 h-8 mx-auto mb-2 opacity-50' />
							<p className='text-sm'>{searchQuery ? 'Nenhum grupo encontrado' : 'Nenhum grupo disponível'}</p>
						</div>
					) : (
						<div>
							{filteredGroups.map((group) => (
								<GroupItem key={group.id} group={group} isActive={group.id === activeTargetId && activeTargetType === 'group'} onClick={() => handleConversationSelect(group.id, 'group')} />
							))}
						</div>
					)
				) : (
					// Lista de Usuários
					isLoading ? (
						<div className='p-6 text-center text-zinc-500 dark:text-zinc-400'>
							<LoadingSpinner 
								text="Carregando usuários..." 
								size="xs" 
								variant="horizontal" 
							/>
						</div>
					) : (
						<div className='py-2'>
							{filteredUsers.length === 0 ? (
								<div className='p-6 text-center text-zinc-500 dark:text-zinc-400'>
									<span className='icon-[lucide--user] w-8 h-8 mx-auto mb-2 opacity-50' />
									<p className='text-sm'>{searchQuery ? 'Nenhum usuário encontrado' : 'Nenhum usuário disponível'}</p>
								</div>
							) : (
								filteredUsers.map((chatUser) => <UserItem key={chatUser.id} user={chatUser} isActive={chatUser.id === activeTargetId && activeTargetType === 'user'} onClick={() => handleConversationSelect(chatUser.id, 'user')} />)
							)}
						</div>
					)
				)}
			</div>

			{/* Footer com informações */}
			<div className='p-3 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900'>
				<div className='flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400'>
					<span>{activeTab === 'groups' ? `${filteredGroups.length} grupos` : `${filteredUsers.length} usuários`}</span>
					<span className='flex items-center gap-1'>
						{totalUnread > 0 && <span className='bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs font-medium'>{totalUnread}</span>}
						<div className={`w-2 h-2 rounded-full ${statusInfo.color}`} />
						{statusInfo.label}
					</span>
				</div>
			</div>
		</div>
	)
}

// Componente individual do grupo
function GroupItem({ group, isActive, onClick }: { group: ChatGroup; isActive: boolean; onClick: () => void }) {
	const iconClass = group.icon || 'icon-[lucide--users]'
	const groupColor = group.color || '#6B7280'

	return (
		<button
			onClick={onClick}
			className={`
				w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-700 
				transition-colors text-left border-l-4 
				${isActive ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-300' : 'border-transparent'}
			`}
		>
			{/* Ícone do Grupo */}
			<div className='flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium' style={{ backgroundColor: groupColor }}>
				<span className={`${iconClass} w-5 h-5`} />
			</div>

			{/* Informações do Grupo */}
			<div className='flex-1 min-w-0'>
				<div className='flex items-center justify-between mb-1'>
					<h3 className={`font-medium text-sm truncate ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-zinc-900 dark:text-zinc-100'}`}>{group.name}</h3>
					<div className='flex items-center gap-1'>
						{group.unreadCount > 0 && <span className='flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white'>{group.unreadCount > 99 ? '+99' : group.unreadCount}</span>}
					</div>
				</div>
				<p className='text-xs text-zinc-500 dark:text-zinc-400 truncate'>{group.description || 'Grupo organizacional'}</p>
			</div>

			{/* Badge de ativo */}
			<div className='flex-shrink-0'>{isActive && <div className='w-2 h-2 bg-blue-500 rounded-full' />}</div>
		</button>
	)
}

// Componente individual do usuário
function UserItem({ user, isActive, onClick }: { user: ChatUser; isActive: boolean; onClick: () => void }) {
	const getPresenceColor = (status: string) => {
		switch (status) {
			case 'visible':
				return 'bg-green-400'
			case 'invisible':
				return 'bg-red-400'
			default:
				return 'bg-red-400'
		}
	}

	const formatLastMessage = (lastMessageAt: Date | null) => {
		if (!lastMessageAt) return ''

		const now = new Date()
		const diff = now.getTime() - new Date(lastMessageAt).getTime()
		const minutes = Math.floor(diff / (1000 * 60))
		const hours = Math.floor(diff / (1000 * 60 * 60))
		const days = Math.floor(diff / (1000 * 60 * 60 * 24))

		if (minutes < 5) return 'agora'
		if (minutes < 60) return `${minutes}m`
		if (hours < 24) return `${hours}h`
		if (days < 7) return `${days}d`
		return formatDateBR(new Date(lastMessageAt).toISOString().split('T')[0]).replace(/\d{4}/, '').trim()
	}

	return (
		<button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-left border-l-4 ${isActive ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500' : 'border-transparent'}`}>
			{/* Avatar do Usuário */}
			<Avatar 
				src={user.image} 
				name={user.name} 
				size="md"
				showPresence={true}
				presenceColor={getPresenceColor(user.presenceStatus)}
			/>

			{/* Informações do Usuário */}
			<div className='flex-1 min-w-0'>
				<div className='flex items-center justify-between mb-1'>
					<h3 className={`font-medium text-sm truncate ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-zinc-900 dark:text-zinc-100'}`}>{user.name}</h3>
					<div className='flex items-center gap-1'>
						{user.lastMessageAt && <span className='text-xs text-zinc-500 dark:text-zinc-400'>{formatLastMessage(user.lastMessageAt)}</span>}
						{user.unreadCount > 0 && <span className='flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white'>{user.unreadCount > 99 ? '+99' : user.unreadCount}</span>}
					</div>
				</div>
				{user.lastMessage && <p className='text-xs text-zinc-500 dark:text-zinc-400 truncate'>{user.lastMessage}</p>}
			</div>
		</button>
	)
}
