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
							icon: 'icon-[lucide--computer]',
							label: 'Rede interna 1',
							url: '#',
							children: null
						},
						{
							icon: 'icon-[lucide--computer]',
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
							icon: 'icon-[lucide--computer]',
							label: 'Rede externa 1',
							url: '#',
							children: null
						},
						{
							icon: 'icon-[lucide--computer]',
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
									icon: 'icon-[lucide--computer]',
									label: 'Software 1',
									url: '#',
									children: null
								},
								{
									icon: 'icon-[lucide--computer]',
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
									icon: 'icon-[lucide--computer]',
									label: 'Pesquisador 1',
									url: '#',
									children: null
								},
								{
									icon: 'icon-[lucide--computer]',
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
									icon: 'icon-[lucide--computer]',
									label: 'Técnico 1',
									url: '#',
									children: null
								},
								{
									icon: 'icon-[lucide--computer]',
									label: 'Técnico 2',
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
			<div id="tab-content-1" role="tabpanel" aria-labelledby="tab-1">
				{@render tab1()}
			</div>
			<!-- Tab 2 content -->
			<div id="tab-content-2" class="hidden" role="tabpanel" aria-labelledby="tab-2">
				{@render tab2()}
			</div>
		</div>
	</div>
</div>

{#snippet tab1()}
	<div class="flex w-full">
		<!-- Side left -->
		<div class="flex w-[320px] flex-shrink-0 flex-col border-r border-neutral-200 dark:border-neutral-700">
			<div
				class="size-full h-[calc(100vh-120px)] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-300 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500 [&::-webkit-scrollbar-track]:bg-neutral-50 dark:[&::-webkit-scrollbar-track]:bg-neutral-700"
			>
				<!-- Tree -->
				<div class="hs-accordion-treeview-root p-8" role="tree" aria-orientation="vertical">
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
		<div class="flex flex-grow flex-col">
			<div class="p-8">
				<h1>Detalhes do produto</h1>
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
