import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import type { ChatGroup, ChatUser } from '@/context/ChatContext'

interface ChatHeaderProps {
	activeTarget: ChatGroup | ChatUser | undefined
	activeTargetType: 'group' | 'user' | null
	totalMessages: number
	totalMessagesCount: number
	onToggleSidebar: () => void
}

export function ChatHeader({ 
	activeTarget, 
	activeTargetType, 
	totalMessages, 
	totalMessagesCount, 
	onToggleSidebar 
}: ChatHeaderProps) {
	return (
		<div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
			<div className="flex items-center space-x-3">
				<Button
					onClick={onToggleSidebar}
					className="md:hidden bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 p-2"
				>
					<span className="icon-[mdi--menu] w-5 h-5" />
				</Button>
				
				<div className="flex items-center space-x-3">
					{activeTargetType === 'group' ? (
						<div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center">
							<span className="icon-[lucide--users] w-5 h-5 text-white" />
						</div>
					) : (
						<Avatar 
							src={(activeTarget as ChatUser)?.image} 
							name={activeTarget?.name || 'Usuário'} 
							size="md"
							showPresence={true}
							presenceColor={(activeTarget as ChatUser)?.presenceStatus === 'visible' ? 'bg-green-400' : 'bg-gray-400'}
						/>
					)}
					<div>
						<h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
							{activeTarget?.name || 'Carregando...'}
						</h2>
						<p className="text-sm text-zinc-500 dark:text-zinc-400">
							{activeTargetType === 'group' ? 'Grupo' : 'Conversa privada'}
						</p>
					</div>
				</div>
			</div>
			
			<div className="flex items-center space-x-2">
				<span className="text-sm text-zinc-500 dark:text-zinc-400">
					{totalMessages} de {totalMessagesCount} mensagens
				</span>
			</div>
		</div>
	)
}
