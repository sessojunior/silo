import { useState, useEffect } from 'react'
import Offcanvas from '@/components/ui/Offcanvas'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { toast } from '@/lib/toast'

interface Category {
	id?: string
	name: string
	color: string | null
}

interface Props {
	open: boolean
	onClose: () => void
	category?: Category | null
	onSaved?: () => void
}

export default function ProblemCategoryFormOffcanvas({ open, onClose, category, onSaved }: Props) {
	const [name, setName] = useState('')
	const [color, setColor] = useState('#64748B')
	const [loading, setLoading] = useState(false)

	useEffect(() => {
		if (open) {
			if (category) {
				setName(category.name)
				setColor(category.color || '#64748B')
			} else {
				setName('')
				setColor('#64748B')
			}
		}
	}, [open, category])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!name.trim()) {
			toast({ type: 'error', title: 'Nome obrigatório' })
			return
		}
		const payload: { name: string; color: string | null; id?: string } = { name: name.trim(), color: color || null }
		const method = category ? 'PUT' : 'POST'
		if (category) payload.id = category.id

		setLoading(true)
		try {
			const res = await fetch('/api/admin/products/problems/categories', {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			})
			const json = await res.json()
			if (res.ok && json.success) {
				toast({ type: 'success', title: category ? 'Categoria atualizada' : 'Categoria criada' })
				if (onSaved) onSaved()
				onClose()
			} else {
				toast({ type: 'error', title: json.message || 'Erro ao salvar' })
			}
		} finally {
			setLoading(false)
		}
	}

	return (
		<Offcanvas open={open} onClose={onClose} title={category ? 'Editar categoria' : 'Cadastrar categoria'} side='right' width='md' zIndex={90}>
			<form onSubmit={handleSubmit} className='flex flex-col gap-4'>
				<div className='flex flex-col gap-1'>
					<label className='text-sm font-medium'>Nome</label>
					<Input type='text' value={name} setValue={setName} placeholder='Rede externa' required isInvalid={false} />
				</div>
				<div className='flex flex-col gap-1'>
					<label className='text-sm font-medium'>Cor</label>
					<input type='color' value={color ?? '#64748B'} onChange={(e) => setColor(e.target.value)} className='h-10 w-24 rounded border border-zinc-200 dark:border-zinc-700' />
				</div>
				<div className='flex justify-end gap-2 pt-4'>
					<Button style='bordered' type='button' onClick={onClose} disabled={loading}>
						Cancelar
					</Button>
					<Button type='submit' disabled={loading}>
						{category ? 'Salvar' : 'Cadastrar'}
					</Button>
				</div>
			</form>
		</Offcanvas>
	)
}
