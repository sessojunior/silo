<script lang="ts">
	import { onMount } from 'svelte'

	onMount(() => {
		window.HSStaticMethods.autoInit()
	})

	let { type = 'text', id, name, placeholder = '', value = $bindable(''), length, isInvalid, invalidMessage } = $props()
</script>

<div {id} data-hs-pin-input class="flex justify-between gap-x-3">
	{#each { length: length }, index}
		<!-- svelte-ignore a11y_autofocus -->
		<input
			{type}
			{name}
			{placeholder}
			{value}
			autocomplete={index === 0 ? 'one-time-code' : ''}
			autofocus={index === 0 ? true : false}
			maxlength={1}
			required
			data-hs-pin-input-item
			class="block w-12 rounded-md p-3 text-center text-lg uppercase disabled:pointer-events-none disabled:opacity-50 {isInvalid
				? 'border-red-400 focus:border-red-400 focus:ring-red-600 dark:border-red-800 dark:focus:border-red-800 dark:focus:ring-red-800'
				: 'focus:border-blue-500 focus:ring-blue-500'} 
        border-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:placeholder-zinc-500 dark:focus:ring-zinc-600"
		/>
	{/each}
</div>

{#if isInvalid}
	<p class="dark:text-red-00 mt-2 text-xs text-red-500">{invalidMessage}</p>
{/if}
