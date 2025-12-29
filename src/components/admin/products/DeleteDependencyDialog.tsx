import Button from '@/components/ui/Button'
import Dialog from '@/components/ui/Dialog'

interface ProductDependency {
	id: string
	name: string
	icon?: string
	description?: string
	parentId?: string | null
	treePath?: string | null
	treeDepth: number
	sortKey?: string | null
	children?: ProductDependency[]
}

interface DeleteDependencyDialogProps {
	open: boolean
	onClose: () => void
	itemToDelete: ProductDependency | null
	onConfirm: () => void
	loading: boolean
}

export default function DeleteDependencyDialog({ open, onClose, itemToDelete, onConfirm, loading }: DeleteDependencyDialogProps) {
	return (
		<Dialog
			open={open}
			onClose={onClose}
			title={
				<div className='flex items-center gap-3 text-red-600'>
					<span className='icon-[lucide--alert-triangle] size-6' />
					<span>Confirmar Exclusão</span>
				</div>
			}
			description={itemToDelete ? `Tem certeza que deseja excluir a dependência "${itemToDelete.name}"? Esta ação não pode ser desfeita.` : 'Tem certeza que deseja excluir esta dependência? Esta ação não pode ser desfeita.'}
		>
			<div className='flex gap-3 justify-end mt-6'>
				<Button type='button' style='bordered' onClick={onClose} disabled={loading}>
					Cancelar
				</Button>
				<Button type='button' className='bg-red-600 text-white hover:bg-red-700 disabled:opacity-50' disabled={loading} onClick={onConfirm}>
					{loading ? 'Excluindo...' : 'Excluir'}
				</Button>
			</div>
		</Dialog>
	)
}
