<script lang="ts">
	import { page } from '$app/state'

	const { menu } = $props()
</script>

<ul class="flex w-full flex-col">
	<!-- Grupos do menu -->
	{#each menu as { id, title, items } (id)}
		<li class="pt-6">
			<div class="px-4 text-xs text-zinc-400 uppercase">{title}</div>
			{#if items}
				<nav class="hs-accordion-group flex w-full flex-col flex-wrap p-2" data-hs-accordion-always-open>
					<ul class="flex flex-col space-y-1">
						{#each items as item (item.id)}
							<!-- Item do menu -->
							{@render menuItem(item)}
						{/each}
					</ul>
				</nav>
			{/if}
		</li>
	{/each}
</ul>

{#snippet menuItem(item: any)}
	<li>
		{#if item.items}
			<div class="hs-accordion" id={item.id}>
				<button
					type="button"
					class="hs-accordion-toggle flex w-full items-center gap-x-3 rounded-lg px-2.5 py-2 text-start text-base font-medium text-zinc-800 transition-all duration-500 hover:bg-zinc-200 focus:bg-zinc-100 focus:outline-none dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:focus:bg-zinc-700"
					aria-expanded="false"
					aria-controls="{item.id}-child"
				>
					<span class="{item.icon} size-4 shrink-0 text-zinc-400"></span>
					{item.title}
					<span class="icon-[lucide--chevron-up] hs-accordion-active:block ms-auto hidden size-4 text-zinc-400"></span>
					<span class="icon-[lucide--chevron-down] hs-accordion-active:hidden ms-auto block size-4 text-zinc-400"></span>
				</button>
				<div id="{item.id}-child" class="hs-accordion-content hidden w-full overflow-hidden transition-[height] duration-500" role="region" aria-labelledby={item.id}>
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
				class="flex w-full items-center gap-x-3 rounded-lg px-2.5 py-2 text-base font-medium text-zinc-600 transition-all duration-500 hover:bg-zinc-200 dark:text-zinc-200 dark:hover:bg-zinc-500 dark:hover:text-zinc-300
				{page.url.pathname === item.url ? 'bg-zinc-100' : ''}"
			>
				<span class="{item.icon} size-4 shrink-0 text-zinc-400"></span>
				{item.title}
			</a>
		{/if}
	</li>
{/snippet}
