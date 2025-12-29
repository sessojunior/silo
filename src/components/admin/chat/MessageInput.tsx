import { useState, useRef } from 'react'
import Button from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import EmojiPicker from './EmojiPicker'

interface MessageInputProps {
	onSendMessage: (message: string) => Promise<void>
	isSending: boolean
}

export function MessageInput({ onSendMessage, isSending }: MessageInputProps) {
	const [messageText, setMessageText] = useState('')
	const [showEmojiPicker, setShowEmojiPicker] = useState(false)
	const inputRef = useRef<HTMLTextAreaElement>(null)

	// Enviar mensagem
	const handleSendMessage = async () => {
		if (!messageText.trim() || isSending) return

		try {
			await onSendMessage(messageText.trim())
			setMessageText('')
			setShowEmojiPicker(false)
		} catch (error) {
			console.error('❌ [COMPONENT_MESSAGE_INPUT] Erro ao enviar mensagem:', { error })
		}
	}

	// Handle Enter key
	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			handleSendMessage()
		}
	}

	// Adicionar emoji
	const handleEmojiSelect = (emoji: string) => {
		setMessageText(prev => prev + emoji)
		setShowEmojiPicker(false)
		inputRef.current?.focus()
	}


	return (
		<div className="relative p-4 bg-white dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700">
			<div className="flex items-center space-x-2">
				<div className="flex-1 relative">
					<Textarea
						ref={inputRef}
						value={messageText}
						onChange={(e) => setMessageText(e.target.value)}
						onKeyPress={handleKeyPress}
						placeholder="Digite sua mensagem..."
						className="min-h-[2.5rem] max-h-32 resize-none pr-12 rounded-lg border-zinc-300 dark:border-zinc-600 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
						rows={1}
					/>
					
					{/* Botões de ação */}
					<div className="absolute right-2 bottom-2 flex items-center space-x-1">
						<Button
							onClick={() => setShowEmojiPicker(!showEmojiPicker)}
							className="h-8 w-8 p-0 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-full transition-all duration-200"
						>
							<span className="icon-[mdi--emoticon-happy] h-4 w-4" />
						</Button>
					</div>
				</div>
				
				<Button
					onClick={handleSendMessage}
					disabled={!messageText.trim() || isSending}
					className="h-10 w-10 p-0 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-600 text-white rounded-full transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow-md"
				>
					{isSending ? (
						<div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
					) : (
						<span className="icon-[mdi--send] h-4 w-4" />
					)}
				</Button>
			</div>
			
			{/* Emoji Picker */}
			{showEmojiPicker && (
				<div className="absolute bottom-full right-4 mb-2 z-[60]">
					<div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl w-80">
					<EmojiPicker 
						isOpen={showEmojiPicker}
						onClose={() => setShowEmojiPicker(false)}
						onEmojiSelect={handleEmojiSelect} 
					/>
					</div>
				</div>
			)}
		</div>
	)
}
