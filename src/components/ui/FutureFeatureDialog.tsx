import Dialog from './Dialog'
import Button from './Button'

interface FutureFeatureDialogProps {
	open: boolean
	onClose: () => void
	featureName: string
	description: string
	icon: string
}

export default function FutureFeatureDialog({ open, onClose, featureName, description, icon }: FutureFeatureDialogProps) {
	return (
		<Dialog open={open} onClose={onClose}>
			<div className='text-center p-6'>
				{/* Ícone da funcionalidade */}
				<div className='mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/20 mb-4'>
					<span className={`${icon} w-8 h-8 text-blue-600 dark:text-blue-400`} />
				</div>

				{/* Título */}
				<h3 className='text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3'>{featureName}</h3>

				{/* Descrição */}
				<p className='text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed'>{description}</p>

				{/* Status badge */}
				<div className='inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs font-medium mb-6'>
					<span className='icon-[lucide--clock] w-3 h-3' />
					Planejado para implementação futura
				</div>

				{/* Botão fechar */}
				<Button onClick={onClose} className='w-full'>
					Entendido
				</Button>
			</div>
		</Dialog>
	)
}
