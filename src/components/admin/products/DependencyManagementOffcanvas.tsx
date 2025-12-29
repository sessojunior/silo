import Button from '@/components/ui/Button'
import Offcanvas from '@/components/ui/Offcanvas'
import ProductDependencyMenuBuilder, { type ProductDependencyItem } from '@/components/admin/products/ProductDependencyMenuBuilder'

interface ProductDependency {
	id: string
	name: string
	icon?: string
	description?: string
	parentId?: string | null
	treePath?: string | null
	treeDepth: number
	sortKey?: string | null
	children?: ProductDependency[]
}

interface DependencyManagementOffcanvasProps {
	open: boolean
	onClose: () => void
	dependencies: ProductDependency[]
	loadingManagement: boolean
	convertToProductDependencyItems: (deps: ProductDependency[]) => ProductDependencyItem[]
	convertFromProductDependencyItems: (items: ProductDependencyItem[]) => ProductDependency[]
	handleReorderDependencies: (deps: ProductDependency[]) => void
	openEditItemForm: (item: ProductDependency) => void
	openDeleteDialog: (item: ProductDependency) => void
	openAddItemForm: () => void
}

export default function DependencyManagementOffcanvas({ open, onClose, dependencies, loadingManagement, convertToProductDependencyItems, convertFromProductDependencyItems, handleReorderDependencies, openEditItemForm, openDeleteDialog, openAddItemForm }: DependencyManagementOffcanvasProps) {
	const convertToFlatList = (deps: ProductDependency[], level = 0): Array<ProductDependency & { level: number }> => {
		const result: Array<ProductDependency & { level: number }> = []
		for (const dep of deps) {
			result.push({ ...dep, level })
			if (dep.children && dep.children.length > 0) {
				result.push(...convertToFlatList(dep.children, level + 1))
			}
		}
		return result
	}

	return (
		<Offcanvas
			open={open}
			onClose={onClose}
			title={
				<div className='flex items-center gap-3'>
					<span className='icon-[lucide--layers] size-5 text-blue-600' />
					<div>
						<h2 className='text-lg font-semibold'>Gerenciar Dependências</h2>
						<p className='text-sm font-normal text-zinc-500 dark:text-zinc-400'>Organize e configure as dependências do produto</p>
					</div>
				</div>
			}
			width='xl'
		>
			<div className='flex flex-col gap-6 h-full'>
				{/* Cabeçalho com estatísticas */}
				<div className='flex flex-col gap-4 pb-4 border-b border-dashed border-zinc-200 dark:border-zinc-700'>
					<div className='flex items-center justify-between'>
						<div className='flex items-center gap-4'>
							<div className='flex items-center gap-2'>
								<span className='icon-[lucide--folder-tree] size-4 text-zinc-600 dark:text-zinc-400' />
								<span className='text-base font-medium text-zinc-600 dark:text-zinc-400'>{dependencies.length} dependências principais</span>
							</div>
							<div className='flex items-center gap-2'>
								<span className='icon-[lucide--git-branch] size-4 text-zinc-600 dark:text-zinc-400' />
								<span className='text-base font-medium text-zinc-600 dark:text-zinc-400'>{convertToFlatList(dependencies).length} itens no total</span>
							</div>
						</div>
						<Button type='button' icon='icon-[lucide--plus]' style='filled' className='py-2 px-4' onClick={openAddItemForm}>
							Nova Dependência
						</Button>
					</div>

					<div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-2'>
						<div className='flex items-start gap-3'>
							<span className='icon-[lucide--info] size-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0' />
							<div className='text-base text-blue-700 dark:text-blue-300'>
								<p className='font-medium mb-1'>Instruções:</p>
								<ul className='space-y-1 text-base'>
									<li>• Arraste e solte para reordenar as dependências.</li>
									<li>• Use o botão de grip para mover itens entre níveis.</li>
									<li>• Clique nos botões de ação para editar ou excluir.</li>
								</ul>
							</div>
						</div>
					</div>
				</div>

				{/* Skeleton de carregamento realista */}
				{loadingManagement && (
					<div className='flex flex-col gap-1'>
						{/* Simula estrutura hierárquica real do MenuBuilder */}
						{[
							{ level: 0, width: '85%' },
							{ level: 1, width: '70%' },
							{ level: 2, width: '60%' },
							{ level: 2, width: '65%' },
							{ level: 1, width: '75%' },
							{ level: 2, width: '55%' },
							{ level: 0, width: '90%' },
							{ level: 1, width: '68%' },
							{ level: 1, width: '72%' },
							{ level: 2, width: '58%' },
							{ level: 0, width: '80%' },
							{ level: 1, width: '66%' },
						].map((item, i) => (
							<div
								key={i}
								className='animate-pulse'
								style={{
									marginLeft: `${item.level * 50}px`,
									maxWidth: '414px',
								}}
							>
								<div className='flex items-center gap-2 p-3 bg-white border border-zinc-200 dark:border-zinc-700 rounded-lg dark:bg-zinc-800'>
									{/* Grip icon skeleton */}
									<div className='w-4 h-4 bg-zinc-200 dark:bg-zinc-700 rounded flex-shrink-0' />
									{/* Item icon skeleton */}
									<div className='w-4 h-4 bg-zinc-200 dark:bg-zinc-700 rounded flex-shrink-0' />
									{/* Text skeleton com largura variável */}
									<div className='h-4 bg-zinc-200 dark:bg-zinc-700 rounded flex-1' style={{ width: item.width }} />
									{/* Level badge skeleton */}
									<div className='w-8 h-8 bg-zinc-200 dark:bg-zinc-700 rounded-full flex-shrink-0' />
									{/* Action buttons skeleton */}
									<div className='flex gap-1 flex-shrink-0'>
										<div className='w-8 h-8 bg-zinc-200 dark:bg-zinc-700 rounded-full' />
										<div className='w-8 h-8 bg-zinc-200 dark:bg-zinc-700 rounded-full' />
										<div className='w-8 h-8 bg-zinc-200 dark:bg-zinc-700 rounded-full' />
									</div>
								</div>
							</div>
						))}
					</div>
				)}

				{/* MenuBuilder principal */}
				{!loadingManagement && (
					<div className='flex-1 min-h-0'>
						<ProductDependencyMenuBuilder
							items={convertToProductDependencyItems(dependencies)}
							setItems={(newItems) => {
								const convertedDeps = convertFromProductDependencyItems(newItems)
								handleReorderDependencies(convertedDeps)
							}}
							onEdit={(id) => {
								// Busca a dependência completa pelo ID
								const findDependency = (deps: ProductDependency[], searchId: string): ProductDependency | null => {
									for (const dep of deps) {
										if (dep.id === searchId) return dep
										if (dep.children) {
											const found = findDependency(dep.children, searchId)
											if (found) return found
										}
									}
									return null
								}
								const dependency = findDependency(dependencies, id)
								if (dependency) {
									openEditItemForm(dependency)
								}
							}}
							onDelete={(id) => {
								// Busca a dependência completa pelo ID
								const findDependency = (deps: ProductDependency[], searchId: string): ProductDependency | null => {
									for (const dep of deps) {
										if (dep.id === searchId) return dep
										if (dep.children) {
											const found = findDependency(dep.children, searchId)
											if (found) return found
										}
									}
									return null
								}
								const dependency = findDependency(dependencies, id)
								if (dependency) {
									openDeleteDialog(dependency)
								}
							}}
						/>
					</div>
				)}

				{/* Estado vazio */}
				{!loadingManagement && dependencies.length === 0 && (
					<div className='flex-1 flex flex-col items-center justify-center py-12 text-center'>
						<span className='icon-[lucide--layers] mb-4 text-4xl text-zinc-400' />
						<h4 className='text-lg font-medium text-zinc-600 dark:text-zinc-300'>Nenhuma dependência encontrada</h4>
						<p className='text-sm text-zinc-500 dark:text-zinc-400 mb-6'>Comece adicionando as primeiras dependências deste produto.</p>
						<Button type='button' icon='icon-[lucide--plus]' style='filled' onClick={openAddItemForm}>
							Adicionar primeira dependência
						</Button>
					</div>
				)}
			</div>
		</Offcanvas>
	)
}
