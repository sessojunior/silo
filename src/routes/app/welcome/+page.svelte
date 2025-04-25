<script lang="ts">
	import { getContext } from 'svelte'

	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	// Pega os dados da página por meio do context
	const contextPage = getContext<{ title: string }>('contextPage')

	// Atualiza o título da página dinamicamente
	contextPage.title = 'Bem-vindo ao Silo'

	// Dados do usuário
	const user = data.user

	// Itens de boas-vindas
	const welcome = [
		{
			icon: 'icon-[lucide--user-round-pen]',
			title: 'Complete seu perfil de usuário',
			description: 'Termine de configurar as informações de seu perfil, como nome, imagem de perfil e outras informações.',
			link: '/app/settings/profile',
			completed: true
		},
		{
			icon: 'icon-[lucide--folder-git-2]',
			title: 'Configure os produtos e tarefas',
			description: 'Selecione os produtos e tarefas que deseja monitorar e acompanhar na visão geral.',
			link: '#',
			completed: false
		},
		{
			icon: 'icon-[lucide--square-chart-gantt]',
			title: 'Configure os projetos',
			description: 'Selecione ou crie os projetos e configure seu Kanban e acompanhe o gráfico Gantt.',
			link: '#',
			completed: false
		}
	]
</script>

<div class="container flex h-full flex-col items-center justify-center p-8 text-zinc-600 dark:text-zinc-200">
	<div class="mb-4 max-w-2xl">
		<h1 class="text-center text-3xl font-bold tracking-tight">
			Bem-vindo <span class="text-blue-600">{user.name.split(' ')[0]}</span>👋
		</h1>
		<p class="mt-1 text-center text-base">Siga as etapas abaixo para finalizar a configuração de sua conta.</p>
	</div>

	<!-- Cartão de boas-vindas -->
	<div class="max-w-2xl">
		<div class="flex flex-col rounded-xl border border-zinc-200 bg-white shadow-2xs">
			<div class="flex items-center justify-between rounded-t-xl border-b border-zinc-200 bg-zinc-50 p-6">
				<h3 class="text-2xl font-bold">Vamos começar!</h3>
				<div class="flex items-center gap-x-1 text-zinc-400">{welcome.filter((item) => item.completed).length} de {welcome.length}</div>
			</div>
			<div class="flex flex-col gap-4 p-6">
				{#each welcome as { icon, title, description, link, completed }}
					<a
						href={link}
						class="group flex items-center gap-x-4 rounded-lg border p-4 hover:border-blue-200 hover:bg-blue-50
						{completed ? 'border-blue-200 bg-blue-50' : 'border-zinc-200 bg-zinc-50'}"
					>
						<div>
							<div
								class="flex size-14 items-center justify-center rounded-lg border
								{completed ? 'border-blue-300 bg-blue-300 group-hover:bg-blue-400' : 'border-zinc-200 bg-zinc-100 group-hover:border-blue-200 group-hover:bg-blue-100'}"
							>
								{#if completed}
									<span class="icon-[lucide--check-check] size-8 shrink-0 text-white"></span>
								{:else}
									<span class="{icon} size-8 shrink-0 text-zinc-400 group-hover:text-blue-400"></span>
								{/if}
							</div>
						</div>
						<div>
							<h3 class="text-lg font-medium">{title}</h3>
							<p>{description}</p>
						</div>
					</a>
				{/each}
				<div class="flex items-center justify-center pt-2 text-center">
					<label for="hs-vertical-checkbox-in-form" class="w-ful flex">
						<input
							type="checkbox"
							class="mt-0.5 shrink-0 rounded-sm border-zinc-200 text-blue-600 checked:border-blue-500 focus:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:checked:border-blue-500 dark:checked:bg-blue-500 dark:focus:ring-offset-zinc-800"
							id="hs-vertical-checkbox-in-form"
						/>
						<span class="ms-3 text-sm text-zinc-500 dark:text-zinc-400">Não exibir mais as boas-vindas.</span>
					</label>
				</div>
			</div>
		</div>
	</div>
</div>
