<script lang="ts">
	interface Problems {
		id: string
		title: string
		date: string
		description: string
		solutions: number
	}
	interface Solution {
		id: string
		replyId: string | null
		date: string
		userId: number
		userName: string
		description: string
		verified: boolean
	}
	interface Screenshot {
		id: string
		src: string
		alt: string
	}
	interface Problem {
		id: string
		title: string
		date: string
		description: string
		screenshots: Screenshot[]
		solutions: Solution[]
	}

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
	const problems: Problems[] = [
		{
			id: '1',
			title: 'Problema augue velit sagittis in purus blandit vulputate 1',
			date: '2025-02-09 07:08:00',
			description:
				'Praesent augue velit, sagittis in purus blandit, vulputate volutpat est. Etiam vel justo justo. Praesent eget tempor lectus, sed placerat turpis. Cras consequat et lacus et suscipit. Nam vitae turpis feugiat, interdum nunc a, tincidunt velit...',
			solutions: 5
		},
		{
			id: '2',
			title: 'Problema eget vulputate 2',
			date: '2025-01-09 11:47:00',
			description:
				'Aenean ut turpis dui. Pellentesque a efficitur odio, eu volutpat nisi. Nulla ornare tincidunt auctor. Nam ac velit mi. Phasellus sit amet mauris id ipsum interdum dapibus eu et sem. Vivamus vestibulum mi nisl, eu rutrum quam cursus in. Duis vitae mattis mi, at suscipit massa...',
			solutions: 0
		},
		{
			id: '3',
			title: 'Problema placerat turpis interdum vulputate volutpat nunc 3',
			date: '2025-02-13 13:45:00',
			description:
				'Nunc a nisi ipsum. Mauris iaculis metus ut euismod venenatis. Ut commodo, elit ac accumsan vulputate, urna purus sodales augue, ut congue enim tortor ac lacus. Morbi finibus tellus vel turpis fermentum, nec iaculis nisi posuere. Suspendisse sit amet blandit ligula, vitae auctor ligula...',
			solutions: 2
		}
	]
	// const problems: Problems[] = []
	const problem = {
		id: '1',
		title: 'Problema augue velit sagittis in purus blandit vulputate 1',
		date: '2025-02-09 07:08:00',
		description: `
	    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean quis efficitur tellus. Suspendisse vitae justo lacinia, dictum orci mattis, fermentum dui.</p>
	    <p>
	      Nulla efficitur porta velit, in sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Donec vehicula nulla quis laoreet convallis. In malesuada
	      ligula vel molestie sagittis.
	    </p>
	    <p>Cras non lacus id est accumsan vestibulum.</p>
	  `,
		screenshots: [
			{ id: '1', src: 'https://confluence.ecmwf.int/download/attachments/52464844/worddavf74394bf4344047a1d0f1835d6740525.png', alt: 'Screenshot 1' },
			{ id: '2', src: 'https://confluence.ecmwf.int/download/attachments/52464881/worddav2b63bcd14ea990b6058f3dd44b65ab79.png', alt: 'Screenshot 2' }
		],
		// solutions: []
		solutions: [
			{
				id: '1.1',
				replyId: null,
				date: '2025-02-17 11:39:00',
				user: {
					id: '1',
					name: 'Ronaldo Gaúcho',
					avatar: 'https://randomuser.me/api/portraits/men/1.jpg'
				},
				description:
					'Praesent eget tempor lectus, sed placerat turpis. Phasellus sit amet mauris id ipsum interdum dapibus eu et sem. Vivamus vestibulum mi nisl, eu rutrum quam cursus in. Cras consequat et lacus et suscipit. Morbi finibus tellus vel turpis fermentum, nec iaculis nisi posuere. Suspendisse sit amet blandit ligula.',
				verified: false
			},
			{
				id: '1.2',
				replyId: null,
				date: '2025-02-15 22:40',
				user: {
					id: '2',
					name: 'Angélica Carioca',
					avatar: 'https://randomuser.me/api/portraits/women/2.jpg'
				},
				description:
					'Phasellus sit amet mauris id ipsum interdum dapibus eu et sem. Morbi finibus tellus vel turpis fermentum, nec iaculis nisi posuere. Suspendisse sit amet blandit ligula.',
				verified: false
			},
			{
				id: '1.2.1',
				replyId: '1.2',
				date: '2025-02-16 11:32:00',
				user: {
					id: '3',
					name: 'Rafael Dias',
					avatar: 'https://randomuser.me/api/portraits/men/3.jpg'
				},
				description: 'Quisque eget est ipsum. Phasellus a augue a nibh placerat facilisis?',
				verified: false
			},
			{
				id: '1.2.2',
				replyId: '1.2',
				date: '2025-02-16 21:07:00',
				user: {
					id: '4',
					name: 'Anderson Santos',
					avatar: 'https://randomuser.me/api/portraits/men/4.jpg'
				},
				description: 'Ut id libero non tortor ullamcorper porta sit amet eget justo. Proin viverra vitae nibh vel placerat. Donec sed pellentesque libero, ac ultrices felis.',
				verified: true
			},
			{
				id: '1.3',
				replyId: null,
				date: '2025-02-09 07:08:00',
				user: {
					id: '5',
					name: 'Mateus Gonçalves',
					avatar: 'https://randomuser.me/api/portraits/men/5.jpg'
				},
				description:
					'Aenean vehicula placerat lectus, vel facilisis odio gravida non. Suspendisse nisi nisl, venenatis vitae laoreet vel, tempor sit amet velit. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae.',
				verified: false
			},
			{
				id: '1.3.1',
				replyId: '1.3',
				date: '2025-02-16 21:07:00',
				user: {
					id: '6',
					name: 'Carlitos Dantes',
					avatar: 'https://randomuser.me/api/portraits/men/6.jpg'
				},
				description: 'Morbi finibus tellus vel turpis fermentum.',
				verified: false
			}
		]
	}

	// Função para formatar data
	// Transforma por exemplo, a data '2025-02-09 07:08:00' em '9 fev. 2025, 07:08'
	function formatDate(dateString: string) {
		return new Date(dateString)
			.toLocaleDateString('pt-BR', {
				day: 'numeric', // dia sem zero à esquerda
				month: 'short', // mês abreviado (fev)
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
				timeZone: 'America/Sao_Paulo'
			})
			.replace(/\bde\b/g, '') // Remove todos os "de" (9 de fev. de 2025 → 9 fev. 2025)
			.replace(/(\w{3})$/, '$1.') // Adiciona o ponto no mês (fev.)
	}
</script>

<div class="flex min-h-[calc(100vh-64px)] w-full flex-col bg-white dark:bg-zinc-900">
	<div class="flex flex-col">
		<!-- Tabs buttons -->
		<div class="h-14 border-b border-zinc-200">
			<div class="flex h-full gap-x-4 px-8" aria-label="Tabs" role="tablist" aria-orientation="horizontal">
				<!-- Tab 1 button -->
				<button
					type="button"
					class="hs-tab-active:border-zinc-600 hs-tab-active:text-zinc-800 active inline-flex items-center gap-x-2 border-b-2 border-transparent px-2 text-base font-medium whitespace-nowrap text-zinc-400 hover:text-zinc-600 focus:text-zinc-600 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50"
					id="tab-1"
					aria-selected="true"
					data-hs-tab="#tab-content-1"
					aria-controls="tab-content-1"
					role="tab"
				>
					Base de conhecimento
				</button>
				<!-- Tab 2 button -->
				<button
					type="button"
					class="hs-tab-active:border-zinc-600 hs-tab-active:text-zinc-800 inline-flex items-center gap-x-2 border-b-2 border-transparent px-2 text-base font-semibold whitespace-nowrap text-zinc-400 hover:text-zinc-600 focus:text-zinc-600 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50"
					id="tab-2"
					aria-selected="false"
					data-hs-tab="#tab-content-2"
					aria-controls="tab-content-2"
					role="tab"
				>
					Problemas & soluções <span class="hs-tab-active:bg-zinc-800 hs-tab-active:text-white ms-1 rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600"
						>17</span
					>
				</button>
			</div>
		</div>
		<!-- Tabs body -->
		<div class="flex">
			<!-- Tab 1 content -->
			<div id="tab-content-1" class="w-full" role="tabpanel" aria-labelledby="tab-1">
				{@render tab1()}
			</div>
			<!-- Tab 2 content -->
			<div id="tab-content-2" class="hidden w-full" role="tabpanel" aria-labelledby="tab-2">
				{@render tab2()}
			</div>
		</div>
	</div>
</div>

{#snippet tab1()}
	<div class="flex">
		<!-- Side left -->
		<div class="flex w-[320px] flex-shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-700">
			<div
				class="size-full h-[calc(100vh-120px)] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-500 [&::-webkit-scrollbar-track]:bg-zinc-50 dark:[&::-webkit-scrollbar-track]:bg-zinc-700"
			>
				<!-- Tree -->
				<div class="hs-accordion-treeview-root px-8 pt-8" role="tree" aria-orientation="vertical">
					{#each docs as category}
						<div class="pb-8">
							<h3 class="pb-4 text-xl font-medium">{category.label}</h3>
							{#if category.children}
								{#each category.children as child}
									<!-- Tree item -->
									{@render tree({ item: child })}
								{/each}
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- Side right -->
		<div class="flex w-full flex-grow flex-col">
			<div
				class="size-full h-[calc(100vh-120px)] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-500 [&::-webkit-scrollbar-track]:bg-zinc-50 dark:[&::-webkit-scrollbar-track]:bg-zinc-700"
			>
				<!-- Cabeçalho -->
				<div class="flex flex-col gap-2 border-b border-zinc-200 p-8 md:grid md:grid-cols-2">
					<div class="flex">
						<div class="flex w-8 items-center justify-center">
							<span class="icon-[lucide--book-text] size-4"></span>
						</div>
						<div class="flex">
							<span>3 seções & 9 capítulos</span>
						</div>
					</div>
					<div class="flex">
						<div class="flex w-8 items-center justify-center">
							<span class="icon-[lucide--users-round] size-4"></span>
						</div>
						<div class="flex">
							<span>Técnicos responsáveis: 3</span>
						</div>
					</div>
					<div class="flex">
						<div class="flex w-8 items-center justify-center">
							<span class="icon-[lucide--triangle-alert] size-4"></span>
						</div>
						<div class="flex">
							<span>Problemas reportados: 5</span>
						</div>
					</div>
					<div class="flex">
						<div class="flex w-8 items-center justify-center">
							<span class="icon-[lucide--book-check] size-4"></span>
						</div>
						<div class="flex">
							<span>Soluções encontradas: 4</span>
						</div>
					</div>
					<div class="flex">
						<div class="flex w-8 items-center justify-center">
							<span class="icon-[lucide--clock-4] size-4"></span>
						</div>
						<div class="flex">
							<span>Atualizado há 69 dias</span>
						</div>
					</div>
				</div>
				<!-- Responsáveis técnicos -->
				<div class="border-b border-zinc-200 p-8">
					<div class="flex w-full items-center justify-between pb-6">
						<div>
							<h3 class="text-xl font-medium">Contatos em caso de problemas</h3>
							<div>
								<span class="text-sm font-medium">3 responsáveis técnicos</span>
							</div>
						</div>
						<button
							class="inline-flex items-center justify-center rounded-lg border border-transparent bg-white px-4 py-3 text-sm transition-all duration-300 hover:border-zinc-200 hover:bg-zinc-100"
						>
							<span class="icon-[lucide--plus] mr-1 size-4 text-zinc-800"></span>
							Adicionar contato
						</button>
					</div>
					<div class="flex flex-col gap-4 md:grid md:grid-cols-2">
						{#each contacts as { image, name, role, team, email }}
							<!-- Item -->
							<div class="flex gap-x-2">
								<div class="size-12 shrink-0">
									<img src={image} alt={name} class="size-full rounded-full" />
								</div>
								<div class="flex flex-col">
									<div class="text-base font-bold">{name}</div>
									<div class="text-sm font-medium">{role} <span class="text-zinc-300">•</span> {team}</div>
									<div class="text-sm font-medium"><a href={`mailto:${email}`} class="text-zinc-400 hover:text-zinc-500">{email}</a></div>
								</div>
							</div>
						{/each}
					</div>
				</div>
				<!-- Manual do produto -->
				<div class="p-8">
					<div class="flex w-full items-center justify-between pb-6">
						<div>
							<h3 class="text-xl font-medium">Manual do produto</h3>
							<div>
								<span class="text-sm font-medium">3 seções <span class="text-zinc-300">•</span> 9 capítulos</span>
							</div>
						</div>
						<button
							class="inline-flex items-center justify-center rounded-lg border border-transparent bg-white px-4 py-3 text-sm transition-all duration-300 hover:border-zinc-200 hover:bg-zinc-100"
						>
							<span class="icon-[lucide--plus] mr-1 size-4 text-zinc-800"></span>
							Adicionar seção
						</button>
					</div>
					<div class="flex flex-col">
						<!-- Manual -->
						{@render accordion(manual)}
					</div>
				</div>
			</div>
		</div>
	</div>
{/snippet}

{#snippet tab2()}
	<div class="flex">
		<!-- Side left -->
		<div class="flex w-full flex-shrink-0 flex-col border-r border-zinc-200 sm:w-[480px] dark:border-zinc-700">
			<div
				class="size-full h-[calc(100vh-120px)] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-500 [&::-webkit-scrollbar-track]:bg-zinc-50 dark:[&::-webkit-scrollbar-track]:bg-zinc-700"
			>
				<!-- Procurar problemas -->
				<div class="border-b border-zinc-200 p-8">
					<div class="relative">
						<input
							type="text"
							name="problem"
							class="block w-full rounded-lg border-zinc-200 px-4 py-2.5 pe-11 focus:z-10 focus:border-blue-500 focus:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 sm:py-3 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:placeholder-zinc-500 dark:focus:ring-zinc-600"
							placeholder="Procurar problema..."
						/>
						<div class="pointer-events-none absolute inset-y-0 end-0 z-20 flex items-center pe-4">
							<span class="icon-[lucide--search] ml-1 size-4 shrink-0 text-zinc-400 dark:text-zinc-500"></span>
						</div>
					</div>
				</div>
				{#if problems.length > 0}
					<!-- Lista de problemas -->
					{@render listProblems(problems)}
				{:else}
					<!-- Nenhum resultado encontrado -->
					<div class="border-b border-zinc-200 p-8">
						<div class="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800 dark:border-zinc-600 dark:bg-yellow-800/10 dark:text-zinc-500" role="alert">
							<div class="flex flex-col">
								<div class="flex justify-center pb-1">
									<span class="icon-[lucide--search-x] size-12 shrink-0 text-zinc-300 dark:text-zinc-500"></span>
								</div>
								<div class="flex flex-col">
									<h3 class="text-center text-base font-semibold text-zinc-600">Nenhum resultado</h3>
									<div class="text-center text-sm text-zinc-700">Não encontramos nenhum resultado com o texto informado.</div>
								</div>
							</div>
						</div>
					</div>
				{/if}
				<!-- Adcionar problema -->
				<div class="p-8">
					<div class="flex justify-center">
						<button
							type="button"
							class="inline-flex items-center justify-center gap-x-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800 shadow-2xs hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700 dark:focus:bg-zinc-700"
						>
							<span class="icon-[lucide--plus] mr-1 size-4 text-zinc-800"></span>
							Adicionar problema
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Side right -->
		<div class="flex w-full flex-grow flex-col">
			<div
				class="size-full h-[calc(100vh-120px)] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-500 [&::-webkit-scrollbar-track]:bg-zinc-50 dark:[&::-webkit-scrollbar-track]:bg-zinc-700"
			>
				<!-- Descrição do problema -->
				<div class="flex w-full flex-col border-b border-zinc-200 p-8">
					<!-- Title -->
					<div class="flex w-full items-center justify-between pb-6">
						<div>
							<h3 class="text-xl font-medium">{problem.title}</h3>
							<div class="text-base">
								<span class="text-sm font-medium">{problem.solutions.length} soluções</span> <span class="text-zinc-300">•</span>
								<span class="text-sm text-zinc-400">Registrado em {formatDate(problem.date)}</span>
							</div>
						</div>
						<button
							class="inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-white px-4 py-3 text-sm transition-all duration-300 hover:border-zinc-200 hover:bg-zinc-100"
						>
							<span class="icon-[lucide--edit] mr-1 size-4 text-zinc-800"></span>
							Editar problema
						</button>
					</div>
					<!-- Description -->
					<div class="flex flex-col gap-y-2 text-zinc-800">
						{@html problem.description}
					</div>
					<!-- Screenshots -->
					<div class="flex gap-6 pt-6">
						{#each problem.screenshots as { id, src, alt }, index (id)}
							<div>
								<img class="h-32 w-auto rounded-lg" {src} {alt} />
							</div>
						{/each}
					</div>
				</div>
				<!-- Soluções -->
				<div class="flex w-full flex-col border-b border-zinc-200 p-8">
					<div class="flex w-full items-center justify-between pb-6">
						<div>
							<h3 class="text-xl font-medium">Soluções</h3>
							<div>
								<span class="text-sm font-medium">
									{#if problem.solutions.length > 0}
										{problem.solutions.length} soluções para o problema
										<span class="text-zinc-300">•</span>
										{problem.solutions.reduce((total, solution) => (solution.verified ? total + 1 : total), 0)} foram verificadas
									{:else}
										Sem soluções cadastradas
									{/if}
								</span>
							</div>
						</div>
						<button
							class="inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-white px-4 py-3 text-sm transition-all duration-300 hover:border-zinc-200 hover:bg-zinc-100"
						>
							<span class="icon-[lucide--plus] mr-1 size-4 text-zinc-800"></span>
							Adicionar solução
						</button>
					</div>
					<!-- Lista de soluções -->
					{#if problem.solutions.length > 0}
						<div class="flex flex-col">
							<!-- Lista de soluções (soluções pai) que não são uma resposta (replyId é null) -->
							{#each problem.solutions.filter((solution) => solution.replyId === null) as { id, replyId, date, user, description, verified }, index (id)}
								<!-- Solução -->
								<div class="flex gap-x-2">
									<div class="size-12 shrink-0">
										<img src={user.avatar} alt={user.name} class="size-full rounded-full" />
									</div>
									<div class="flex flex-col">
										<div class="flex flex-col gap-y-1">
											<div class="text-base">
												<span class="font-bold text-zinc-700">{user.name}</span>
												<span class="text-zinc-300">•</span>
												<span class="text-sm text-zinc-400">{formatDate(date)}</span>
												{#if verified}
													<span
														class="ml-2 inline-flex items-center gap-x-1 rounded-lg bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-500/10 dark:text-green-500"
													>
														<span class="icon-[lucide--check] size-3 shrink-0"></span>
														Resposta verificada
													</span>
												{/if}
											</div>
											<div class="text-sm font-medium text-zinc-600">
												{description}
											</div>
										</div>
										<!-- Responder -->
										<div class="py-2">
											<button
												type="button"
												class="inline-flex items-center gap-x-2 rounded-lg border border-transparent px-4 py-3 text-sm font-medium text-blue-600 hover:bg-blue-100 hover:text-blue-800 focus:bg-blue-100 focus:text-blue-800 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50 dark:text-blue-500 dark:hover:bg-blue-800/30 dark:hover:text-blue-400 dark:focus:bg-blue-800/30 dark:focus:text-blue-400"
											>
												Responder
											</button>
										</div>
										<!-- Lista de soluções (solução filho, replyId é igual ao id do pai) que são uma resposta da solução pai -->
										{#each problem.solutions.filter((solution) => solution.replyId === id) as reply (reply.id)}
											<div>
												<!-- Resposta -->
												<div class="flex gap-x-2">
													<div class="size-12 shrink-0">
														<img src={reply.user.avatar} alt={reply.user.name} class="size-full rounded-full" />
													</div>
													<div class="flex flex-col">
														<div class="flex flex-col gap-y-1">
															<div class="text-base">
																<span class="font-bold text-zinc-700">{reply.user.name}</span>
																<span class="text-zinc-300">•</span>
																<span class="text-sm text-zinc-400">{formatDate(reply.date)}</span>
																{#if reply.verified}
																	<span
																		class="ml-2 inline-flex items-center gap-x-1 rounded-lg bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-500/10 dark:text-green-500"
																	>
																		<span class="icon-[lucide--check] size-3 shrink-0"></span>
																		Resposta verificada
																	</span>
																{/if}
															</div>
															<div class="text-sm font-medium text-zinc-600">{reply.description}</div>
														</div>
														<!-- Responder -->
														<div class="py-2">
															<button
																type="button"
																class="inline-flex items-center gap-x-2 rounded-lg border border-transparent px-4 py-3 text-sm font-medium text-blue-600 hover:bg-blue-100 hover:text-blue-800 focus:bg-blue-100 focus:text-blue-800 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50 dark:text-blue-500 dark:hover:bg-blue-800/30 dark:hover:text-blue-400 dark:focus:bg-blue-800/30 dark:focus:text-blue-400"
															>
																Responder
															</button>
														</div>
													</div>
												</div>
											</div>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<!-- Nenhum resultado encontrado -->
						<div class="border-b border-zinc-200">
							<div class="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800 dark:border-zinc-600 dark:bg-yellow-800/10 dark:text-zinc-500" role="alert">
								<div class="flex items-center gap-x-4">
									<div class="flex justify-center pb-1">
										<span class="icon-[lucide--circle-x] size-12 shrink-0 text-zinc-300 dark:text-zinc-500"></span>
									</div>
									<div class="flex flex-col">
										<h3 class="text-base font-semibold text-zinc-600">Nenhuma solução encontrada</h3>
										<div class="text-sm text-zinc-700">
											Nenhum usuário cadastrou uma solução para este problema. Ainda não tem soluções. Seja o primeiro a cadastrar uma solução.
										</div>
									</div>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/snippet}

{#snippet tree({ item }: any)}
	<div class="hs-accordion-group">
		{#if item.children}
			<div
				class="hs-accordion {item.children && item.children.some((child: any) => child.children) ? 'active' : ''}"
				role="treeitem"
				aria-selected={item.children && item.children.some((child: any) => child.children) ? 'true' : 'false'}
				aria-expanded="false"
			>
				<div class="hs-accordion-heading flex w-full items-center gap-x-1 py-1">
					<button class="hs-accordion-toggle group w-full" aria-expanded="false">
						<div class="flex w-full">
							<div class="flex size-6 items-center justify-center rounded-md group-hover:bg-zinc-100">
								<span class="icon-[lucide--minus] hs-accordion-active:block hidden size-4 text-zinc-800"></span>
								<span class="icon-[lucide--plus] hs-accordion-active:hidden block size-4 text-zinc-800"></span>
							</div>
							<div class="flex w-full justify-between">
								<div class="flex grow items-center gap-x-2 overflow-hidden rounded-md px-2">
									{#if item.icon}
										<span class="{item.icon} block size-4 text-zinc-500"></span>
									{/if}
									<span class="{item.children && item.children.some((child: any) => !child.children) ? 'max-w-40' : ''} truncate text-start text-base font-medium text-zinc-800"
										>{item.label}</span
									>
								</div>
								{#if item.children && item.children.some((child: any) => !child.children)}
									<div>
										<span class="inline-flex items-center gap-x-1 rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-400 dark:bg-white/10 dark:text-white"
											>{item.children.length}</span
										>
									</div>
								{/if}
							</div>
						</div>
					</button>
				</div>
				<div
					class="hs-accordion-content {item.children && item.children.some((child: any) => child.children) ? '' : 'hidden'} w-full overflow-hidden transition-[height] duration-300"
				>
					<div class="relative ms-3 ps-3 before:absolute before:start-0 before:top-0 before:-ms-px before:h-full before:w-0.5 before:bg-zinc-100">
						{#each item.children as subitem}
							{@render tree({ item: subitem })}
						{/each}
					</div>
				</div>
			</div>
		{:else}
			<a href={item.url} class="hs-accordion-selectable hs-accordion-selected:bg-zinc-200 my-0.5 flex cursor-pointer items-center gap-x-2 rounded-md px-2 py-1 hover:bg-zinc-100">
				{#if item.icon}
					<span class="{item.icon} block size-4 text-zinc-500"></span>
				{/if}
				<span class="text-sm text-zinc-800">{item.label}</span>
			</a>
		{/if}
	</div>
{/snippet}

{#snippet accordion({ sections }: any)}
	<div class="hs-accordion-group" data-hs-accordion-always-open>
		{#each sections as { id, title, description, chapters }, index (id)}
			<div class="hs-accordion {index === 0 ? 'active' : ''}">
				<button
					class="hs-accordion-toggle hs-accordion-active:text-blue-600 inline-flex w-full items-center gap-x-3 rounded-lg py-3 text-start font-semibold text-zinc-800 hover:text-zinc-500 focus:text-zinc-500 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50"
					aria-expanded="true"
				>
					<span class="icon-[lucide--chevron-up] hs-accordion-active:block hidden size-5 text-zinc-800"></span>
					<span class="icon-[lucide--chevron-down] hs-accordion-active:hidden block size-5 text-zinc-800"></span>
					{title}
				</button>
				<div class="hs-accordion-content {index !== 0 ? 'hidden' : ''} w-full overflow-hidden transition-[height] duration-300" role="region">
					{#if description}
						<p class="pt-1 pb-3 text-zinc-800">{description}</p>
					{/if}
					{#if chapters.length > 0}
						<div class="hs-accordion-group ps-6">
							{#each chapters as { id, title, description }, index (id)}
								<div class="hs-accordion {index === 0 ? 'active' : ''}">
									<button
										class="hs-accordion-toggle hs-accordion-active:text-blue-600 inline-flex w-full items-center gap-x-3 rounded-lg py-3 text-start font-semibold text-zinc-800 hover:text-zinc-500 focus:text-zinc-500 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50"
										aria-expanded="true"
									>
										<span class="icon-[lucide--chevron-up] hs-accordion-active:block hidden size-5 text-zinc-800"></span>
										<span class="icon-[lucide--chevron-down] hs-accordion-active:hidden block size-5 text-zinc-800"></span>
										<span class="icon-[lucide--book-text] size-4 text-zinc-800"></span>
										{title}
									</button>
									<div class="hs-accordion-content {index !== 0 ? 'hidden' : ''} w-full overflow-hidden transition-[height] duration-300" role="region">
										<p class="text-zinc-800">{description}</p>
										<div class="py-2">
											<button
												class="inline-flex items-center justify-center rounded-lg border border-transparent bg-white px-4 py-3 text-sm transition-all duration-300 hover:border-zinc-200 hover:bg-zinc-100"
											>
												<span class="icon-[lucide--plus] mr-1 size-4 text-zinc-800"></span>
												Adicionar capítulo
											</button>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<button
							class="inline-flex items-center justify-center rounded-lg border border-transparent bg-white px-3 py-2 text-sm transition-all duration-300 hover:border-zinc-200 hover:bg-zinc-100"
						>
							<span class="icon-[lucide--plus] mr-1 size-4 text-zinc-800"></span>
							Adicionar capítulo
						</button>
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/snippet}

{#snippet listProblems(problems: Problems[])}
	<!-- Lista de problemas -->
	<div class="flex flex-col">
		{#if problems.length > 0}
			{#each problems as { id, title, date, description, solutions } (id)}
				<!-- Problema -->
				<div class="flex flex-col border-b border-zinc-200">
					<div class="flex w-full flex-col gap-y-1 p-8 hover:bg-zinc-100">
						<div class="flex w-full items-center justify-between gap-x-2">
							<span class="text-base font-semibold text-zinc-700">{title}</span>
							<span class="ms-1 shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600">{solutions}</span>
						</div>
						<div class="flex text-sm text-zinc-600">
							<p>{description}</p>
						</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>
{/snippet}
