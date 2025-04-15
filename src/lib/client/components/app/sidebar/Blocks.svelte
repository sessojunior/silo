<script lang="ts">
	const { blocks } = $props()
</script>

{#each blocks as block (block.id)}
	{@render blockItem({
		id: '1',
		title: 'O que há de novo?',
		description: 'Você pode conferir todas as novidades dessa nova versão do dashboard no aplicativo Silo.'
	})}
{/each}

{#snippet blockItem(item: any)}
	<div id="alert-sidebar-{item.id}" class="m-4 mt-auto rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-800">
		<div class="flex items-center justify-between">
			<p class="text-base font-semibold text-zinc-800 dark:text-white">
				{item.title}
			</p>
			<button
				type="button"
				data-hs-remove-element="#alert-sidebar-{item.id}"
				class="relative -mr-1 inline-flex size-8 items-center justify-center gap-x-2 rounded-full border border-transparent text-sm font-semibold text-zinc-800 transition-all duration-500 hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none disabled:pointer-events-none disabled:opacity-50 dark:text-white dark:hover:bg-zinc-600 dark:focus:bg-zinc-700"
				aria-label="Fechar"
			>
				<span class="icon-[lucide--x] size-4 shrink-0 text-zinc-400"></span>
			</button>
		</div>
		<p class="text-medium mt-1 mb-2 text-sm text-zinc-500 dark:text-zinc-200">
			{item.description}
		</p>
	</div>
{/snippet}
