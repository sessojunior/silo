import React, { useRef, useEffect, useState } from 'react'
import Switch from '@/components/ui/Switch'

interface Product {
	id: string
	name: string
	slug: string
	available: boolean
}

interface ProductTableProps {
	products: Product[]
	onEdit: (product: Product) => void
	onDelete: (product: Product) => void
	onLoadMore: () => void
	loading: boolean
	hasMore: boolean
}

export default function ProductTable({ products, onEdit, onDelete, onLoadMore, loading, hasMore }: ProductTableProps) {
	const loaderRef = useRef<HTMLTableRowElement>(null)
	const [hasFetched, setHasFetched] = useState(false)

	// Marca que já buscou pelo menos uma vez
	useEffect(() => {
		if (!loading) setHasFetched(true)
	}, [loading])

	// Scroll infinito: observa o último elemento
	useEffect(() => {
		if (!hasMore || loading) return
		const observer = new window.IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) onLoadMore()
			},
			{ threshold: 1 },
		)
		if (loaderRef.current) observer.observe(loaderRef.current)
		return () => observer.disconnect()
	}, [hasMore, loading, onLoadMore])

	return (
		<div className='overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'>
			{products.length === 0 && <>{loading ? <div className='p-8 text-center text-zinc-400'>Carregando...</div> : hasFetched ? <div className='p-8 text-center text-zinc-400'>Nenhum produto encontrado.</div> : null}</>}
			{products.length > 0 && (
				<table className='min-w-full text-sm'>
					<thead>
						<tr className='bg-zinc-100 dark:bg-zinc-800'>
							<th className='px-4 py-3 text-left font-semibold'>Nome</th>
							<th className='px-4 py-3 text-left font-semibold'>Slug</th>
							<th className='px-4 py-3 text-left font-semibold'>Disponível</th>
							<th className='px-4 py-3 text-right font-semibold'>Ações</th>
						</tr>
					</thead>
					<tbody>
						{products.map((product) => (
							<tr key={product.id} className='border-t border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition'>
								<td className='px-4 py-2 font-medium text-zinc-700 dark:text-zinc-200'>{product.name}</td>
								<td className='px-4 py-2'>
									<Switch id={`switch-${product.id}`} name={`switch-${product.id}`} checked={product.available} disabled size='sm' />
								</td>
								<td className='px-4 py-2 text-right space-x-2'>
									<button onClick={() => onEdit(product)} className='inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-800/30 dark:text-blue-400 dark:hover:bg-blue-700/40 transition'>
										Editar
									</button>
									<button onClick={() => onDelete(product)} className='inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-800/30 dark:text-red-400 dark:hover:bg-red-700/40 transition'>
										Excluir
									</button>
								</td>
							</tr>
						))}
						{hasMore && (
							<tr ref={loaderRef}>
								<td colSpan={3} className='py-4 text-center text-zinc-400'>
									{loading ? 'Carregando...' : 'Carregar mais...'}
								</td>
							</tr>
						)}
					</tbody>
				</table>
			)}
		</div>
	)
}
