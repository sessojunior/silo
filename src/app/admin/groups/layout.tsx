import { ReactNode } from 'react'
import ProductTabs from '@/components/admin/nav/ProductTabs'
import Content from '@/components/admin/nav/Content'

interface Props {
	children: ReactNode
}

export default function GroupsLayout({ children }: Props) {
	// Abas para navegação entre Grupos e Usuários
	const tabs = [
		{ label: 'Grupos', url: `/admin/groups` },
		{ label: 'Usuários', url: `/admin/groups/users` },
	]

	return (
		<div className='flex min-h-[calc(100vh-64px)] w-full flex-col bg-white dark:bg-zinc-900'>
			<div className='flex flex-col'>
				{/* Botões */}
				<div className='flex'>
					<div className='flex w-full border-b border-zinc-200 bg-zinc-100 px-4 py-3 transition dark:border-zinc-700 dark:bg-zinc-700'>
						<ProductTabs tabs={tabs} />
					</div>
				</div>
				<div>
					{/* Conteúdo */}
					<Content>
						<div className='flex min-h-full w-full flex-col items-start justify-start text-zinc-600 dark:text-zinc-200'>{children}</div>
					</Content>
				</div>
			</div>
		</div>
	)
}
