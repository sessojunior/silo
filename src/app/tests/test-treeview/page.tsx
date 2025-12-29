'use client'

import TreeView, { type TreeNode } from '@/components/ui/TreeView'

const treeData: TreeNode[] = [
	{ id: '1', name: 'Nó de Folha Raiz 1', icon: 'icon-[lucide--earth]', data: { tipo: 'folha raiz 1' } },
	{ id: '2', name: 'Nó de Folha Raiz 2', icon: 'icon-[lucide--key-round]', data: { tipo: 'folha raiz 2' } },
	{
		id: '3',
		name: 'Equipamentos',
		icon: null,
		children: [
			{
				id: '3-1',
				name: 'Máquinas',
				icon: null,
				children: [
					{
						id: '3-1-1',
						name: 'Servidor Principal',
						icon: 'icon-[lucide--server]',
						data: { tipo: 'servidor' },
					},
					{
						id: '3-1-2',
						name: 'Workstation Linux',
						icon: 'icon-[lucide--laptop]',
						data: { tipo: 'workstation' },
					},
				],
			},
			{
				id: '3-2',
				name: 'Relatórios',
				icon: 'icon-[lucide--file-text]',
				data: { tipo: 'relatório' },
			},
		],
	},
	{
		id: '4',
		name: 'Serviços',
		icon: 'icon-[lucide--folder]',
		children: [
			{
				id: '4-1',
				name: 'Redes',
				icon: 'icon-[lucide--network]',
				children: [
					{
						id: '4-1-1',
						name: 'Sistemas',
						icon: 'icon-[lucide--cpu]',
						children: [
							{ id: '4-1-1-1', name: 'Sistemas', icon: 'icon-[lucide--cpu]', children: [] },
							{ id: '4-1-1-2', name: 'Sistemas', icon: 'icon-[lucide--cpu]', children: [] },
						],
					},
					{ id: '4-1-2', name: 'Base de dados', icon: 'icon-[lucide--database]', data: { tipo: 'db' } },
				],
			},
			{
				id: '4-2',
				name: 'Impressora 1',
				icon: 'icon-[lucide--printer]',
				data: { tipo: 'modelo' },
			},
		],
	},
	{
		id: '5',
		name: 'Softwares',
		icon: 'icon-[lucide--folder]',
		children: [
			{
				id: '5-1',
				name: 'Python',
				icon: 'icon-[lucide--file-code]',
				data: { linguagem: 'python' },
			},
		],
	},
]

export default function TreeviewPage() {
	return (
		<main className='p-8'>
			<h1 className='text-2xl font-semibold mb-6'>TreeView</h1>

			<div className='space-y-8'>
				<div>
					<h2 className='text-lg font-medium mb-4'>TreeView - Padrão (fechado)</h2>
					<TreeView nodes={treeData} />
				</div>

				<div>
					<h2 className='text-lg font-medium mb-4'>TreeView - Tudo aberto (defaultExpanded=true)</h2>
					<TreeView nodes={treeData} defaultExpanded={true} />
				</div>
			</div>
		</main>
	)
}
