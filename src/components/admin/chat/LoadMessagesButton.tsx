import Button from '@/components/ui/Button'

interface LoadMessagesButtonProps {
	onClick: () => void
	isLoading: boolean
	hasMore: boolean
	direction: 'older' | 'newer'
	count?: number
}

export function LoadMessagesButton({ onClick, isLoading, hasMore, direction, count }: LoadMessagesButtonProps) {
	if (!hasMore) return null

	const isOlder = direction === 'older'

	return (
		<div className="flex justify-center py-3">
			<Button
				onClick={onClick}
				disabled={isLoading}
				className="bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300 text-xs pl-3 pr-4 py-1.5 rounded-full"
			>
				{isLoading ? (
					<>
						<div className="animate-spin rounded-full h-4 w-4 border-2 border-zinc-300 dark:border-zinc-600 border-t-transparent" />
						Carregando...
					</>
				) : (
					<>
						{isOlder ? (
							<>
								<span className="icon-[lucide--arrow-up] w-4 h-4" />
								Carregar mensagens anteriores {count ? `(${count} restantes)` : ''}
							</>
						) : (
							<>
								<span className="icon-[lucide--arrow-down] w-4 h-4" />
								Carregar mensagens mais recentes {count ? `(${count} restantes)` : ''}
							</>
						)}
					</>
				)}
			</Button>
		</div>
	)
}
