<script lang="ts">
	import { setContext } from 'svelte'

	import Sidebar from '$lib/client/components/app/sidebar/Sidebar.svelte'
	import Topbar from '$lib/client/components/app/topbar/Topbar.svelte'

	let { children, data }: { children: any; data: { user: any } } = $props()

	// Dados da página
	const contextPage = $state({
		title: 'Título padrão'
	})

	// Disponibiliza os dados da página para serem alterados ou acessados pelos filhos
	setContext('contextPage', contextPage)

	// Dados do usuário
	const user = data.user

	// Dados para o menu lateral
	const logo = { image: '/images/logo.png', title: 'Silo' }
	const sidebar = {
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
						url: '/app/settings',
						items: [
							{
								id: '2.3.1',
								title: 'Alterar perfil',
								icon: null,
								url: '/app/settings/profile',
								items: null
							},
							{
								id: '2.3.2',
								title: 'Preferências',
								icon: null,
								url: '/app/settings/preferences',
								items: null
							},
							{
								id: '2.3.3',
								title: 'Segurança',
								icon: null,
								url: '/app/settings/security',
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
		]
	}

	// Dados para o dropdown da barra do topo
	const account = {
		avatar: user.avatar ? `/uploads/avatar/${user.avatar}` : '/uploads/avatar.png',
		name: user.name,
		email: user.email,
		links: [
			{
				id: '1',
				icon: 'icon-[lucide--user-round-pen]',
				title: 'Alterar perfil',
				url: '/app/settings/profile'
			},
			{
				id: '2',
				icon: 'icon-[lucide--settings-2]',
				title: 'Preferências',
				url: '/app/settings/preferences'
			},
			{
				id: '3',
				icon: 'icon-[lucide--shield-check]',
				title: 'Segurança',
				url: '/app/settings/security'
			},
			{
				id: '4',
				icon: 'icon-[lucide--log-out]',
				title: 'Sair',
				url: '/sign-out'
			}
		]
	}
</script>

<div>
	<!-- Barra do topo -->
	<Topbar title={contextPage.title} {account} {user} />

	<!-- Barra lateral -->
	<Sidebar {user} {logo} {sidebar} />

	<!-- Conteúdo -->
	<div class="w-full lg:pl-[260px]">
		<div class="h-[calc(100svh-64px)] bg-zinc-50 dark:bg-zinc-800 dark:text-white">
			<!-- Contéudo da página -->
			{@render children()}
		</div>
	</div>
</div>
