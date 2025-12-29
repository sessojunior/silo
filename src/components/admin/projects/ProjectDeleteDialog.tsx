'use client'

import { useState } from 'react'
import { Project } from '@/types/projects'
import Dialog from '@/components/ui/Dialog'
import Button from '@/components/ui/Button'

interface ProjectDeleteDialogProps {
	isOpen: boolean
	onClose: () => void
	project: Project | null
	onConfirm: (projectId: string) => void
}

export default function ProjectDeleteDialog({ isOpen, onClose, project, onConfirm }: ProjectDeleteDialogProps) {
	const [deleting, setDeleting] = useState(false)

	const handleConfirm = async () => {
		if (!project) return

		setDeleting(true)
		try {
			await onConfirm(project.id)
			onClose() // Fechar o dialog após exclusão bem-sucedida
		} catch (error) {
			console.error('❌ [COMPONENT_PROJECT_DELETE] Erro ao excluir projeto:', { error })
		} finally {
			setDeleting(false)
		}
	}

	return (
		<Dialog open={isOpen} onClose={onClose} title='Confirmar exclusão' description={`Tem certeza que deseja excluir o projeto "${project?.name}"? Esta ação não pode ser desfeita.`}>
			<div className='flex gap-3 justify-end mt-6'>
				<Button type='button' style='bordered' onClick={onClose} disabled={deleting}>
					Cancelar
				</Button>
				<Button type='button' onClick={handleConfirm} disabled={deleting} className='bg-red-600 hover:bg-red-700 focus:bg-red-700'>
					{deleting ? (
						<>
							<span className='icon-[lucide--loader-2] size-4 animate-spin mr-2' />
							Excluindo...
						</>
					) : (
						<>
							<span className='icon-[lucide--trash] size-4 mr-2' />
							Excluir projeto
						</>
					)}
				</Button>
			</div>
		</Dialog>
	)
}
