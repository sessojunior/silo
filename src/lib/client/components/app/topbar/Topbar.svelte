<script lang="ts">
	import Dropdown from '$lib/client/components/app/topbar/Dropdown.svelte'
	import Button from '$lib/client/components/app/topbar/Button.svelte'
	import Divider from '$lib/client/components/app/topbar/Divider.svelte'
	import Title from '$lib/client/components/app/topbar/Title.svelte'

	let { title, user } = $props()

	// Dados para o dropdown
	const account = {
		avatar: user.avatar ? `/uploads/avatar/${user.avatar}` : '/uploads/avatar.png',
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
				url: '/sign-out'
			}
		]
	}
</script>

<header
	class="sticky inset-x-0 top-0 z-[48] flex h-16 w-full flex-shrink-0 flex-wrap border-b border-b-zinc-200 bg-white py-2.5 md:flex-nowrap md:justify-start lg:ps-[260px] dark:border-zinc-700 dark:bg-zinc-900"
>
	<nav class="flex w-full items-center px-4">
		<div class="flex w-full items-center justify-between gap-x-2">
			<div class="lg:hidden">
				<!-- Navigation Toggle -->
				<Button icon="icon-[lucide--menu]" style="menu">Exibir menu lateral</Button>
			</div>
			<!-- Title -->
			<Title>{title}</Title>
			<!-- Buttons, divider & dropdown -->
			<div class="flex flex-row items-center justify-end gap-1">
				<Button href="#" icon="icon-[lucide--circle-help]">Ajuda</Button>
				<Button href="#" icon="icon-[lucide--activity]">Atividades</Button>
				<Button href="#" icon="icon-[lucide--settings]">Configurações</Button>
				<Divider />
				<Button href="#" icon="icon-[lucide--inbox]" style="alert">Mensagens</Button>
				<Divider />
				<Dropdown {account} />
			</div>
		</div>
	</nav>
</header>
