import { useEffect, useState } from 'react'
import Offcanvas from '@/components/ui/Offcanvas'
import Button from '@/components/ui/Button'
import Dialog from '@/components/ui/Dialog'
import { toast } from '@/lib/toast'
import ProblemCategoryFormOffcanvas from '@/components/admin/products/ProblemCategoryFormOffcanvas'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface Category {
	id: string
	name: string
	color: string | null
	isSystem?: boolean
	usageCount: number
}

interface Props {
	open: boolean
	onClose: () => void
}

export default function ProblemCategoryOffcanvas({ open, onClose }: Props) {
	const [categories, setCategories] = useState<Category[]>([])
	const [loading, setLoading] = useState(false)
	const [formOpen, setFormOpen] = useState(false)
	const [editing, setEditing] = useState<Category | null>(null)
	const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; cat: Category | null }>({ open: false, cat: null })

	async function load() {
		setLoading(true)
		try {
			const res = await fetch('/api/admin/products/problems/categories')
			const json = await res.json()
			if (res.ok) {
				// Buscar informações de uso para cada categoria (incluindo "Não houve incidentes")
				const categoriesWithUsage = await Promise.all(
					(json.data || []).map(async (cat: Category) => {
						try {
							const usageRes = await fetch(`/api/admin/incidents/usage?incidentId=${cat.id}`)
							const usageJson = await usageRes.json()
							if (usageJson.success) {
								return {
									...cat,
									usageCount: usageJson.data.usageCount,
								}
							}
						} catch (error) {
							console.error('❌ [COMPONENT_PROBLEM_CATEGORY] Erro ao buscar uso da categoria:', { error })
						}
						return { ...cat, usageCount: 0 }
					}),
				)

				setCategories(categoriesWithUsage)
			}
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		if (open) load()
	}, [open])

	const openCreate = () => {
		setEditing(null)
		setFormOpen(true)
	}

	const handleEdit = (cat: Category) => {
		// Bloquear edição de categorias do sistema
		if (cat.isSystem) {
			toast({ type: 'error', title: 'Esta categoria é do sistema e não pode ser editada.' })
			return
		}
		setEditing(cat)
		setFormOpen(true)
	}

	const confirmDelete = async () => {
		if (!deleteDialog.cat) return

		// Bloquear exclusão de categorias do sistema
		if (deleteDialog.cat.isSystem) {
			toast({ type: 'error', title: 'Esta categoria é do sistema e não pode ser excluída.' })
			setDeleteDialog({ open: false, cat: null })
			return
		}

		const res = await fetch(`/api/admin/products/problems/categories?id=${deleteDialog.cat.id}`, { method: 'DELETE' })
		const json = await res.json()
		if (res.ok && json.success) {
			toast({ type: 'success', title: 'Categoria excluída' })
			setDeleteDialog({ open: false, cat: null })
			load()
		} else {
			toast({ type: 'error', title: json.message || 'Erro ao excluir' })
		}
	}

	return (
		<>
			<Offcanvas title='Gerenciar categorias de problemas' open={open} onClose={onClose} side='right' width='lg'>
				<div>
					{/* Botão cadastrar quando já existem itens */}
					{categories.length > 0 && (
						<div className='flex items-center pb-4 mb-4 border-b border-dashed border-zinc-200 dark:border-zinc-700'>
							<Button style='bordered' onClick={openCreate}>
								Cadastrar categoria
							</Button>
						</div>
					)}

					{/* Lista */}
					<div className='flex flex-col gap-2 max-h-full overflow-y-auto pb-2'>
						{loading && (
							<div className='flex flex-col items-center justify-center gap-3 text-zinc-500 py-12'>
								<LoadingSpinner 
									text="Carregando categorias..." 
									size="md" 
									variant="centered" 
								/>
							</div>
						)}
						{!loading && categories.length === 0 && (
							<div className='flex flex-col items-center justify-center gap-3 text-zinc-500 py-12'>
								<span className='icon-[lucide--tag] size-12 text-zinc-300'></span>
								<p className='text-center'>Nenhuma categoria cadastrada.</p>
								<Button style='bordered' onClick={openCreate}>
									Cadastrar
								</Button>
							</div>
						)}
						{!loading &&
							categories.map((cat) => {
								const isProtected = cat.isSystem || cat.usageCount > 0
								return (
									<div key={cat.id} className='flex items-center justify-between rounded border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 p-4'>
										<div className='flex items-center gap-2'>
											<span className='size-3 rounded-full' style={{ backgroundColor: cat.color || '#64748B' }}></span>
											<span className='text-base'>{cat.name}</span>
											{cat.isSystem && <span className='inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200'>Sistema</span>}
											{cat.usageCount > 0 && (
												<span className='inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200'>
													{cat.usageCount} uso{cat.usageCount > 1 ? 's' : ''}
												</span>
											)}
										</div>
										<div className='flex gap-2'>
											<button title={cat.isSystem ? 'Categoria do sistema - não pode ser editada' : 'Editar'} onClick={() => handleEdit(cat)} disabled={cat.isSystem} className={`inline-flex items-center justify-center size-8 rounded-full transition ${cat.isSystem ? 'text-zinc-300 cursor-not-allowed dark:text-zinc-600' : 'text-zinc-500 hover:bg-blue-100 hover:text-blue-700 dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-700'}`}>
												<span className='icon-[lucide--pencil] size-4'></span>
											</button>
											<button title={isProtected ? 'Categoria protegida - não pode ser excluída' : 'Excluir'} onClick={() => setDeleteDialog({ open: true, cat })} disabled={!!isProtected} className={`inline-flex items-center justify-center size-8 rounded-full transition ${isProtected ? 'text-zinc-300 cursor-not-allowed dark:text-zinc-600' : 'text-zinc-500 hover:bg-red-100 hover:text-red-700 dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-700'}`}>
												<span className='icon-[lucide--trash] size-4'></span>
											</button>
										</div>
									</div>
								)
							})}
					</div>
				</div>
			</Offcanvas>

			{/* Dialog de exclusão */}
			<Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, cat: null })} title='Excluir categoria' description={`Tem certeza que deseja excluir "${deleteDialog.cat?.name}"? Essa ação não pode ser desfeita.`}>
				<div className='flex justify-end gap-2'>
					<Button style='bordered' onClick={() => setDeleteDialog({ open: false, cat: null })}>
						Cancelar
					</Button>
					<Button style='filled' className='bg-red-600 hover:bg-red-700' onClick={confirmDelete}>
						Excluir
					</Button>
				</div>
			</Dialog>

			{/* Offcanvas formulário */}
			<ProblemCategoryFormOffcanvas open={formOpen} onClose={() => setFormOpen(false)} category={editing} onSaved={load} />
		</>
	)
}
