import React, { useState, useEffect } from 'react'
import Dialog from '@/components/ui/Dialog'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Label from '@/components/ui/Label'

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
	incident?: Incident | null // null = criar, object = editar
	onSave: (incident: Incident) => void
}

const COLOR_OPTIONS = [
	{ name: 'Azul', value: '#1E40AF' },
	{ name: 'Vermelho', value: '#DC2626' },
	{ name: 'Amarelo', value: '#F59E0B' },
	{ name: 'Verde', value: '#10B981' },
	{ name: 'Roxo', value: '#7C3AED' },
	{ name: 'Cinza', value: '#6B7280' },
	{ name: 'Laranja', value: '#EA580C' },
	{ name: 'Rosa', value: '#DB2777' },
]

export default function IncidentFormModal({ open, onClose, incident, onSave }: Props) {
	const [name, setName] = useState('')
	const [color, setColor] = useState('#6B7280')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Reset form when modal opens/closes or incident changes
	useEffect(() => {
		if (open) {
			setName(incident?.name || '')
			setColor(incident?.color || '#6B7280')
			setError(null)
		}
	}, [open, incident])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)

		if (!name.trim()) {
			setError('Nome do incidente é obrigatório')
			return
		}

		if (name.trim().length < 2) {
			setError('Nome deve ter pelo menos 2 caracteres')
			return
		}

		setLoading(true)
		try {
			const incidentData: Incident = {
				id: incident?.id || '',
				name: name.trim(),
				color,
				isSystem: false,
				sortOrder: incident?.sortOrder || 999,
			}

			await onSave(incidentData)
			onClose()
		} catch (error) {
			setError(error instanceof Error ? error.message : 'Erro ao salvar incidente')
		} finally {
			setLoading(false)
		}
	}

	const handleClose = () => {
		if (!loading) {
			onClose()
		}
	}

	return (
		<Dialog
			open={open}
			onClose={handleClose}
			title={
				<div className='flex items-center gap-2'>
					<span className='icon-[lucide--alert-triangle] size-5 text-orange-500' />
					{incident ? 'Editar Incidente' : 'Adicionar Incidente'}
				</div>
			}
		>
			<form onSubmit={handleSubmit} className='flex flex-col gap-4'>
				<div>
					<Label htmlFor='incident-name' required>
						Nome do incidente
					</Label>
					<Input id='incident-name' type='text' value={name} setValue={setName} placeholder='Ex: Falha de rede' required minLength={2} maxLength={50} disabled={loading} />
				</div>

				<div>
					<Label htmlFor='incident-color'>Cor do incidente</Label>
					<div className='grid grid-cols-4 gap-2 mt-2'>
						{COLOR_OPTIONS.map((colorOption) => (
							<button key={colorOption.value} type='button' onClick={() => setColor(colorOption.value)} disabled={loading} className={`w-full h-10 rounded-lg border-2 transition-all ${color === colorOption.value ? 'border-zinc-900 dark:border-zinc-100 ring-2 ring-blue-500' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'}`} style={{ backgroundColor: colorOption.value }} title={colorOption.name}>
								<span className='sr-only'>{colorOption.name}</span>
							</button>
						))}
					</div>
					<div className='mt-2 text-sm text-zinc-500 dark:text-zinc-400'>
						Cor selecionada: <span className='font-medium'>{color}</span>
					</div>
				</div>

				{error && <div className='text-red-600 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg'>{error}</div>}

				<div className='flex gap-2 justify-end mt-6'>
					<Button type='button' style='bordered' onClick={handleClose} disabled={loading}>
						Cancelar
					</Button>
					<Button type='submit' disabled={loading}>
						{loading ? 'Salvando...' : incident ? 'Salvar' : 'Adicionar'}
					</Button>
				</div>
			</form>
		</Dialog>
	)
}
