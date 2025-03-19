<script lang="ts">
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

<div class="flex min-h-[calc(100vh-64px)] w-full flex-col bg-white dark:bg-neutral-900">
	<div class="flex flex-col">
		<!-- Tabs buttons -->
		<div class="h-14 border-b border-neutral-200">
			<div class="flex h-full gap-x-4 px-8" aria-label="Tabs" role="tablist" aria-orientation="horizontal">
				<!-- Tab 1 button -->
				<button
					type="button"
					class="hs-tab-active:border-neutral-600 hs-tab-active:text-neutral-800 active inline-flex items-center gap-x-2 border-b-2 border-transparent px-2 text-base font-medium whitespace-nowrap text-neutral-400 hover:text-neutral-600 focus:text-neutral-600 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50"
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
					class="hs-tab-active:border-neutral-600 hs-tab-active:text-neutral-800 inline-flex items-center gap-x-2 border-b-2 border-transparent px-2 text-base font-semibold whitespace-nowrap text-neutral-400 hover:text-neutral-600 focus:text-neutral-600 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50"
					id="tab-2"
					aria-selected="false"
					data-hs-tab="#tab-content-2"
					aria-controls="tab-content-2"
					role="tab"
				>
					Problemas & soluções <span
						class="hs-tab-active:bg-neutral-800 hs-tab-active:text-white ms-1 rounded-full bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-600">99+</span
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
		<div class="flex w-[320px] flex-shrink-0 flex-col border-r border-neutral-200 dark:border-neutral-700">
			<div
				class="size-full h-[calc(100vh-120px)] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-300 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500 [&::-webkit-scrollbar-track]:bg-neutral-50 dark:[&::-webkit-scrollbar-track]:bg-neutral-700"
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
				class="size-full h-[calc(100vh-120px)] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-300 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500 [&::-webkit-scrollbar-track]:bg-neutral-50 dark:[&::-webkit-scrollbar-track]:bg-neutral-700"
			>
				<!-- Cabeçalho -->
				<div class="flex flex-col gap-2 border-b border-neutral-200 p-8 md:grid md:grid-cols-2">
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
				<div class="border-b border-neutral-200 p-8">
					<div class="flex w-full items-center justify-between pb-6">
						<div>
							<h3 class="text-xl font-medium">Contatos em caso de problemas</h3>
							<div>
								<span class="text-sm font-medium">3 contatos</span>
							</div>
						</div>
						<button
							class="inline-flex items-center justify-center rounded-lg border border-transparent bg-white px-3 py-2 text-sm transition-all duration-300 hover:border-neutral-200 hover:bg-neutral-100"
						>
							<span class="icon-[lucide--plus] mr-1 size-4 text-neutral-800"></span>
							Adicionar contato
						</button>
					</div>
					<div class="flex flex-col gap-4 md:grid md:grid-cols-2">
						{#each contacts as { image, name, role, team, email }}
							<!-- Item -->
							<div class="flex gap-x-2">
								<div class="size-12">
									<img src={image} alt={name} class="size-full rounded-full" />
								</div>
								<div class="flex flex-col">
									<div class="text-base font-bold">{name}</div>
									<div class="text-sm font-medium">{role} <span class="text-neutral-300">•</span> {team}</div>
									<div class="text-sm font-medium"><a href={`mailto:${email}`} class="text-neutral-400 hover:text-neutral-500">{email}</a></div>
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
								<span class="text-sm font-medium">3 seções <span class="text-neutral-300">•</span> 9 capítulos</span>
							</div>
						</div>
						<button
							class="inline-flex items-center justify-center rounded-lg border border-transparent bg-white px-3 py-2 text-sm transition-all duration-300 hover:border-neutral-200 hover:bg-neutral-100"
						>
							<span class="icon-[lucide--plus] mr-1 size-4 text-neutral-800"></span>
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
	<p class="text-neutral-500">
		This is the <em class="font-semibold text-neutral-800">second</em> item's tab body.
	</p>
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
							<div class="flex size-6 items-center justify-center rounded-md group-hover:bg-neutral-100">
								<span class="icon-[lucide--minus] hs-accordion-active:block hidden size-4 text-neutral-800"></span>
								<span class="icon-[lucide--plus] hs-accordion-active:hidden block size-4 text-neutral-800"></span>
							</div>
							<div class="flex w-full justify-between">
								<div class="flex grow items-center gap-x-2 overflow-hidden rounded-md px-2">
									{#if item.icon}
										<span class="{item.icon} block size-4 text-neutral-500"></span>
									{/if}
									<span class="{item.children && item.children.some((child: any) => !child.children) ? 'max-w-40' : ''} truncate text-start text-base font-medium text-neutral-800"
										>{item.label}</span
									>
								</div>
								{#if item.children && item.children.some((child: any) => !child.children)}
									<div>
										<span class="inline-flex items-center gap-x-1 rounded-full bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-400 dark:bg-white/10 dark:text-white"
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
					<div class="relative ms-3 ps-3 before:absolute before:start-0 before:top-0 before:-ms-px before:h-full before:w-0.5 before:bg-neutral-100">
						{#each item.children as subitem}
							{@render tree({ item: subitem })}
						{/each}
					</div>
				</div>
			</div>
		{:else}
			<a
				href={item.url}
				class="hs-accordion-selectable hs-accordion-selected:bg-neutral-200 my-0.5 flex cursor-pointer items-center gap-x-2 rounded-md px-2 py-1 hover:bg-neutral-100"
			>
				{#if item.icon}
					<span class="{item.icon} block size-4 text-neutral-500"></span>
				{/if}
				<span class="text-sm text-neutral-800">{item.label}</span>
			</a>
		{/if}
	</div>
{/snippet}

{#snippet accordion({ sections }: any)}
	<div class="hs-accordion-group" data-hs-accordion-always-open>
		{#each sections as { id, title, description, chapters }, index (id)}
			<div class="hs-accordion {index === 0 ? 'active' : ''}">
				<button
					class="hs-accordion-toggle hs-accordion-active:text-blue-600 inline-flex w-full items-center gap-x-3 rounded-lg py-3 text-start font-semibold text-gray-800 hover:text-gray-500 focus:text-gray-500 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50"
					aria-expanded="true"
				>
					<span class="icon-[lucide--chevron-up] hs-accordion-active:block hidden size-5 text-neutral-800"></span>
					<span class="icon-[lucide--chevron-down] hs-accordion-active:hidden block size-5 text-neutral-800"></span>
					{title}
				</button>
				<div class="hs-accordion-content {index !== 0 ? 'hidden' : ''} w-full overflow-hidden transition-[height] duration-300" role="region">
					{#if description}
						<p class="pt-1 pb-3 text-gray-800">{description}</p>
					{/if}
					{#if chapters.length > 0}
						<div class="hs-accordion-group ps-6">
							{#each chapters as { id, title, description }, index (id)}
								<div class="hs-accordion {index === 0 ? 'active' : ''}">
									<button
										class="hs-accordion-toggle hs-accordion-active:text-blue-600 inline-flex w-full items-center gap-x-3 rounded-lg py-3 text-start font-semibold text-gray-800 hover:text-gray-500 focus:text-gray-500 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50"
										aria-expanded="true"
									>
										<span class="icon-[lucide--chevron-up] hs-accordion-active:block hidden size-5 text-neutral-800"></span>
										<span class="icon-[lucide--chevron-down] hs-accordion-active:hidden block size-5 text-neutral-800"></span>
										<span class="icon-[lucide--book-text] size-4 text-neutral-800"></span>
										{title}
									</button>
									<div class="hs-accordion-content {index !== 0 ? 'hidden' : ''} w-full overflow-hidden transition-[height] duration-300" role="region">
										<p class="text-gray-800">{description}</p>
										<div class="py-2">
											<button
												class="inline-flex items-center justify-center rounded-lg border border-transparent bg-white px-3 py-2 text-sm transition-all duration-300 hover:border-neutral-200 hover:bg-neutral-100"
											>
												<span class="icon-[lucide--plus] mr-1 size-4 text-neutral-800"></span>
												Adicionar capítulo
											</button>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<button
							class="inline-flex items-center justify-center rounded-lg border border-transparent bg-white px-3 py-2 text-sm transition-all duration-300 hover:border-neutral-200 hover:bg-neutral-100"
						>
							<span class="icon-[lucide--plus] mr-1 size-4 text-neutral-800"></span>
							Adicionar capítulo
						</button>
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/snippet}
