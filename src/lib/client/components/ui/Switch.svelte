<script lang="ts">
	import { onMount } from 'svelte'

	onMount(() => {
		window.HSStaticMethods.autoInit()
	})

	let { id, name, size = 'md', title = '', description = '', isInvalid, invalidMessage } = $props()
</script>

<div class="flex w-full items-center justify-between gap-3">
	<label for={id}>
		<h3 class="text-lg font-bold tracking-tight text-zinc-600 dark:text-zinc-200">{title}</h3>
		<p class="mt-1 text-base text-zinc-400 dark:text-zinc-600">{description}</p>
	</label>
	<label
		for={id}
		class="{size === 'lg' ? 'h-8 w-15' : size === 'md' ? 'h-7 w-13' : size === 'sm' ? 'h-6 w-11' : 'h-5 w-9'} 
		relative inline-block cursor-pointer"
	>
		<input type="checkbox" {name} {id} class="peer sr-only" />
		<span
			class="absolute inset-0 rounded-full bg-gray-200 transition-colors duration-200 ease-in-out peer-checked:bg-blue-600 peer-disabled:pointer-events-none peer-disabled:opacity-50 dark:bg-neutral-700 dark:peer-checked:bg-blue-500"
		></span>
		<span
			class="{size === 'lg' ? 'size-7' : size === 'md' ? 'size-6' : size === 'sm' ? 'size-5' : 'size-4'} 
			absolute start-0.5 top-1/2 size-6 -translate-y-1/2 rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out peer-checked:translate-x-full dark:bg-neutral-400 dark:peer-checked:bg-white"
		></span>
	</label>
</div>

{#if isInvalid}
	<p class="dark:text-red-00 mt-2 text-xs text-red-500">{invalidMessage}</p>
{/if}
