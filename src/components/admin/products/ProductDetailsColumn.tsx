import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'

// Tipos para os dados da API (copiados da página principal)
interface ProductContact {
	id: string
	name: string
	role: string
	team: string
	email: string
	phone?: string
	image?: string
}

interface ProductManualChapter {
	id: string
	title: string
	content: string
	order: number
}

interface ProductManualSection {
	id: string
	title: string
	description?: string
	order: number
	chapters: ProductManualChapter[]
}

// Props que o componente recebe da página principal
interface ProductDetailsColumnProps {
	// Dados
	contacts: ProductContact[]
	problemsCount: number
	solutionsCount: number
	lastUpdated: Date | null

	// Handlers
	onOpenContactSelector: () => void

	// Utilitários
	formatTimeAgo: (date: Date | null) => string

	// Children para renderizar o manual
	children?: React.ReactNode
}

export default function ProductDetailsColumn({ contacts, problemsCount, solutionsCount, lastUpdated, onOpenContactSelector, formatTimeAgo, children }: ProductDetailsColumnProps) {
	return (
		<div className='flex w-full flex-grow flex-col'>
			<div className='scrollbar size-full h-[calc(100vh-131px)] overflow-y-auto'>
				{/* Cabeçalho */}
				<div className='flex flex-col gap-2 border-b border-zinc-200 p-8 md:grid md:grid-cols-2 dark:border-zinc-700'>
					<div className='flex'>
						<div className='flex w-8 items-center justify-center'>
							<span className='icon-[lucide--book-text] size-4'></span>
						</div>
						<div className='flex'>
							<span>Manual do produto disponível</span>
						</div>
					</div>
					<div className='flex'>
						<div className='flex w-8 items-center justify-center'>
							<span className='icon-[lucide--users-round] size-4'></span>
						</div>
						<div className='flex'>
							<span>Técnicos responsáveis: {contacts.length}</span>
						</div>
					</div>
					<div className='flex'>
						<div className='flex w-8 items-center justify-center'>
							<span className='icon-[lucide--triangle-alert] size-4'></span>
						</div>
						<div className='flex'>
							<span>Problemas reportados: {problemsCount}</span>
						</div>
					</div>
					<div className='flex'>
						<div className='flex w-8 items-center justify-center'>
							<span className='icon-[lucide--book-check] size-4'></span>
						</div>
						<div className='flex'>
							<span>Soluções encontradas: {solutionsCount}</span>
						</div>
					</div>
					<div className='flex'>
						<div className='flex w-8 items-center justify-center'>
							<span className='icon-[lucide--clock-4] size-4'></span>
						</div>
						<div className='flex'>
							<span>Atualizado {formatTimeAgo(lastUpdated)}</span>
						</div>
					</div>
				</div>

				{/* Responsáveis técnicos */}
				<div className='border-b border-zinc-200 p-8 dark:border-zinc-700'>
					<div className='flex w-full items-center justify-between pb-6'>
						<div>
							<h3 className='text-xl font-medium'>Contatos em caso de problemas</h3>
							<div>
								<span className='text-sm font-medium text-zinc-600 dark:text-zinc-400'>{contacts.length} responsáveis técnicos</span>
							</div>
						</div>
						<Button type='button' icon='icon-[lucide--user-plus]' style='unstyled' className='py-2' onClick={onOpenContactSelector}>
							Gerenciar contatos
						</Button>
					</div>
					{contacts.length === 0 ? (
						<div className='text-center pt-8'>
							<div className='max-w-md mx-auto'>
								<span className='icon-[lucide--users] size-12 text-zinc-400 mx-auto block mb-4' />
								<h3 className='text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2'>Nenhum contato associado</h3>
								<p className='text-zinc-600 dark:text-zinc-400 mb-6'>Gerencie os contatos responsáveis por este produto para facilitar a comunicação.</p>
							</div>
						</div>
					) : (
						<div className='flex flex-col gap-4 md:grid md:grid-cols-2'>
							{/* Contatos */}
							{contacts.map((contact) => (
								<div key={contact.id} className='flex gap-x-2'>
									<div className='size-12 shrink-0'>
										<Avatar 
											src={contact.image} 
											name={contact.name} 
											size="lg"
										/>
									</div>
									<div className='flex flex-col'>
										<div className='text-base font-bold'>{contact.name}</div>
										<div className='text-sm font-medium text-zinc-600 dark:text-zinc-400'>
											{contact.role} <span className='text-zinc-300 dark:text-zinc-600'>•</span> {contact.team}
										</div>
										<div className='text-sm font-medium'>
											<a href={`mailto:${contact.email}`} className='text-zinc-500 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-300'>
												{contact.email}
											</a>
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Manual renderizado via children */}
				{children}
			</div>
		</div>
	)
}

// Exportando tipos para uso na página principal
export type { ProductContact, ProductManualChapter, ProductManualSection, ProductDetailsColumnProps }
