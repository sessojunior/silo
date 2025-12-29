'use client'

import { useState, useRef, useEffect } from 'react'

type EmojiPickerProps = {
	isOpen: boolean
	onClose: () => void
	onEmojiSelect: (emoji: string) => void
}

// Categorias de emojis organizadas
const emojiCategories = [
	{
		name: 'Carinhas',
		icon: '😀',
		emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐'],
	},
	{
		name: 'Gestos',
		icon: '👋',
		emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
	},
	{
		name: 'Corações',
		icon: '❤️',
		emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💌'],
	},
	{
		name: 'Objetos',
		icon: '⚽',
		emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '📱', '💻', '🖥️', '⌨️', '🖱️', '📺', '📷', '📹', '🎥', '📞', '☎️', '📠', '⏰', '⏲️', '⏱️', '🕐', '🔋', '💡', '🕯️', '🪔'],
	},
	{
		name: 'Natureza',
		icon: '🌱',
		emojis: ['🌱', '🌿', '🍀', '🎍', '🎋', '🍃', '🌾', '🌵', '🌲', '🌳', '🌴', '🌊', '🌈', '🌀', '⭐', '🌟', '💫', '✨', '🌙', '☀️', '🌞', '🌝', '🌛', '🌜', '🌚', '🌕', '🌖', '🌗', '🌘', '🌑'],
	},
	{
		name: 'Comida',
		icon: '🍎',
		emojis: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐'],
	},
]

export default function EmojiPicker({ isOpen, onClose, onEmojiSelect }: EmojiPickerProps) {
	const [activeCategory, setActiveCategory] = useState(0)
	const [searchQuery, setSearchQuery] = useState('')
	const dropdownRef = useRef<HTMLDivElement>(null)

	// Fechar dropdown ao clicar fora
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				onClose()
			}
		}

		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside)
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [isOpen, onClose])

	// Filtrar emojis por busca
	const filteredEmojis = searchQuery ? emojiCategories.flatMap((cat) => cat.emojis).filter((emoji) => emoji.includes(searchQuery)) : emojiCategories[activeCategory]?.emojis || []

	const handleEmojiClick = (emoji: string) => {
		onEmojiSelect(emoji)
		onClose()
		setSearchQuery('') // Limpar busca após seleção
	}

	if (!isOpen) return null

	return (
		<>
			{/* Overlay para fechar */}
			<div className='fixed inset-0 z-40' onClick={onClose} />

			{/* Dropdown do emoji picker */}
			<div ref={dropdownRef} className={`relative z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl w-80`}>
				{/* Header com busca */}
				<div className='p-3 border-b border-zinc-200 dark:border-zinc-700'>
					<div className='relative'>
						<span className='icon-[lucide--search] absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400' />
						<input type='text' placeholder='Buscar emoji...' value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className='w-full pr-10 pl-4 py-2 bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-300 rounded-md border border-zinc-300 dark:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm' />
					</div>
				</div>

				{/* Categorias (apenas se não estiver buscando) */}
				{!searchQuery && (
					<div className='flex border-b border-zinc-200 dark:border-zinc-700'>
						{emojiCategories.map((category, index) => (
							<button key={index} onClick={() => setActiveCategory(index)} className={`flex-1 p-2 text-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors ${activeCategory === index ? 'bg-blue-50 dark:bg-blue-900/20 border-b-2 border-blue-500' : ''}`} title={category.name}>
								{category.icon}
							</button>
						))}
					</div>
				)}

				{/* Grid de emojis */}
				<div className='p-2 max-h-64 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-500 [&::-webkit-scrollbar-track]:bg-zinc-100 dark:[&::-webkit-scrollbar-track]:bg-zinc-700'>
					{searchQuery && (
						<div className='text-xs text-zinc-500 dark:text-zinc-400 mb-2 px-1'>
							{filteredEmojis.length} emoji{filteredEmojis.length !== 1 ? 's' : ''} encontrado{filteredEmojis.length !== 1 ? 's' : ''}
						</div>
					)}

					{filteredEmojis.length === 0 ? (
						<div className='text-center py-8 text-zinc-500 dark:text-zinc-400'>
							<span className='icon-[lucide--search-x] w-8 h-8 mx-auto mb-2 opacity-50' />
							<p className='text-sm'>Nenhum emoji encontrado</p>
						</div>
					) : (
						<div className='grid grid-cols-8 gap-1'>
							{filteredEmojis.map((emoji, index) => (
								<button key={`${emoji}-${index}`} onClick={() => handleEmojiClick(emoji)} className='w-8 h-8 flex items-center justify-center text-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition-colors' title={emoji}>
									{emoji}
								</button>
							))}
						</div>
					)}
				</div>

				{/* Footer com informações */}
				<div className='px-3 py-2 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900'>
					<p className='text-xs text-zinc-500 dark:text-zinc-400 text-center'>{searchQuery ? 'Digite para buscar' : `${emojiCategories[activeCategory]?.name} • Clique para inserir`}</p>
				</div>
			</div>
		</>
	)
}
