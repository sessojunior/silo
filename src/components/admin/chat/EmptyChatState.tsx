export function EmptyChatState() {
	return (
		<div className="flex-1 flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
			<div className="text-center">
				<div className="w-16 h-16 mx-auto mb-4 bg-zinc-200 dark:bg-zinc-700 rounded-full flex items-center justify-center">
					<span className="icon-[mdi--chat] w-8 h-8 text-zinc-400" />
				</div>
				<h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
					Selecione uma conversa
				</h3>
				<p className="text-zinc-500 dark:text-zinc-400">
					Escolha um grupo ou usuário para começar a conversar
				</p>
			</div>
		</div>
	)
}
