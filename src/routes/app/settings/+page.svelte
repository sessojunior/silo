<script lang="ts">
	import { getContext } from 'svelte'

	import Button from '$lib/client/components/app/tab/Button.svelte'
	import Content from '$lib/client/components/app/tab/Content.svelte'

	// Pega os dados da página por meio do context
	const page = getContext<{ title: string }>('page')

	// Atualiza o título da página dinamicamente
	page.title = 'Configurações'
</script>

<div class="flex min-h-[calc(100vh-64px)] w-full flex-col bg-white dark:bg-zinc-900">
	<div class="flex flex-col">
		<!-- Botões -->
		<div class="flex">
			<div class="flex w-full border-b border-zinc-200 bg-zinc-100 px-4 py-3 transition dark:border-zinc-700 dark:bg-zinc-700">
				<div class="flex gap-x-2" aria-label="Tabs" role="tablist" aria-orientation="horizontal">
					<!-- Botões -->
					<Button id="tab-button-1" tab="tab-1" active>Alterar perfil</Button>
					<Button id="tab-button-2" tab="tab-2">Preferências</Button>
					<Button id="tab-button-3" tab="tab-3">Segurança</Button>
				</div>
			</div>
		</div>
		<!-- Conteúdo -->
		<div>
			<Content id="tab-1" labelledby="tab-button-1">
				{@render tab1()}
			</Content>
			<Content id="tab-2" labelledby="tab-button-2">
				{@render tab1()}
			</Content>
			<Content id="tab-3" labelledby="tab-button-3">
				{@render tab1()}
			</Content>
		</div>
	</div>
</div>

{#snippet tab1()}
	<!-- Cabeçalho -->
	<div class="flex w-full justify-between">
		<div class="w-full flex-grow">
			<h1 class="text-3xl font-bold tracking-tight">Alterar perfil do usuário</h1>
			<p class="mt-1 text-base">Altere suas informações pessoais, como nome, imagem de perfil e outras informações.</p>
		</div>
		<div class="flex w-80 items-center justify-end gap-4">
			<button
				type="button"
				class="inline-flex items-center justify-center gap-x-2 rounded-lg border border-zinc-200 bg-white px-6 py-3 font-medium shadow-xs hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-none disabled:pointer-events-none disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800"
				>Cancelar</button
			>
			<button
				type="button"
				class="inline-flex items-center justify-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-6 py-3 font-medium text-white shadow-xs hover:bg-blue-700 focus:bg-blue-700 focus:outline-none disabled:pointer-events-none disabled:opacity-50"
				>Salvar</button
			>
		</div>
	</div>
	<!-- Cartão de informações pessoais -->
	<div class="flex w-full gap-8">
		<div class="flex flex-grow flex-col rounded-xl border border-zinc-200 bg-white shadow-2xs">
			<div class="flex items-center justify-between rounded-t-xl border-b border-zinc-200 bg-zinc-50 px-6 py-4">
				<h3 class="text-xl font-bold">Informações pessoais</h3>
				<div class="flex items-center gap-x-1 text-zinc-400">yes</div>
			</div>
			<div class="flex flex-col gap-4 p-6">
				<div class="flex">
					<p>teste</p>
				</div>
			</div>
		</div>
		<div class="w-80">side right</div>
	</div>
{/snippet}
