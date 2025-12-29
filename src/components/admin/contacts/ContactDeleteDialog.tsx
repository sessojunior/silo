'use client'

import { useState } from 'react'
import { toast } from '@/lib/toast'

import Dialog from '@/components/ui/Dialog'
import Button from '@/components/ui/Button'
import { Contact } from '@/lib/db/schema'

interface ContactDeleteDialogProps {
	isOpen: boolean
	onClose: () => void
	contact: Contact | null
	onSuccess?: () => void
}

export default function ContactDeleteDialog({ isOpen, onClose, contact, onSuccess }: ContactDeleteDialogProps) {
	const [loading, setLoading] = useState(false)

	const handleDelete = async () => {
		if (!contact) return

		try {
			setLoading(true)
			const response = await fetch('/api/admin/contacts', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: contact.id }),
			})

			const data = await response.json()

			if (data.success) {
				toast({
					type: 'success',
					title: 'Contato excluído',
					description: `${contact.name} foi removido com sucesso`,
				})
				onSuccess?.()
				onClose()
			} else {
				toast({
					type: 'error',
					title: 'Erro ao excluir',
					description: data.error || 'Erro desconhecido',
				})
			}
		} catch (error) {
			console.error('❌ [COMPONENT_CONTACT_DELETE] Erro ao excluir contato:', { error })
			toast({
				type: 'error',
				title: 'Erro',
				description: 'Erro ao excluir contato',
			})
		} finally {
			setLoading(false)
		}
	}

	return (
		<Dialog open={isOpen} onClose={onClose} title='Confirmar exclusão' description={`Tem certeza que deseja excluir o contato ${contact?.name}? Esta ação não pode ser desfeita.`}>
			<div className='flex gap-3 justify-end mt-6'>
				<Button type='button' style='bordered' onClick={onClose} disabled={loading}>
					Cancelar
				</Button>
				<Button type='button' onClick={handleDelete} disabled={loading} className='bg-red-600 hover:bg-red-700 focus:bg-red-700'>
					{loading ? (
						<>
							<span className='icon-[lucide--loader-2] size-4 animate-spin mr-2' />
							Excluindo...
						</>
					) : (
						<>
							<span className='icon-[lucide--trash] size-4 mr-2' />
							Excluir contato
						</>
					)}
				</Button>
			</div>
		</Dialog>
	)
}
