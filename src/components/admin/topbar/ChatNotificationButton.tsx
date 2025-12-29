'use client'

import { useState } from 'react'
import { useChat } from '@/context/ChatContext'
import NotificationDropdown from './NotificationDropdown'

export default function ChatNotificationButton() {
	const [isOpen, setIsOpen] = useState(false)
	const { totalUnread } = useChat()

	const handleButtonClick = (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		setIsOpen(!isOpen)
	}

	return (
		<div className='relative'>
			{/* Trigger Button */}
			<button 
				onClick={handleButtonClick} 
				className='relative inline-flex size-[38px] items-center justify-center gap-x-2 rounded-full border border-transparent text-sm font-semibold text-zinc-800 transition-all duration-500 hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none disabled:pointer-events-none disabled:opacity-50 dark:text-white dark:hover:bg-zinc-700 dark:focus:bg-zinc-700'
			>
				<span className='icon-[lucide--inbox] size-4 shrink-0' aria-hidden='true'></span>

				{/* Indicador de mensagens não lidas */}
				{totalUnread > 0 && (
					<span className='absolute end-0 top-0 flex size-2.5'>
						<span className='absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75 dark:bg-red-600'></span>
						<span className='relative inline-flex size-2.5 rounded-full bg-red-500'></span>
					</span>
				)}

				{/* Contador de mensagens */}
				{totalUnread > 0 && (
					<span className='absolute bottom-0 right-0 flex size-4 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold text-gray-600'>
						{totalUnread > 9 ? '+9' : totalUnread}
					</span>
				)}

				<span className='sr-only'>
					Chat {totalUnread > 0 ? `(${totalUnread} não lidas)` : ''}
				</span>
			</button>

			{/* Dropdown */}
			{isOpen && (
				<NotificationDropdown 
					onClose={() => setIsOpen(false)}
				/>
			)}
		</div>
	)
}