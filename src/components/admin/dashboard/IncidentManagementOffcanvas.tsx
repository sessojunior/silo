import React, { useState, useEffect } from 'react'
import Offcanvas from '@/components/ui/Offcanvas'
import Button from '@/components/ui/Button'
import Dialog from '@/components/ui/Dialog'
import Skeleton from '@/components/ui/Skeleton'
import { toast } from '@/lib/toast'
import IncidentFormModal from './IncidentFormModal'

interface Incident {
	id: string
	name: string
	color: string
	isSystem: boolean
	sortOrder: number
}

interface Props {
	open: boolean
	onClose: () => void
	onIncidentUpdated: () => void // Callback para atualizar select
}

export default function IncidentManagementOffcanvas({ open, onClose, onIncidentUpdated }: Props) {
	const [incidents, setIncidents] = useState<Incident[]>([])
	const [loading, setLoading] = useState(false)
	const [formModalOpen, setFormModalOpen] = useState(false)
	const [editingIncident, setEditingIncident] = useState<Incident | null>(null)
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [deletingIncident, setDeletingIncident] = useState<Incident | null>(null)
	const [deleteLoading, setDeleteLoading] = useState(false)

	// Carregar incidentes quando o offcanvas abre
	useEffect(() => {
		if (open) {
			loadIncidents()
		}
	}, [open])

	const loadIncidents = async () => {
		setLoading(true)
		try {
			const response = await fetch('/api/admin/incidents')
			const data = await response.json()

			if (data.success) {
				setIncidents(data.data)
			} else {
				toast({ type: 'error', title: 'Erro ao carregar incidentes' })
			}
		} catch (error) {
			console.error('❌ [COMPONENT_INCIDENT_MANAGEMENT] Erro ao carregar incidentes:', { error })
			toast({ type: 'error', title: 'Erro ao carregar incidentes' })
		} finally {
			setLoading(false)
		}
	}

	const handleCreateIncident = () => {
		setEditingIncident(null)
		setFormModalOpen(true)
	}

	const handleEditIncident = (incident: Incident) => {
		setEditingIncident(incident)
		setFormModalOpen(true)
	}

	const handleSaveIncident = async (incidentData: Incident) => {
		try {
			const url = '/api/admin/incidents'
			const method = editingIncident ? 'PUT' : 'POST'
			const body = editingIncident ? { id: incidentData.id, name: incidentData.name, color: incidentData.color } : { name: incidentData.name, color: incidentData.color }

			const response = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			})

			const data = await response.json()

			if (data.success) {
				toast({
					type: 'success',
					title: editingIncident ? 'Incidente atualizado' : 'Incidente criado',
				})
				await loadIncidents()
				onIncidentUpdated()
			} else {
				toast({ type: 'error', title: data.message || 'Erro ao salvar incidente' })
			}
		} catch (error) {
			console.error('❌ [COMPONENT_INCIDENT_MANAGEMENT] Erro ao salvar incidente:', { error })
			toast({ type: 'error', title: 'Erro ao salvar incidente' })
		}
	}

	const handleDeleteIncident = (incident: Incident) => {
		setDeletingIncident(incident)
		setDeleteDialogOpen(true)
	}

	const confirmDeleteIncident = async () => {
		if (!deletingIncident) return

		setDeleteLoading(true)
		try {
			const response = await fetch(`/api/admin/incidents?id=${deletingIncident.id}`, {
				method: 'DELETE',
			})

			const data = await response.json()

			if (data.success) {
				toast({ type: 'success', title: 'Incidente excluído' })
				await loadIncidents()
				onIncidentUpdated()
			} else {
				toast({ type: 'error', title: data.message || 'Erro ao excluir incidente' })
			}
		} catch (error) {
			console.error('❌ [COMPONENT_INCIDENT_MANAGEMENT] Erro ao excluir incidente:', { error })
			toast({ type: 'error', title: 'Erro ao excluir incidente' })
		} finally {
			setDeleteLoading(false)
			setDeleteDialogOpen(false)
			setDeletingIncident(null)
		}
	}

	const handleClose = () => {
		if (!loading && !deleteLoading) {
			onClose()
		}
	}

	return (
		<>
			<Offcanvas open={open} onClose={handleClose} title='Gerenciar Incidentes' side='right' width='md' zIndex={90}>
				<div className='flex flex-col gap-4'>
					{/* Header com botão de adicionar */}
					<div className='flex justify-between items-center'>
						<div>
							<h3 className='text-lg font-semibold text-zinc-900 dark:text-zinc-100'>Incidentes Disponíveis</h3>
							<p className='text-sm text-zinc-500 dark:text-zinc-400'>Gerencie os tipos de incidentes que podem ocorrer nos turnos</p>
						</div>
						<Button onClick={handleCreateIncident} disabled={loading}>
							<span className='icon-[lucide--plus] size-4 mr-2' />
							Adicionar
						</Button>
					</div>

					{/* Lista de incidentes */}
					<div className='flex flex-col gap-2'>
						{loading ? (
							// Skeleton para carregamento
							<>
								{Array.from({ length: 3 }).map((_, index) => (
									<div key={index} className='flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg'>
										<div className='flex items-center gap-3'>
											<Skeleton className='w-4 h-4 rounded-full' />
											<Skeleton className='h-4 w-32' />
										</div>
										<div className='flex gap-2'>
											<Skeleton className='w-8 h-8 rounded-lg' />
											<Skeleton className='w-8 h-8 rounded-lg' />
										</div>
									</div>
								))}
							</>
						) : incidents.length === 0 ? (
							<div className='text-center py-8 text-zinc-500 dark:text-zinc-400'>Nenhum incidente encontrado</div>
						) : (
							incidents.map((incident) => (
								<div key={incident.id} className='flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg'>
									<div className='flex items-center gap-3'>
										<div className='w-4 h-4 rounded-full' style={{ backgroundColor: incident.color }} />
										<span className='font-medium text-zinc-900 dark:text-zinc-100'>{incident.name}</span>
									</div>
									<div className='flex gap-2'>
										<Button style='bordered' onClick={() => handleEditIncident(incident)} disabled={loading || deleteLoading} className='px-2 py-2'>
											<span className='icon-[lucide--edit] size-4' />
										</Button>
										<Button style='bordered' className='px-2 py-2 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20' onClick={() => handleDeleteIncident(incident)} disabled={loading || deleteLoading}>
											<span className='icon-[lucide--trash] size-4' />
										</Button>
									</div>
								</div>
							))
						)}
					</div>

					{/* Footer com informações */}
					<div className='mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg'>
						<div className='flex items-start gap-3'>
							<span className='icon-[lucide--info] size-6 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0' />
							<div className='text-sm text-blue-800 dark:text-blue-200'>
								<p className='font-medium mb-1'>Sobre os incidentes:</p>
								<p className='text-blue-700 dark:text-blue-300'>Incidentes são usados para categorizar problemas nos turnos. Apenas incidentes reais aparecem nas estatísticas. &quot;Não houve incidentes&quot; não pode ser editado ou excluído. Incidentes em uso não podem ser excluídos.</p>
							</div>
						</div>
					</div>
				</div>
			</Offcanvas>

			{/* Modal de formulário */}
			<IncidentFormModal open={formModalOpen} onClose={() => setFormModalOpen(false)} incident={editingIncident} onSave={handleSaveIncident} />

			{/* Dialog de confirmação de exclusão */}
			<Dialog
				open={deleteDialogOpen}
				onClose={() => setDeleteDialogOpen(false)}
				title={
					<div className='flex items-center gap-2 text-red-600'>
						<span className='icon-[lucide--trash-2] size-4' />
						Excluir Incidente
					</div>
				}
				description={`Tem certeza que deseja excluir o incidente "${deletingIncident?.name}"? Esta ação não poderá ser desfeita.`}
			>
				<div className='flex gap-2 justify-end mt-6'>
					<Button type='button' style='bordered' onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>
						Cancelar
					</Button>
					<Button type='button' className='bg-red-600 text-white hover:bg-red-700' disabled={deleteLoading} onClick={confirmDeleteIncident}>
						{deleteLoading ? 'Excluindo...' : 'Excluir'}
					</Button>
				</div>
			</Dialog>
		</>
	)
}
