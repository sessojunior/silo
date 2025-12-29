'use client'

import { ProductProblem } from '@/lib/db/schema'
import Button from '@/components/ui/Button'

// Tipo estendido para incluir dados da categoria
interface ProductProblemWithCategory extends ProductProblem {
	categoryName?: string | null
	categoryColor?: string | null
}

interface ProblemsListColumnProps {
	listRef: React.RefObject<HTMLDivElement | null>
	filter: string
	setFilter: (value: string) => void
	onAddProblem: () => void
	onOpenCategories: () => void
	filteredProblems: ProductProblemWithCategory[]
	problemsToShow: ProductProblemWithCategory[]
	solutionsCount: Record<string, number>
	onSelectProblem: (problem: ProductProblemWithCategory) => void
	selectedProblemId: string | null
	loadingDetail: boolean
}

export function ProblemsListColumn({ listRef, filter, setFilter, onAddProblem, onOpenCategories, filteredProblems, problemsToShow, solutionsCount, onSelectProblem, selectedProblemId, loadingDetail }: ProblemsListColumnProps) {
	return (
		<div className='flex w-full flex-shrink-0 flex-col border-r border-zinc-200 sm:w-md dark:border-zinc-700'>
			<div ref={listRef} className='scrollbar size-full h-[calc(100vh-131px)] overflow-y-auto'>
				{/* Campo de busca */}
				<div className='border-b border-zinc-200 p-4 flex items-center gap-2'>
					<div className='relative flex flex-1 h-10'>
						<input type='text' name='problem' value={filter} onChange={(e) => setFilter(e.target.value)} className='block w-full rounded-lg border-zinc-200 px-4 py-2.5 pe-11 sm:py-3 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:placeholder-zinc-500 focus:border-blue-500 focus:ring-blue-500' placeholder='Procurar problema...' />
						<div className='pointer-events-none absolute inset-y-0 end-0 z-20 flex items-center pe-4'>
							<span className='icon-[lucide--search] ml-1 size-4 shrink-0 text-zinc-400 dark:text-zinc-500'></span>
						</div>
					</div>
					<Button type='button' icon='icon-[lucide--plus]' style='unstyled' className='flex size-10' title='Adicionar problema' aria-label='Adicionar problema' onClick={onAddProblem} />
					<Button type='button' icon='icon-[lucide--settings]' style='unstyled' className='flex size-10' title='Gerenciar categorias' aria-label='Gerenciar categorias' onClick={onOpenCategories} />
				</div>

				{filteredProblems.length > 0 ? (
					<ListProblems problems={problemsToShow} solutionsCount={solutionsCount} onSelect={onSelectProblem} selectedId={selectedProblemId} loadingDetail={loadingDetail} />
				) : (
					<div className='border-b border-zinc-200 p-8'>
						<div className='rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800 dark:border-zinc-600 dark:bg-yellow-800/10 dark:text-zinc-500' role='alert'>
							<div className='flex flex-col'>
								<div className='flex justify-center pb-1'>
									<span className='icon-[lucide--search-x] size-12 shrink-0 text-zinc-300 dark:text-zinc-500'></span>
								</div>
								<div className='flex flex-col'>
									<h3 className='text-center text-base font-semibold text-zinc-600 dark:text-zinc-300'>Nenhum resultado</h3>
									<div className='text-center text-sm text-zinc-700 dark:text-zinc-400'>Nenhum resultado para o texto informado.</div>
								</div>
							</div>
						</div>
					</div>
				)}

				<div className='px-8 py-4'>
					<div className='flex justify-center'>
						<Button type='button' icon='icon-[lucide--plus]' style='unstyled' className='py-2' onClick={onAddProblem}>
							Adicionar problema
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}

function ListProblems({ problems, solutionsCount, onSelect, selectedId, loadingDetail }: { problems: ProductProblemWithCategory[]; solutionsCount: Record<string, number>; onSelect: (problem: ProductProblemWithCategory) => void; selectedId: string | null; loadingDetail: boolean }) {
	return (
		<div className='flex flex-col'>
			{problems.length > 0 &&
				problems.map((problem) => (
					<div key={problem.id} className={`flex flex-col border-b border-zinc-200 dark:border-zinc-700 cursor-pointer ${selectedId === problem.id ? 'bg-zinc-100 dark:bg-zinc-800' : ''} ${loadingDetail ? 'opacity-50 pointer-events-none' : ''}`} onClick={() => !loadingDetail && onSelect(problem)}>
						<div className='flex w-full flex-col gap-y-1 p-8 hover:bg-zinc-50 dark:hover:bg-zinc-800'>
							{/* Nome da categoria */}
							{problem.categoryName && (
								<div className='mb-1'>
									<span
										className='inline-flex items-center rounded-md px-2 py-1 text-xs font-medium border'
										style={{
											backgroundColor: problem.categoryColor ? `${problem.categoryColor}20` : '#6b728020',
											color: problem.categoryColor || '#6b7280',
											borderColor: problem.categoryColor ? `${problem.categoryColor}40` : '#6b728040',
										}}
									>
										{problem.categoryName}
									</span>
								</div>
							)}

							<div className='flex w-full items-center justify-between gap-x-2'>
								<span
									className='text-base font-semibold text-zinc-700 dark:text-zinc-300 line-clamp-2'
									style={{
										display: '-webkit-box',
										WebkitLineClamp: 2,
										WebkitBoxOrient: 'vertical',
										overflow: 'hidden',
									}}
								>
									{problem.title}
								</span>
								<span className='ms-1 shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-700 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400'>{solutionsCount[problem.id] ?? 0}</span>
							</div>
							<div className='flex text-sm text-zinc-600 dark:text-zinc-400'>
								<p
									className='line-clamp-4'
									style={{
										display: '-webkit-box',
										WebkitLineClamp: 4,
										WebkitBoxOrient: 'vertical',
										overflow: 'hidden',
									}}
								>
									{problem.description}
								</p>
							</div>
						</div>
					</div>
				))}
		</div>
	)
}
