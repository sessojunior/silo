'use client'

interface PresenceToggleProps {
	currentPresence: 'visible' | 'invisible'
	onPresenceChange: (status: 'visible' | 'invisible') => void
}

export default function PresenceToggle({ currentPresence, onPresenceChange }: PresenceToggleProps) {
	const getPresenceText = (status: string) => {
		switch (status) {
			case 'visible':
				return 'Visível'
			case 'invisible':
				return 'Invisível'
			default:
				return 'Invisível'
		}
	}

	return (
		<div className='px-4 py-2 border-b border-zinc-200 dark:border-zinc-700'>
			<div className='flex items-center justify-between'>
				<div className='flex items-center gap-2'>
					<span className='text-xs text-zinc-500 dark:text-zinc-400'>Status:</span>
					<span className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>
						{getPresenceText(currentPresence)}
					</span>
				</div>
				<div className='flex gap-1'>
					{[
						{ status: 'visible', color: 'bg-green-500', label: 'Visível' },
						{ status: 'invisible', color: 'bg-red-500', label: 'Invisível' },
					].map(({ status, color, label }) => (
						<button 
							key={status} 
							onClick={() => onPresenceChange(status as 'visible' | 'invisible')} 
							className={`w-6 h-6 rounded-full border-2 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
								currentPresence === status 
									? 'outline-none border-white ring-2 ring-blue-500' 
									: 'border-transparent hover:border-zinc-300 dark:hover:border-zinc-600'
							}`} 
							title={status === 'invisible' ? 'Status usado para férias, licença, aposentado, saiu da empresa, usuário inativo etc.' : label}
						>
							<div className={`w-full h-full rounded-full ${color}`} />
							<span className='sr-only'>{label}</span>
						</button>
					))}
				</div>
			</div>
		</div>
	)
}
