import Button from '@/components/ui/Button'
import Offcanvas from '@/components/ui/Offcanvas'
import Label from '@/components/ui/Label'
import Input from '@/components/ui/Input'

interface DependencyItemFormOffcanvasProps {
	open: boolean
	onClose: () => void
	isAddingNewItem: boolean
	editFormData: {
		name: string
		icon: string
		description: string
		parentId: string | null
	}
	setEditFormData: React.Dispatch<
		React.SetStateAction<{
			name: string
			icon: string
			description: string
			parentId: string | null
		}>
	>
	onSubmit: (e: React.FormEvent) => void
	formLoading: boolean
	availableIcons: string[]
	isMobile: boolean
}

export default function DependencyItemFormOffcanvas({ open, onClose, isAddingNewItem, editFormData, setEditFormData, onSubmit, formLoading, availableIcons, isMobile }: DependencyItemFormOffcanvasProps) {
	return (
		<Offcanvas open={open} onClose={onClose} title={isAddingNewItem ? 'Adicionar Dependência' : 'Editar Dependência'} width='lg'>
			<form className='flex flex-col gap-6' onSubmit={onSubmit}>
				{/* Nome */}
				<div>
					<Label htmlFor='item-name' required>
						Nome
					</Label>
					<Input id='item-name' type='text' value={editFormData.name} setValue={(value) => setEditFormData((prev) => ({ ...prev, name: value }))} required placeholder='Ex: Servidor Principal, Base de Dados' />
				</div>

				{/* Ícone */}
				<div>
					<Label htmlFor='item-icon'>Ícone (opcional)</Label>
					<div className={`grid gap-2 ${isMobile ? 'grid-cols-6' : 'grid-cols-12'}`}>
						{/* Botão para remover ícone */}
						<button
							type='button'
							className={`flex items-center justify-center
								size-10 border rounded-lg transition-colors
								${editFormData.icon === '' ? 'border-blue-600 text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800'}
							`}
							onClick={() => setEditFormData((prev) => ({ ...prev, icon: '' }))}
							title='Sem ícone'
						>
							<span className='icon-[lucide--x] size-5' />
						</button>
						{availableIcons.map((iconClass) => (
							<button
								type='button'
								key={iconClass}
								className={`flex items-center justify-center
									size-10 border rounded-lg transition-colors
									${editFormData.icon === iconClass ? 'border-blue-600 text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800'}
								`}
								onClick={() => setEditFormData((prev) => ({ ...prev, icon: iconClass }))}
								title={iconClass.replace('icon-[lucide--', '').replace(']', '')}
							>
								<span className={`${iconClass} size-5`} />
							</button>
						))}
					</div>
				</div>

				{/* Descrição */}
				<div>
					<Label htmlFor='item-description'>Descrição (opcional)</Label>
					<textarea id='item-description' value={editFormData.description} onChange={(e) => setEditFormData((prev) => ({ ...prev, description: e.target.value }))} className='block w-full rounded-lg border-zinc-200 px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:placeholder-zinc-500 focus:border-blue-500 focus:ring-blue-500' rows={3} placeholder='Descrição detalhada sobre esta dependência...' />
				</div>

				{/* Botões de ação */}
				<div className='flex gap-2 justify-end'>
					<Button type='button' style='bordered' onClick={onClose}>
						Cancelar
					</Button>
					<Button type='submit' disabled={formLoading}>
						{formLoading ? 'Salvando...' : 'Salvar'}
					</Button>
				</div>
			</form>
		</Offcanvas>
	)
}
