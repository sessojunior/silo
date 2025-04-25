<script lang="ts">
	import { getContext } from 'svelte'

	// Pega os dados da página por meio do context
	const contextPage = getContext<{ title: string }>('contextPage')

	// Atualiza o título da página dinamicamente
	contextPage.title = 'BRAMS ams 15 km'

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
</script>

<div class="flex">
	<!-- Side left -->
	<div class="flex w-[320px] flex-shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-700">
		<div class="scrollbar size-full h-[calc(100vh-131px)] overflow-y-auto">
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
		<div class="scrollbar size-full h-[calc(100vh-131px)] overflow-y-auto">
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
