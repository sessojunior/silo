export default function SidebarButtonClose({ onClose }: { onClose: () => void }) {
	return (
		<button type='button' onClick={onClose} className='relative inline-flex size-8 items-center justify-center gap-x-2 rounded-full border border-transparent text-sm font-semibold text-zinc-800 transition-all duration-500 hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none disabled:pointer-events-none disabled:opacity-50 lg:hidden dark:text-white dark:hover:bg-zinc-700 dark:focus:bg-zinc-700'>
			<span className='icon-[lucide--panel-left-close] size-4 shrink-0 text-zinc-400 dark:text-zinc-600'></span>
			<span className='sr-only'>Fechar</span>
		</button>
	)
}
