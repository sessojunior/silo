<script lang="ts">
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
			class="block w-12 rounded-md border-gray-200 p-3 text-center text-lg uppercase focus:border-blue-500 focus:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600"
		/>
	{/each}
</div>

{#if isInvalid}
	<p class="dark:text-red-00 mt-2 text-xs text-red-500">{invalidMessage}</p>
{/if}
