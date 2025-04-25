<script lang="ts">
	import { page } from '$app/state'
	import Button from '$lib/client/components/ui/Button.svelte'
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-white p-6 dark:bg-zinc-900">
	<!-- Ícone de erro -->
	{#if page.status === 404}
		<span class="icon-[lucide--file-x-2] animate-pulse text-6xl text-red-600 dark:text-red-400"></span>
	{:else if page.status === 500}
		<span class="icon-[lucide--server-off] animate-pulse text-6xl text-yellow-600 dark:text-yellow-400"></span>
	{:else if page.status === 403}
		<span class="icon-[lucide--lock] animate-pulse text-6xl text-blue-600 dark:text-blue-400"></span>
	{:else}
		<span class="icon-[lucide--alert-circle] animate-pulse text-8xl text-orange-600 dark:text-orange-400"></span>
	{/if}

	<!-- Mensagem de erro -->
	<h1 class="mt-6 text-center text-4xl font-extrabold tracking-tight text-zinc-800 dark:text-zinc-100">Oops! Algo deu errado.</h1>

	<!-- Descrição de erro com base no status -->
	<p class="mt-4 text-lg text-zinc-700 dark:text-zinc-300">
		{#if page.status === 404}
			Página não encontrada. Verifique a URL ou volte para a página inicial.
		{:else if page.status === 500}
			Erro no servidor. Estamos trabalhando para corrigir isso.
		{:else if page.status === 403}
			Acesso negado. Você não tem permissão para visualizar esta página.
		{:else}
			Ocorreu um erro desconhecido. Por favor, tente novamente mais tarde.
		{/if}
	</p>

	<!-- Informações da mensagem (se houver) -->
	{#if page.error?.message}
		<p class="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-200">{page.error?.message.toUpperCase()}</p>
	{/if}

	<!-- Botão para voltar para a página inicial -->
	<Button type="button" href="/" className="mt-4">Voltar para a página inicial</Button>
</div>
