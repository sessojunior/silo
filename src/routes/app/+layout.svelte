<script lang="ts">
	let { children } = $props()

	const user = {
		avatar: 'https://avatars.githubusercontent.com/u/141470722?v=4',
		name: 'Mario Junior',
		email: 'mario.sesso@inpe.br'
	}

	const logo = {
		image: '/images/logo.png',
		title: 'Silo'
	}

	const sidebar = {
		logo: logo,
		menu: [
			{
				id: '1',
				title: 'Menu principal',
				items: [
					{
						id: '1.1',
						title: 'Visão geral',
						icon: 'icon-[lucide--house]',
						url: '#',
						items: null
					},
					{
						id: '1.2',
						title: 'Produtos & tasks',
						icon: 'icon-[lucide--folder-git-2]',
						url: '#',
						items: [
							{
								id: '1.2.1',
								title: 'BAM',
								icon: null,
								url: null,
								items: [
									{
										id: '1.2.1.1',
										title: 'Link 1',
										icon: null,
										url: '#',
										items: null
									},
									{
										id: '1.2.1.2',
										title: 'Link 2',
										icon: null,
										url: '#',
										items: null
									},
									{
										id: '1.2.1.3',
										title: 'Link 3',
										icon: null,
										url: '#',
										items: null
									}
								]
							},
							{
								id: '1.2.2',
								title: 'SMEC',
								icon: null,
								url: null,
								items: [
									{
										id: '1.2.2.1',
										title: 'Link 1',
										icon: null,
										url: '#',
										items: null
									},
									{
										id: '1.2.2.2',
										title: 'Link 2',
										icon: null,
										url: '#',
										items: null
									},
									{
										id: '1.2.2.3',
										title: 'Link 3',
										icon: null,
										url: '#',
										items: null
									}
								]
							},
							{
								id: '1.2.3',
								title: 'BRAMS ams 15 km',
								icon: null,
								url: '#',
								items: null
							},
							{
								id: '1.2.4',
								title: 'WRF',
								icon: null,
								url: '#',
								items: null
							}
						]
					},
					{
						id: '1.3',
						title: 'Projetos',
						icon: 'icon-[lucide--square-chart-gantt]',
						url: '#',
						items: null
					},
					{
						id: '1.4',
						title: 'Grupos',
						icon: 'icon-[lucide--users-round]',
						url: '#',
						items: null
					}
				]
			},
			{
				id: '2',
				title: 'Outros',
				items: [
					{
						id: '2.1',
						title: 'Agenda',
						icon: 'icon-[lucide--calendar-clock]',
						url: '#',
						items: null
					},
					{
						id: '2.2',
						title: 'Bate-papo',
						icon: 'icon-[lucide--messages-square]',
						url: '#',
						items: null
					},
					{
						id: '2.3',
						title: 'Configurações',
						icon: 'icon-[lucide--settings-2]',
						url: '#',
						items: [
							{
								id: '2.3.1',
								title: 'Alterar perfil',
								icon: null,
								url: '#',
								items: null
							},
							{
								id: '2.3.2',
								title: 'Preferências',
								icon: null,
								url: '#',
								items: null
							},
							{
								id: '2.3.3',
								title: 'Segurança',
								icon: null,
								url: '#',
								items: null
							}
						]
					},
					{
						id: '2.4',
						title: 'Ajuda',
						icon: 'icon-[lucide--life-buoy]',
						url: '#',
						items: null
					}
				]
			}
		],
		blocks: [
			{
				id: '1',
				title: 'O que há de novo?',
				description: 'Você pode conferir todas as novidades dessa nova versão do dashboard no aplicativo Silo.'
			}
		],
		user: user
	}

	const profile = {
		avatar: user.avatar,
		name: user.name,
		email: user.email,
		links: [
			{
				id: '1',
				icon: 'icon-[lucide--user-round-pen]',
				title: 'Alterar perfil',
				url: '#'
			},
			{
				id: '2',
				icon: 'icon-[lucide--settings-2]',
				title: 'Preferências',
				url: '#'
			},
			{
				id: '3',
				icon: 'icon-[lucide--shield-check]',
				title: 'Segurança',
				url: '#'
			},
			{
				id: '4',
				icon: 'icon-[lucide--log-out]',
				title: 'Sair',
				url: '#'
			}
		]
	}
</script>

<div>
	<!-- Header -->
	<header
		class="sticky inset-x-0 top-0 z-[48] flex h-16 w-full flex-shrink-0 flex-wrap border-b border-b-neutral-200 bg-neutral-50 py-2.5 md:flex-nowrap md:justify-start lg:ps-[260px] dark:border-neutral-700 dark:bg-neutral-800"
	>
		<nav class="flex w-full items-center px-4">
			<div class="flex w-full items-center justify-between gap-x-2">
				<!-- Navigation Toggle -->
				<div class="lg:hidden">
					<button
						type="button"
						class="relative inline-flex size-[38px] items-center justify-center gap-x-2 rounded-full border border-transparent text-neutral-800 hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-none disabled:pointer-events-none disabled:opacity-50 dark:text-white dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
						aria-haspopup="dialog"
						aria-expanded="false"
						aria-controls="hs-application-sidebar"
						aria-label="Toggle navigation"
						data-hs-overlay="#hs-application-sidebar"
					>
						<span class="sr-only">Exibir menu lateral</span>
						<span class="icon-[lucide--menu] size-5 shrink-0"></span>
					</button>
				</div>
				<!-- Title -->
				<div class="hidden items-center gap-x-2 sm:flex">
					<h2 class="px-4 text-2xl font-medium text-neutral-800 dark:text-neutral-100">Visão geral</h2>
				</div>
				<!-- Buttons & dropdown -->
				<div class="flex flex-row items-center justify-end gap-1">
					<!-- Button-->
					<button
						type="button"
						class="relative inline-flex size-[38px] items-center justify-center gap-x-2 rounded-full border border-transparent text-sm font-semibold text-neutral-800 hover:bg-neutral-200 focus:bg-neutral-100 focus:outline-none disabled:pointer-events-none disabled:opacity-50 dark:text-white dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
					>
						<span class="icon-[lucide--circle-help] size-4 shrink-0"></span>
						<span class="sr-only">Ajuda</span>
					</button>
					<!-- Button-->
					<button
						type="button"
						class="relative inline-flex size-[38px] items-center justify-center gap-x-2 rounded-full border border-transparent text-sm font-semibold text-neutral-800 hover:bg-neutral-200 focus:bg-neutral-100 focus:outline-none disabled:pointer-events-none disabled:opacity-50 dark:text-white dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
					>
						<span class="icon-[lucide--activity] size-4 shrink-0"></span>
						<span class="sr-only">Atividades</span>
					</button>
					<!-- Button-->
					<button
						type="button"
						class="relative inline-flex size-[38px] items-center justify-center gap-x-2 rounded-full border border-transparent text-sm font-semibold text-neutral-800 hover:bg-neutral-200 focus:bg-neutral-100 focus:outline-none disabled:pointer-events-none disabled:opacity-50 dark:text-white dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
					>
						<span class="icon-[lucide--settings] size-4 shrink-0"></span>
						<span class="sr-only">Configurações</span>
					</button>
					<!-- Divider -->
					<div class="mx-1 h-8 w-0.5 bg-neutral-100 dark:bg-neutral-800"></div>
					<!-- Button-->
					<div class="relative inline-block">
						<button
							type="button"
							class="relative inline-flex size-[38px] items-center justify-center gap-x-2 rounded-full border border-transparent text-sm font-semibold text-neutral-800 hover:bg-neutral-200 focus:bg-neutral-100 focus:outline-none disabled:pointer-events-none disabled:opacity-50 dark:text-white dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
						>
							<span class="icon-[lucide--inbox] size-4 shrink-0"></span>
							<span class="absolute end-0 top-0 flex size-2.5">
								<span class="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75 dark:bg-red-600"></span>
								<span class="relative inline-flex size-2.5 rounded-full bg-red-500"></span>
							</span>
							<span class="sr-only">Mensagens</span>
						</button>
					</div>

					<!-- Divider -->
					<div class="mx-1 h-8 w-0.5 bg-neutral-100 dark:bg-neutral-800"></div>
					<!-- Dropdown -->
					{@render profileDropdown(profile)}
				</div>
			</div>
		</nav>
	</header>

	<!-- Sidebar -->
	<div
		id="hs-application-sidebar"
		class="hs-overlay hs-overlay-open:translate-x-0 fixed inset-y-0 start-0 z-[60] hidden h-full w-[260px] -translate-x-full transform border-e border-neutral-200 bg-neutral-50 transition-all duration-300 [--auto-close:lg] lg:end-auto lg:bottom-0 lg:block lg:translate-x-0 dark:border-neutral-700 dark:bg-neutral-800"
		role="dialog"
		tabindex="-1"
		aria-label="Sidebar"
	>
		<!-- Body -->
		<div class="relative flex h-full max-h-full flex-col">
			<div class="flex h-16 flex-shrink-0 items-center justify-between border-b border-b-transparent px-4">
				<!-- Logo -->
				<div class="flex gap-2">
					{#if sidebar.logo.image}
						<img src={sidebar.logo.image} alt="Logo" width="32" height="32" class="block" />
					{/if}
					{#if sidebar.logo.title}
						<div class="block text-2xl font-bold dark:text-white">{sidebar.logo.title}</div>
					{/if}
				</div>
				<div class="flex gap-2">
					<!-- Toogle dark/light mode -->
					<div>
						{@render toggleThemeButton()}
					</div>
					<!-- Close Button -->
					{@render closeSidebarButton()}
				</div>
			</div>
			<!-- Content -->
			<div
				class="size-full overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-300 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500 [&::-webkit-scrollbar-track]:bg-neutral-100 dark:[&::-webkit-scrollbar-track]:bg-neutral-700"
			>
				<!-- Container -->
				<div class="flex h-full w-full flex-col justify-between">
					<!-- Top -->
					<div class="flex w-full">
						<!-- Menu -->
						<ul class="flex w-full flex-col">
							<!-- Menu group -->
							{#each sidebar.menu as menu (menu.id)}
								<li class="pt-6">
									<div class="px-4 text-xs text-neutral-400 uppercase">{menu.title}</div>
									{#if menu.items}
										<nav class="hs-accordion-group flex w-full flex-col flex-wrap p-2" data-hs-accordion-always-open>
											<ul class="flex flex-col space-y-1">
												{#each menu.items as item (item.id)}
													{@render menuItem(item)}
												{/each}
											</ul>
										</nav>
									{/if}
								</li>
							{/each}
						</ul>
					</div>
					<!-- Bottom -->
					<div class="flex w-full flex-col">
						<!-- What's new block -->
						{#each sidebar.blocks as block (block.id)}
							{@render blockItem({
								id: '1',
								title: 'O que há de novo?',
								description: 'Você pode conferir todas as novidades dessa nova versão do dashboard no aplicativo Silo.'
							})}
						{/each}
					</div>
				</div>
			</div>

			<!-- Footer -->
			<footer class="flex h-16 justify-between border-t border-t-transparent">
				<div class="flex w-full items-center justify-between gap-2 px-4">
					<div class="flex items-center gap-2">
						<img class="inline-block size-[40px] rounded-full" src={user.avatar} alt="Avatar" />
						<div class="w-[140px]">
							<p class="truncate text-base leading-none font-medium text-neutral-700 dark:text-white">
								{user.name}
							</p>
							<p class="truncate text-sm text-neutral-500 dark:text-neutral-300">{user.email}</p>
						</div>
					</div>
					<button
						type="button"
						class="relative inline-flex size-8 items-center justify-center gap-x-2 rounded-full border border-transparent text-sm font-semibold text-neutral-800 hover:bg-neutral-200 focus:bg-neutral-100 focus:outline-none disabled:pointer-events-none disabled:opacity-50 dark:text-white dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
						aria-label="Sair"
					>
						<span class="icon-[lucide--log-out] size-4 shrink-0 text-neutral-400"></span>
					</button>
				</div>
			</footer>
		</div>
	</div>
	<!-- End Sidebar -->

	<!-- Content -->
	<div class="w-full lg:pl-[260px]">
		<div class="h-[calc(100svh-64px)] dark:text-white">
			<!-- Page content -->
			{@render children()}
		</div>
	</div>
</div>

{#snippet toggleThemeButton()}
	<button
		type="button"
		class="hs-dark-mode-active:block hs-dark-mode hidden rounded-full font-medium text-neutral-100 hover:bg-neutral-700 focus:bg-neutral-100 focus:outline-none dark:text-neutral-400"
		data-hs-theme-click-value="light"
	>
		<span class="group inline-flex size-8 shrink-0 items-center justify-center">
			<span class="icon-[lucide--sun] size-4 shrink-0"></span>
		</span>
		<span class="sr-only">Modo claro</span>
	</button>
	<button
		type="button"
		class="hs-dark-mode-active:hidden hs-dark-mode block rounded-full font-medium text-neutral-400 hover:bg-neutral-200 focus:bg-neutral-100 focus:outline-none dark:text-neutral-200 dark:hover:bg-neutral-800 dark:focus:bg-neutral-800"
		data-hs-theme-click-value="dark"
	>
		<span class="group inline-flex size-8 shrink-0 items-center justify-center">
			<span class="icon-[lucide--moon] size-4 shrink-0"></span>
		</span>
		<span class="sr-only">Modo escuro</span>
	</button>
{/snippet}

{#snippet closeSidebarButton()}
	<button
		type="button"
		class="relative inline-flex size-8 items-center justify-center gap-x-2 rounded-full border border-transparent text-sm font-semibold text-neutral-800 hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-none disabled:pointer-events-none disabled:opacity-50 lg:hidden dark:text-white dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
		data-hs-overlay="#hs-application-sidebar"
	>
		<span class="icon-[lucide--panel-left-close] size-4 shrink-0 text-neutral-400 dark:text-neutral-600"></span>
		<span class="sr-only">Fechar</span>
	</button>
{/snippet}

{#snippet menuItem(item: any)}
	<li>
		{#if item.items}
			<div class="hs-accordion" id={item.id}>
				<button
					type="button"
					class="hs-accordion-toggle flex w-full items-center gap-x-3 rounded-lg px-2.5 py-2 text-start text-base font-medium text-neutral-800 hover:bg-neutral-200 focus:bg-neutral-100 focus:outline-none dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
					aria-expanded="false"
					aria-controls="{item.id}-child"
				>
					<span class="{item.icon} size-4 shrink-0 text-neutral-400"></span>
					{item.title}
					<span class="icon-[lucide--chevron-up] hs-accordion-active:block ms-auto hidden size-4 text-neutral-400"></span>
					<span class="icon-[lucide--chevron-down] hs-accordion-active:hidden ms-auto block size-4 text-neutral-400"></span>
				</button>
				<div id="{item.id}-child" class="hs-accordion-content hidden w-full overflow-hidden transition-[height] duration-300" role="region" aria-labelledby={item.id}>
					<ul class="space-y-1 pt-1">
						{#each item.items as subItem (subItem.id)}
							{@render menuItem(subItem)}
						{/each}
					</ul>
				</div>
			</div>
		{:else}
			<a
				href={item.url}
				class="flex w-full items-center gap-x-3 rounded-lg px-2.5 py-2 text-base font-medium text-neutral-800 hover:bg-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
			>
				<span class="{item.icon} size-4 shrink-0 text-neutral-400"></span>
				{item.title}
			</a>
		{/if}
	</li>
{/snippet}

{#snippet blockItem(item: any)}
	<div id="alert-sidebar-{item.id}" class="m-4 mt-auto rounded-lg border border-neutral-200 bg-neutral-100 px-4 py-3 text-base dark:border-neutral-700 dark:bg-neutral-700">
		<div class="flex items-center justify-between">
			<p class="text-base font-semibold text-neutral-800 dark:text-white">
				{item.title}
			</p>
			<button
				type="button"
				data-hs-remove-element="#alert-sidebar-{item.id}"
				class="relative -mr-1 inline-flex size-8 items-center justify-center gap-x-2 rounded-full border border-transparent text-sm font-semibold text-neutral-800 hover:bg-neutral-200 focus:bg-neutral-100 focus:outline-none disabled:pointer-events-none disabled:opacity-50 dark:text-white dark:hover:bg-neutral-600 dark:focus:bg-neutral-700"
				aria-label="Fechar"
			>
				<span class="icon-[lucide--x] size-4 shrink-0 text-neutral-400"></span>
			</button>
		</div>
		<p class="text-medium mt-1 mb-2 text-sm text-neutral-500 dark:text-neutral-200">
			{item.description}
		</p>
	</div>
{/snippet}

{#snippet profileDropdown(profile: any)}
	<div class="hs-dropdown relative inline-flex [--placement:bottom-right]">
		<button
			id="hs-dropdown-account"
			type="button"
			class="group inline-flex items-center justify-center gap-x-2 rounded-full border border-transparent text-sm font-semibold text-neutral-800 focus:outline-none disabled:pointer-events-none disabled:opacity-50 dark:text-white"
			aria-haspopup="menu"
			aria-expanded="false"
			aria-label="Dropdown"
		>
			<!-- <div class="relative inline-block">
        <span class="inline-flex items-center justify-center size-[46px] rounded-full bg-neutral-500 text-sm font-semibold text-white leading-none border-2 group-hover:border-4 group-focus:border-4 border-neutral-200 dark:border-neutral-700 group-focus:border-neutral-200 dark:group-focus:border-neutral-700">MJ</span>
        <span class="absolute bottom-0 end-0 block size-3 rounded-full ring-2 ring-white bg-teal-400 dark:ring-neutral-800"></span>
      </div> -->
			<div class="relative inline-block">
				<img
					class="inline-block size-[46px] rounded-full border-2 border-neutral-200 group-hover:border-4 group-focus:border-4 group-focus:border-neutral-200 dark:border-neutral-700 dark:group-focus:border-neutral-700"
					src={profile.avatar}
					alt="Avatar"
				/>
				<span class="absolute end-0 bottom-0 block size-3 rounded-full bg-teal-400 ring-2 ring-white dark:ring-neutral-800"></span>
			</div>
			<div
				class="flex size-6 shrink-0 items-center justify-center rounded-full group-hover:bg-neutral-200 group-focus:bg-neutral-100 dark:group-hover:bg-neutral-700 dark:group-focus:bg-neutral-700"
			>
				<span class="icon-[lucide--chevron-down] size-4 shrink-0 text-neutral-400"></span>
			</div>
		</button>
		<!-- Dropdown Menu -->
		<div
			class="hs-dropdown-menu duration hs-dropdown-open:opacity-100 mt-2 hidden min-w-60 rounded-lg border border-neutral-200 bg-white opacity-0 shadow-md transition-[opacity,margin] before:absolute before:start-0 before:-top-4 before:h-4 before:w-full after:absolute after:start-0 after:-bottom-4 after:h-4 after:w-full dark:divide-neutral-700 dark:border-neutral-700 dark:bg-neutral-800"
			role="menu"
			aria-orientation="vertical"
			aria-labelledby="hs-dropdown-account"
		>
			<div class="rounded-t-lg bg-neutral-100 px-5 py-3 dark:bg-neutral-700">
				<p class="text-base leading-none font-medium text-neutral-800 dark:text-neutral-200">
					{profile.name}
				</p>
				<p class="text-sm text-neutral-500 dark:text-neutral-400">
					{profile.email}
				</p>
			</div>
			<div class="space-y-0.5 p-1.5">
				{#each profile.links as link (link.id)}
					<a
						class="flex items-center gap-x-3 rounded-lg px-3 py-2 text-base font-medium text-neutral-800 hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-none dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-300 dark:focus:bg-neutral-700 dark:focus:text-neutral-300"
						href={link.url}
					>
						<span class="{link.icon} size-4 shrink-0 text-neutral-400"></span>
						{link.title}
					</a>
				{/each}
			</div>
		</div>
	</div>
{/snippet}
