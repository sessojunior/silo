'use client'

import { useState, useEffect } from 'react'
import { toast } from '@/lib/toast'

import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Offcanvas from '@/components/ui/Offcanvas'
import Dialog from '@/components/ui/Dialog'
import ProductForm from './components/ProductForm'
import type { Product } from '@/lib/db/schema'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function SettingsProductsPage() {
	const [products, setProducts] = useState<Product[]>([])
	const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
	const [loading, setLoading] = useState(true)
	const [search, setSearch] = useState('')
	const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'unavailable'>('all')

	// Estados do formulário
	const [offcanvasOpen, setOffcanvasOpen] = useState(false)
	const [editing, setEditing] = useState<Product | null>(null)

	// Estados do modal de exclusão
	const [dialogOpen, setDialogOpen] = useState(false)
	const [deleting, setDeleting] = useState<Product | null>(null)
	const [formLoading, setFormLoading] = useState(false)

	// Carregar produtos
	useEffect(() => {
		fetchProducts()
	}, [])

	// Filtrar produtos
	useEffect(() => {
		let filtered = products

		// Filtro de busca
		if (search) {
			filtered = filtered.filter((product) => product.name.toLowerCase().includes(search.toLowerCase()) || product.slug.toLowerCase().includes(search.toLowerCase()))
		}

		// Filtro de disponibilidade
		if (availabilityFilter === 'available') {
			filtered = filtered.filter((product) => product.available)
		} else if (availabilityFilter === 'unavailable') {
			filtered = filtered.filter((product) => !product.available)
		}

		setFilteredProducts(filtered)
	}, [products, search, availabilityFilter])

	async function fetchProducts() {
		try {
			setLoading(true)
			const response = await fetch('/api/admin/products?page=1&limit=1000') // Carregar todos para filtrar no frontend
			const data = await response.json()

			if (data.items) {
				setProducts(data.items)
			} else {
				toast({
					type: 'error',
					title: 'Erro ao carregar produtos',
					description: data.message || 'Erro desconhecido',
				})
			}
		} catch (error) {
			console.error('❌ [PAGE_SETTINGS_PRODUCTS] Erro ao carregar produtos:', { error })
			toast({
				type: 'error',
				title: 'Erro',
				description: 'Erro ao carregar produtos',
			})
		} finally {
			setLoading(false)
		}
	}

	function openCreateForm() {

		if (offcanvasOpen) {
			setOffcanvasOpen(false)
			setTimeout(() => {
				setEditing(null)
				setTimeout(() => setOffcanvasOpen(true), 50)
			}, 100)
		} else {
			setEditing(null)
			setTimeout(() => setOffcanvasOpen(true), 50)
		}
	}

	function openEditForm(product: Product) {


		if (offcanvasOpen) {
			setOffcanvasOpen(false)
			setTimeout(() => {
				setEditing(product)
				setTimeout(() => setOffcanvasOpen(true), 50)
			}, 100)
		} else {
			setEditing(product)
			setTimeout(() => setOffcanvasOpen(true), 50)
		}
	}

	function openDeleteDialog(product: Product) {
		setDeleting(product)
		setDialogOpen(true)
	}

	async function handleFormSubmit(data: { id?: string; name: string; available: boolean; turns: string[] }) {
		setFormLoading(true)
		try {
			const response = await fetch('/api/admin/products', {
				method: data.id ? 'PUT' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data),
			})
			const result = await response.json()

			if (response.ok) {
				toast({
					type: 'success',
					title: data.id ? 'Produto atualizado' : 'Produto criado',
					description: `${data.name} foi ${data.id ? 'atualizado' : 'criado'} com sucesso`,
				})
				setOffcanvasOpen(false)
				setEditing(null)
				await fetchProducts()
			} else {
				throw new Error(result.message || 'Erro desconhecido')
			}
		} catch (error: unknown) {
			console.error('❌ [PAGE_SETTINGS_PRODUCTS] Erro ao salvar produto:', { error })
			toast({
				type: 'error',
				title: data.id ? 'Erro ao atualizar' : 'Erro ao criar',
				description: error instanceof Error ? error.message : 'Erro ao salvar produto',
			})
		} finally {
			setFormLoading(false)
		}
	}

	async function handleDelete() {
		if (!deleting) return

		setFormLoading(true)
		try {
			const response = await fetch(`/api/admin/products?id=${deleting.id}`, {
				method: 'DELETE',
			})
			const data = await response.json()

			if (response.ok) {
				toast({
					type: 'success',
					title: 'Produto excluído',
					description: `${deleting.name} foi removido com sucesso`,
				})
				setDialogOpen(false)
				setDeleting(null)
				await fetchProducts()
			} else {
				throw new Error(data.message || 'Erro desconhecido')
			}
		} catch (error: unknown) {
			console.error('❌ [PAGE_SETTINGS_PRODUCTS] Erro ao excluir produto:', { error })
			toast({
				type: 'error',
				title: 'Erro ao excluir',
				description: error instanceof Error ? error.message : 'Erro ao excluir produto',
			})
		} finally {
			setFormLoading(false)
		}
	}

	const toggleProductAvailability = async (product: Product) => {
		try {
			const response = await fetch('/api/admin/products', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: product.id,
					name: product.name,
					slug: product.slug,
					available: !product.available,
					turns: product.turns,
				}),
			})

			if (response.ok) {
				toast({
					type: 'success',
					title: 'Status atualizado',
					description: `${product.name} está agora ${!product.available ? 'disponível' : 'indisponível'}`,
				})
				await fetchProducts()
			} else {
				throw new Error('Erro ao atualizar status')
			}
		} catch (error) {
			console.error('❌ [PAGE_SETTINGS_PRODUCTS] Erro ao alterar disponibilidade:', { error })
			toast({
				type: 'error',
				title: 'Erro',
				description: 'Erro ao alterar disponibilidade do produto',
			})
		}
	}

	const getStatusBadge = (available: boolean) => {
		if (available) {
			return <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'>🟢 Disponível</span>
		} else {
			return <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'>🔴 Indisponível</span>
		}
	}

	return (
		<div className='w-full'>
			{/* Cabeçalho */}
			<div className='p-6 border-b border-zinc-200 dark:border-zinc-700'>
				<h1 className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>Produtos</h1>
				<p className='text-zinc-600 dark:text-zinc-400 mt-1'>Gerencie os produtos e tasks do sistema</p>
			</div>

			{/* Conteúdo */}
			<div className='p-6'>
				<div className='max-w-7xl mx-auto space-y-6'>
					{/* Ações e Filtros */}
					<div className='flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center'>
						<div className='flex flex-col sm:flex-row gap-3 flex-1'>
							{/* Busca */}
							<div className='relative flex-1 min-w-80 max-w-lg'>
								<Input type='text' placeholder='Buscar produtos...' value={search} setValue={setSearch} className='pr-10' />
								<span className='icon-[lucide--search] absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 size-4' />
							</div>

							{/* Filtro de Disponibilidade */}
							<Select
								name='availabilityFilter'
								selected={availabilityFilter}
								onChange={(value) => setAvailabilityFilter(value as 'all' | 'available' | 'unavailable')}
								options={[
									{ value: 'all', label: 'Todos os status' },
									{ value: 'available', label: 'Apenas disponíveis' },
									{ value: 'unavailable', label: 'Apenas indisponíveis' },
								]}
								placeholder='Filtrar por disponibilidade'
							/>
						</div>

						{/* Botão Criar */}
						<Button onClick={openCreateForm} className='flex items-center gap-2'>
							<span className='icon-[lucide--plus] size-4' />
							Novo produto
						</Button>
					</div>

					{/* Estatísticas */}
					<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
						<div className='bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4'>
							<div className='flex items-center gap-2'>
								<span className='icon-[lucide--package] size-5 text-blue-600' />
								<div>
									<p className='text-sm font-medium text-zinc-600 dark:text-zinc-400'>Total de Produtos</p>
									<p className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>{products.length}</p>
								</div>
							</div>
						</div>
						<div className='bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4'>
							<div className='flex items-center gap-2'>
								<span className='icon-[lucide--check-circle] size-5 text-green-600' />
								<div>
									<p className='text-sm font-medium text-zinc-600 dark:text-zinc-400'>Produtos Disponíveis</p>
									<p className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>{products.filter((p) => p.available).length}</p>
								</div>
							</div>
						</div>
						<div className='bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4'>
							<div className='flex items-center gap-2'>
								<span className='icon-[lucide--x-circle] size-5 text-red-600' />
								<div>
									<p className='text-sm font-medium text-zinc-600 dark:text-zinc-400'>Produtos Indisponíveis</p>
									<p className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>{products.filter((p) => !p.available).length}</p>
								</div>
							</div>
						</div>
					</div>

					{/* Lista de Produtos */}
					<div className='bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700'>
						<div className='p-6 border-b border-zinc-200 dark:border-zinc-700'>
							<h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-100'>Produtos ({filteredProducts.length})</h2>
							<p className='text-sm text-zinc-600 dark:text-zinc-400 mt-1'>Lista de todos os produtos cadastrados no sistema</p>
						</div>

						{loading ? (
							<div className='p-12 flex items-center justify-center text-center'>
								<LoadingSpinner 
									text="Carregando produtos..." 
									size="md" 
									variant="centered" 
								/>
							</div>
						) : filteredProducts.length === 0 ? (
							<div className='p-12 text-center'>
								<div className='max-w-md mx-auto'>
									<span className='icon-[lucide--package] size-12 text-zinc-400 mx-auto block mb-4' />
									<h3 className='text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2'>{search || availabilityFilter !== 'all' ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}</h3>
									<p className='text-zinc-600 dark:text-zinc-400 mb-6'>{search || availabilityFilter !== 'all' ? 'Tente ajustar os filtros para encontrar produtos.' : 'Comece criando o primeiro produto do sistema.'}</p>
									{!search && availabilityFilter === 'all' && <Button onClick={openCreateForm}>Criar primeiro produto</Button>}
								</div>
							</div>
						) : (
							<div className='overflow-x-auto'>
								<table className='w-full'>
									<thead className='bg-zinc-50 dark:bg-zinc-800'>
										<tr>
											<th className='px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider'>Produto</th>
											<th className='px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider'>Turnos</th>
											<th className='px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider'>Status</th>
											<th className='px-6 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider'>Ações</th>
										</tr>
									</thead>
									<tbody className='bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-700'>
										{filteredProducts.map((product) => (
											<tr key={product.id} className='hover:bg-zinc-50 dark:hover:bg-zinc-800/50'>
												<td className='px-6 py-4 whitespace-nowrap'>
													<div className='flex items-center gap-3'>
														<div className='size-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center'>
															<span className='icon-[lucide--package] size-5 text-blue-600 dark:text-blue-400' />
														</div>
														<div>
															<div className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>{product.name}</div>
															<div className='text-xs text-zinc-500 dark:text-zinc-400 font-mono'>{product.slug}</div>
														</div>
													</div>
												</td>
												<td className='px-6 py-4 whitespace-nowrap'>
													<div className='flex flex-wrap gap-1'>
														{Array.isArray(product.turns) ? (
															product.turns.map((turn) => (
																<span key={turn} className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'>
																	{turn.padStart(2, '0')}:00
																</span>
															))
														) : (
															<span className='text-xs text-zinc-500 dark:text-zinc-400 italic'>Sem turnos configurados</span>
														)}
													</div>
												</td>
												<td className='px-6 py-4 whitespace-nowrap'>
													<button onClick={() => toggleProductAvailability(product)} className='cursor-pointer'>
														{getStatusBadge(product.available)}
													</button>
												</td>
												<td className='px-6 py-4 whitespace-nowrap text-right'>
													<div className='flex items-center justify-end gap-2'>
														<button onClick={() => openEditForm(product)} className='size-10 rounded-full flex items-center justify-center text-blue-600 hover:text-blue-700 hover:bg-gray-100 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-zinc-800 transition-colors' title='Editar produto'>
															<span className='icon-[lucide--edit] size-4' />
														</button>
														<button onClick={() => openDeleteDialog(product)} className='size-10 rounded-full flex items-center justify-center text-red-600 hover:text-red-700 hover:bg-gray-100 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-zinc-800 transition-colors' title='Excluir produto'>
															<span className='icon-[lucide--trash] size-4' />
														</button>
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Offcanvas para formulário */}
			<Offcanvas
				open={offcanvasOpen}
				onClose={() => {
					setOffcanvasOpen(false)
					setEditing(null)
				}}
				title={editing ? 'Editar Produto' : 'Novo Produto'}
				width='md'
			>
				<ProductForm
					initialData={
						editing
							? {
									id: editing.id,
									name: editing.name,
									slug: editing.slug,
									available: editing.available,
									turns: Array.isArray(editing.turns) ? editing.turns : ['0', '6', '12', '18'],
								}
							: undefined
					}
					onSubmit={handleFormSubmit}
					onCancel={() => {
						setOffcanvasOpen(false)
						setEditing(null)
					}}
					loading={formLoading}
				/>
			</Offcanvas>

			{/* Dialog de confirmação de exclusão */}
			<Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title='Confirmar exclusão' description={`Tem certeza que deseja excluir o produto "${deleting?.name}"? Esta ação não pode ser desfeita.`}>
				<div className='flex gap-3 justify-end mt-6'>
					<Button type='button' style='bordered' onClick={() => setDialogOpen(false)} disabled={formLoading}>
						Cancelar
					</Button>
					<Button type='button' onClick={handleDelete} disabled={formLoading} className='bg-red-600 hover:bg-red-700 focus:bg-red-700'>
						{formLoading ? (
							<LoadingSpinner 
								text="Excluindo..." 
								size="xs" 
								variant="horizontal" 
							/>
						) : (
							<>
								<span className='icon-[lucide--trash] size-4 mr-2' />
								Excluir produto
							</>
						)}
					</Button>
				</div>
			</Dialog>
		</div>
	)
}
