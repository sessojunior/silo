'use client'

import { useState } from 'react'
import { toast } from '@/lib/toast'

import Dialog from '@/components/ui/Dialog'
import Button from '@/components/ui/Button'
import { Group } from '@/lib/db/schema'

interface GroupDeleteDialogProps {
	isOpen: boolean
	onClose: () => void
	group: Group | null
	onSuccess?: () => void
}

export default function GroupDeleteDialog({ isOpen, onClose, group, onSuccess }: GroupDeleteDialogProps) {
	const [loading, setLoading] = useState(false)

	const handleDelete = async () => {
		if (!group) return

		// Verificar se é o grupo padrão
		if (group.isDefault) {
			toast({
				type: 'error',
				title: 'Não é possível excluir',
				description: 'O grupo padrão não pode ser excluído. Defina outro grupo como padrão primeiro.',
			})
			return
		}

		try {
			setLoading(true)


			const response = await fetch(`/api/admin/groups?id=${group.id}`, {
				method: 'DELETE',
			})

			const data = await response.json()

			if (data.success) {
				toast({
					type: 'success',
					title: 'Grupo excluído',
					description: `${group.name} foi removido com sucesso`,
				})
				onSuccess?.()
				onClose()
			} else {
				console.error('❌ [COMPONENT_GROUP_DELETE] Erro ao excluir grupo:', { error: data })
				const msg = data.error || data.message || 'Erro desconhecido'
				toast({
					type: 'error',
					title: 'Erro ao excluir',
					description: msg,
				})
			}
		} catch (error) {
			console.error('❌ [COMPONENT_GROUP_DELETE] Erro inesperado ao excluir grupo:', { error })
			toast({
				type: 'error',
				title: 'Erro inesperado',
				description: 'Erro ao excluir grupo',
			})
		} finally {
			setLoading(false)
		}
	}

	// Função para determinar a mensagem do dialog baseada no tipo de grupo
	const getDialogMessage = () => {
		if (!group) return ''

		if (group.isDefault) {
			return `O grupo "${group.name}" é o grupo padrão do sistema e não pode ser excluído. Para excluí-lo, primeiro defina outro grupo como padrão nas configurações.`
		}

		return `Tem certeza que deseja excluir o grupo "${group.name}"? Esta ação não pode ser desfeita e todos os usuários deste grupo que não estiverem em nenhum outro grupo serão movidos para o grupo padrão.`
	}

	return (
		<Dialog open={isOpen} onClose={onClose} title='Confirmar exclusão' description={getDialogMessage()}>
			{/* Aviso especial para grupo padrão */}
			{group?.isDefault && (
				<div className='mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg'>
					<div className='flex items-start gap-3'>
						<span className='icon-[lucide--info] size-5 text-amber-600 dark:text-amber-400 mt-0.5' />
						<div>
							<h4 className='font-medium text-amber-900 dark:text-amber-100 mb-1'>Grupo Padrão</h4>
							<p className='text-sm text-amber-800 dark:text-amber-200'>Este é o grupo padrão do sistema. Para excluí-lo, primeiro defina outro grupo como padrão nas configurações.</p>
						</div>
					</div>
				</div>
			)}

			{/* Preview do grupo */}
			{group && (
				<div className='mt-4 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700'>
					<div className='flex items-center gap-3'>
						<div className='size-8 rounded-full flex items-center justify-center' style={{ backgroundColor: group.color }}>
							<span className={`${group.icon} size-5 text-white`} />
						</div>
						<div>
							<p className='font-medium text-zinc-900 dark:text-zinc-100'>{group.name}</p>
							{group.description && <p className='text-sm text-zinc-600 dark:text-zinc-400'>{group.description}</p>}
							<div className='flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 mt-1'>
								<span className={group.active ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}>{group.active ? '● Ativo' : '● Inativo'}</span>
								{group.isDefault && <span className='text-blue-600 dark:text-blue-500'>🌟 Padrão</span>}
							</div>
						</div>
					</div>
				</div>
			)}

			<div className='flex gap-3 justify-end mt-6'>
				<Button type='button' style='bordered' onClick={onClose} disabled={loading}>
					Cancelar
				</Button>

				{/* Botão de exclusão - desabilitado para grupo padrão */}
				<Button type='button' onClick={handleDelete} disabled={loading || group?.isDefault} className='bg-red-600 hover:bg-red-700 focus:bg-red-700 disabled:bg-zinc-400'>
					{loading ? (
						<>
							<span className='icon-[lucide--loader-2] size-4 animate-spin mr-2' />
							Excluindo...
						</>
					) : (
						<>
							<span className='icon-[lucide--trash] size-4 mr-2' />
							{group?.isDefault ? 'Não é possível excluir' : 'Excluir grupo'}
						</>
					)}
				</Button>
			</div>
		</Dialog>
	)
}
