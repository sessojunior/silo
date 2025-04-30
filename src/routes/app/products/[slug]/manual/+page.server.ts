import { error } from '@sveltejs/kit'

// Dados de documentos
const docs = [
	{
		icon: null,
		label: 'Equipamentos',
		url: null,
		children: [
			{
				icon: null,
				label: 'Máquinas',
				url: null,
				children: [
					{
						icon: 'icon-[lucide--computer]',
						label: 'Máquina 1',
						url: '#',
						children: null
					},
					{
						icon: 'icon-[lucide--computer]',
						label: 'Máquina 2',
						url: '#',
						children: null
					},
					{
						icon: 'icon-[lucide--computer]',
						label: 'Máquina 3',
						url: '#',
						children: null
					}
				]
			},
			{
				icon: null,
				label: 'Redes internas',
				url: '#',
				children: [
					{
						icon: 'icon-[lucide--network]',
						label: 'Rede interna 1',
						url: '#',
						children: null
					},
					{
						icon: 'icon-[lucide--network]',
						label: 'Rede interna 2',
						url: '#',
						children: null
					}
				]
			},
			{
				icon: null,
				label: 'Redes externas',
				url: '#',
				children: [
					{
						icon: 'icon-[lucide--network]',
						label: 'Rede externa 1',
						url: '#',
						children: null
					},
					{
						icon: 'icon-[lucide--network]',
						label: 'Rede externa 2',
						url: '#',
						children: null
					}
				]
			}
		]
	},
	{
		icon: null,
		label: 'Dependências',
		url: null,
		children: [
			{
				icon: null,
				label: 'Sistema',
				url: null,
				children: [
					{
						icon: null,
						label: 'Hosts',
						url: '#',
						children: [
							{
								icon: 'icon-[lucide--computer]',
								label: 'Host 1',
								url: '#',
								children: null
							},
							{
								icon: 'icon-[lucide--computer]',
								label: 'Host 2',
								url: '#',
								children: null
							}
						]
					},
					{
						icon: null,
						label: 'Softwares',
						url: '#',
						children: [
							{
								icon: 'icon-[lucide--app-window]',
								label: 'Software 1',
								url: '#',
								children: null
							},
							{
								icon: 'icon-[lucide--app-window]',
								label: 'Software 2',
								url: '#',
								children: null
							}
						]
					}
				]
			},
			{
				icon: null,
				label: 'Recursos humanos',
				url: null,
				children: [
					{
						icon: null,
						label: 'Responsáveis técnicos do INPE',
						url: '#',
						children: [
							{
								icon: 'icon-[lucide--user-round]',
								label: 'Pesquisador 1',
								url: '#',
								children: null
							},
							{
								icon: 'icon-[lucide--user-round]',
								label: 'Pesquisador 2',
								url: '#',
								children: null
							}
						]
					},
					{
						icon: null,
						label: 'Suporte',
						url: '#',
						children: [
							{
								icon: 'icon-[lucide--user-round]',
								label: 'Técnico 1',
								url: '#',
								children: null
							},
							{
								icon: 'icon-[lucide--user-round]',
								label: 'Técnico 2',
								url: '#',
								children: null
							}
						]
					}
				]
			}
		]
	},
	{
		icon: null,
		label: 'Elementos afetados',
		url: null,
		children: [
			{
				icon: null,
				label: 'Recursos',
				url: null,
				children: [
					{
						icon: null,
						label: 'Hosts',
						url: '#',
						children: [
							{
								icon: 'icon-[lucide--computer]',
								label: 'Host 1',
								url: '#',
								children: null
							},
							{
								icon: 'icon-[lucide--computer]',
								label: 'Host 2',
								url: '#',
								children: null
							}
						]
					},
					{
						icon: null,
						label: 'Softwares',
						url: '#',
						children: [
							{
								icon: 'icon-[lucide--app-window]',
								label: 'Software 1',
								url: '#',
								children: null
							},
							{
								icon: 'icon-[lucide--app-window]',
								label: 'Software 2',
								url: '#',
								children: null
							}
						]
					}
				]
			},
			{
				icon: null,
				label: 'Grupos',
				url: null,
				children: [
					{
						icon: 'icon-[lucide--users-round]',
						label: 'Grupo 1',
						url: '#',
						children: null
					},
					{
						icon: 'icon-[lucide--users-round]',
						label: 'Grupo 2',
						url: '#',
						children: null
					},
					{
						icon: 'icon-[lucide--users-round]',
						label: 'Grupo 3',
						url: '#',
						children: null
					},
					{
						icon: 'icon-[lucide--users-round]',
						label: 'Grupo 4',
						url: '#',
						children: null
					}
				]
			},
			{
				icon: null,
				label: 'Clientes externos',
				url: null,
				children: [
					{
						icon: null,
						label: 'INPE',
						url: '#',
						children: [
							{
								icon: 'icon-[lucide--user-round]',
								label: 'Cliente 1',
								url: '#',
								children: null
							},
							{
								icon: 'icon-[lucide--user-round]',
								label: 'Cliente 2',
								url: '#',
								children: null
							}
						]
					},
					{
						icon: null,
						label: 'Outros',
						url: '#',
						children: [
							{
								icon: 'icon-[lucide--user-round]',
								label: 'Cliente 3',
								url: '#',
								children: null
							},
							{
								icon: 'icon-[lucide--user-round]',
								label: 'Cliente 4',
								url: '#',
								children: null
							},
							{
								icon: 'icon-[lucide--user-round]',
								label: 'Cliente 5',
								url: '#',
								children: null
							}
						]
					}
				]
			}
		]
	}
]

// Dados de contatos
const contacts = [
	{
		image: 'https://randomuser.me/api/portraits/men/10.jpg',
		name: 'Marcelo Silvano',
		role: 'Analista técnico',
		team: 'CGCT',
		email: 'marcelo.silvano@inpe.br'
	},
	{
		image: 'https://randomuser.me/api/portraits/men/20.jpg',
		name: 'José Santana',
		role: 'Metereologista',
		team: 'DIPTC',
		email: 'jose.santana@inpe.br'
	},
	{
		image: 'https://randomuser.me/api/portraits/women/30.jpg',
		name: 'Aline Mendez',
		role: 'Pesquisador',
		team: 'DIPTC',
		email: 'aline.mendez@inpe.br'
	}
]

// Dados de manual
const manual = {
	sections: [
		{
			id: '1',
			title: '1. Introdução',
			description:
				'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
			chapters: [
				{
					id: '1.1',
					title: '1.1. Como funciona o modelo',
					description:
						'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'
				},
				{
					id: '1.2',
					title: '1.2. Descrição do funcionamento interno',
					description:
						'Nam turpis ligula, vestibulum id risus vitae, posuere scelerisque massa. Proin odio risus, pulvinar ac elementum sit amet, dignissim vel lacus. Maecenas efficitur velit eget tellus maximus iaculis.'
				}
			]
		},
		{
			id: '2',
			title: '2. Funcionamento',
			description: null,
			chapters: [
				{
					id: '2.1',
					title: '2.1. Pré-processamento',
					description:
						'Donec quis feugiat metus, at cursus erat. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Cras varius nisi sit amet ante auctor lacinia. Nulla in rutrum nulla, et auctor nulla.'
				},
				{
					id: '2.2',
					title: '2.2. Operações realizadas',
					description:
						'Vestibulum id magna ullamcorper dolor rutrum tincidunt. Maecenas egestas lorem mi, nec elementum libero feugiat quis. Vivamus erat lacus, commodo eget vehicula at, blandit eget velit..'
				},
				{
					id: '2.3',
					title: '2.3. Pós-processamento',
					description: 'Suspendisse iaculis porttitor mollis. Pellentesque quis augue nisi. Aenean maximus ex congue arcu euismod gravida. Nam nec neque nisl.'
				}
			]
		},
		{
			id: '3',
			title: '3. Resolução de conflitos',
			description: 'Pellentesque condimentum imperdiet sapien, vel vestibulum ante maximus ultricies. Sed scelerisque maximus enim. Vivamus sed ornare sem.',
			chapters: []
		}
	]
}

export function load({ params }) {
	// Verifica se o slug foi fornecido
	if (!params.slug) error(404)

	return {
		docs,
		contacts,
		manual
	}
}
