<script lang="ts">
	import { getContext } from 'svelte'
	import { page } from '$app/state'

	let { children } = $props()

	import Button from '$lib/client/components/app/nav/Button.svelte'
	import Content from '$lib/client/components/app/nav/Content.svelte'

	// Pega os dados da página por meio do context
	const contextPage = getContext<{ title: string }>('contextPage')

	// Atualiza o título da página dinamicamente
	contextPage.title = 'Perfil do usuário'

	// Lista de botões
	const tabs = [
		{ label: 'Alterar perfil', url: '/app/profile/general' },
		{ label: 'Preferências', url: '/app/profile/preferences' },
		{ label: 'Segurança', url: '/app/profile/security' }
	]
</script>

<div class="flex min-h-[calc(100vh-64px)] w-full flex-col bg-white dark:bg-zinc-900">
	<div class="flex flex-col">
		<!-- Botões -->
		<div class="flex">
			<div class="flex w-full border-b border-zinc-200 bg-zinc-100 px-4 py-3 transition dark:border-zinc-700 dark:bg-zinc-700">
				<div class="flex gap-x-2">
					<!-- Botões -->
					{#each tabs as tab}
						<Button href={tab.url} active={page.url.pathname === tab.url}>
							{tab.label}
						</Button>
					{/each}
				</div>
			</div>
		</div>
		<div>
			<!-- Conteúdo -->
			<Content>
				<div class="flex h-full w-full flex-col items-start justify-start gap-8 p-8 text-zinc-600 dark:text-zinc-200">
					{@render children()}
				</div>
			</Content>
		</div>
	</div>
</div>
