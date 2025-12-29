'use client'

import { useRouter } from 'next/navigation'
import { formatDateTimeBR } from '@/lib/dateUtils'
import Avatar from '@/components/ui/Avatar'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface Conversation {
	id: string
	name: string
	type: 'group' | 'user'
	image?: string | null
	unreadCount: number
	lastMessageAt?: string
	lastMessage?: string
	presenceStatus: 'visible' | 'invisible'
	messages?: Array<{
		content: string
		senderName: string
		createdAt: Date
	}>
}

interface ConversationListProps {
	conversations: Conversation[]
	isLoading: boolean
	onConversationClick: (conversation: Conversation) => void
}

export default function ConversationList({ conversations, isLoading, onConversationClick }: ConversationListProps) {
	const router = useRouter()

	const getPresenceColor = (status: string) => {
		switch (status) {
			case 'visible':
				return 'bg-green-500'
			case 'invisible':
				return 'bg-red-500'
			default:
				return 'bg-red-500'
		}
	}

	const handleConversationClick = (conversation: Conversation) => {
		onConversationClick(conversation)
		
		if (conversation.type === 'group') {
			router.push(`/admin/chat/groups/${conversation.id}`)
		} else {
			router.push(`/admin/chat/users/${conversation.id}`)
		}
	}

	if (isLoading) {
		return (
			<div className='px-4 py-8 text-center'>
				<LoadingSpinner 
					text="Carregando mensagens..." 
					size="md" 
					variant="vertical" 
				/>
			</div>
		)
	}

	if (conversations.length === 0) {
		return (
			<div className='px-4 py-8 text-center'>
				<span className='icon-[lucide--inbox] w-12 h-12 mx-auto mb-3 text-zinc-300 dark:text-zinc-600' />
				<p className='text-sm text-zinc-500 dark:text-zinc-400 font-medium'>Nenhuma mensagem não lida</p>
				<p className='text-xs text-zinc-400 dark:text-zinc-500 mt-1'>Suas conversas aparecerão aqui</p>
			</div>
		)
	}

	return (
		<div className='divide-y divide-zinc-200 dark:divide-zinc-700 overflow-x-hidden'>
			{conversations.map((conversation) => (
				<div
					key={`${conversation.type}-${conversation.id}`}
					className='px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 cursor-pointer transition-colors'
					onClick={() => handleConversationClick(conversation)}
				>
					<div className='flex items-center justify-between'>
						<div className='flex items-center gap-3 min-w-0 flex-1'>
							{conversation.type === 'group' ? (
								<div className='w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center text-white text-sm font-semibold'>
									<span className='icon-[lucide--users] w-4 h-4' />
								</div>
							) : (
								<Avatar 
									src={conversation.image} 
									name={conversation.name} 
									size="sm"
									showPresence={true}
									presenceColor={getPresenceColor(conversation.presenceStatus)}
								/>
							)}
							<div className='min-w-0 flex-1 overflow-hidden'>
								<div className='flex items-center justify-between'>
									<p className='text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate'>
										{conversation.name}
									</p>
									<div className='flex items-center gap-1'>
										{conversation.lastMessageAt && (
											<span className='text-xs text-zinc-500 dark:text-zinc-400'>
												{formatDateTimeBR(
													new Date(conversation.lastMessageAt).toISOString().split('T')[0], 
													new Date(conversation.lastMessageAt).toISOString().split('T')[1]?.split('.')[0]
												).split(' ')[1]}
											</span>
										)}
										{conversation.unreadCount > 0 && (
											<span className='flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white'>
												{conversation.unreadCount > 99 ? '+99' : conversation.unreadCount}
											</span>
										)}
									</div>
								</div>
								{/* Exibir mensagens não lidas se disponíveis */}
								{conversation.messages && conversation.messages.length > 0 && (
									<div className='mt-2 space-y-1'>
										{/* Badge para mensagens extras */}
										{conversation.unreadCount > 3 && (
											<div className='flex items-center justify-start py-1'>
												<div className='flex items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-700 px-3 py-1 rounded-full'>
													<span className='text-xs text-zinc-500 dark:text-zinc-400'>
														+{conversation.unreadCount - 3} {conversation.unreadCount - 3 === 1 ? 'mensagem anterior não lida' : 'mensagens anteriores não lidas'}
													</span>
												</div>
												<div className='flex-1 mx-2 h-px bg-gradient-to-r from-zinc-300 to-transparent dark:from-zinc-600'></div>
											</div>
										)}
										{/* Exibir as 3 mensagens mais recentes */}
										{conversation.messages.map((message, index) => (
											<div key={index} className='text-xs text-zinc-600 dark:text-zinc-400'>
												{conversation.type === 'group' ? (
													// Para grupos: mostrar nome do usuário
													<div 
														className='overflow-hidden text-ellipsis line-clamp-2 break-words leading-tight'
														title={`${message.senderName}: ${message.content}`}
													>
														<span className='font-medium text-zinc-700 dark:text-zinc-300'>{message.senderName}: </span>
														<span className='font-normal text-zinc-600 dark:text-zinc-400'>{message.content}</span>
													</div>
												) : (
													// Para usuários individuais: não mostrar nome
													<div 
														className='overflow-hidden text-ellipsis line-clamp-2 break-words leading-tight'
														title={message.content}
													>
														{message.content}
													</div>
												)}
											</div>
										))}
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			))}
		</div>
	)
}
