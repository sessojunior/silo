'use client'

import { useState } from 'react'
import Dialog from '@/components/ui/Dialog'
import Button from '@/components/ui/Button'
import { toast } from '@/lib/toast'

interface ActivityDeleteDialogProps {
	open: boolean
	onClose: () => void
	activity: {
		id: string
		name: string
		description: string
	} | null
	onConfirm: (activityId: string) => Promise<void>
}

export default function ActivityDeleteDialog({ open, onClose, activity, onConfirm }: ActivityDeleteDialogProps) {
	const [deleting, setDeleting] = useState(false)

	const handleConfirm = async () => {
		if (!activity) return

		try {
			setDeleting(true)

			await onConfirm(activity.id)

			toast({
				type: 'success',
				title: 'Atividade excluída',
				description: `${activity.name} foi excluída com sucesso`,
			})

			onClose()
		} catch (error) {
			console.error('❌ [COMPONENT_ACTIVITY_DELETE] Erro ao excluir atividade:', { error })
			toast({
				type: 'error',
				title: 'Erro ao excluir',
				description: 'Não foi possível excluir a atividade. Tente novamente.',
			})
		} finally {
			setDeleting(false)
		}
	}

	const handleClose = () => {
		if (!deleting) {
			onClose()
		}
	}

	if (!activity) return null

	return (
		<Dialog open={open} onClose={handleClose} title='Excluir Atividade'>
			<div className='space-y-4'>
				{/* Informações da atividade */}
				<div className='bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700'>
					<h3 className='font-medium text-zinc-900 dark:text-zinc-100 mb-2'>{activity.name}</h3>
					<p className='text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3'>{activity.description}</p>
				</div>

				{/* Aviso de exclusão */}
				<div className='flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg'>
					<span className='icon-[lucide--triangle-alert] size-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5' />
					<div className='space-y-2'>
						<p className='text-sm font-medium text-red-800 dark:text-red-200'>Atenção: Esta ação é irreversível</p>
						<p className='text-sm text-red-700 dark:text-red-300'>Ao excluir esta atividade, todas as informações associadas serão permanentemente removidas. Esta ação não pode ser desfeita.</p>
					</div>
				</div>

				{/* Botões de ação */}
				<div className='flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700'>
					<Button type='button' onClick={handleClose} style='bordered' disabled={deleting}>
						Cancelar
					</Button>
					<Button type='button' onClick={handleConfirm} disabled={deleting} className='bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700'>
						{deleting ? (
							<>
								<span className='icon-[lucide--loader-circle] size-4 animate-spin mr-2' />
								Excluindo...
							</>
						) : (
							<>
								<span className='icon-[lucide--trash-2] size-4 mr-2' />
								Confirmar Exclusão
							</>
						)}
					</Button>
				</div>
			</div>
		</Dialog>
	)
}
