<script lang="ts">
	import { onMount } from 'svelte'

	onMount(() => {
		window.HSStaticMethods.autoInit()
	})

	let { placeholder = 'Selecione uma opção...', name, selected = null, options, required = false, isInvalid, invalidMessage } = $props()
</script>

<select
	{name}
	{required}
	data-hs-select={JSON.stringify({
		placeholder,
		toggleTag: `<button type="button" aria-expanded="false"></button>`,
		toggleClasses:
			'hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative py-3 ps-4 pe-9 flex gap-x-2 text-nowrap w-full cursor-pointer bg-white border border-zinc-200 rounded-lg text-start text-base focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:focus:outline-hidden dark:focus:ring-1 dark:focus:ring-zinc-600',
		dropdownClasses:
			'mt-2 z-50 w-full max-h-72 p-1 space-y-0.5 bg-white border border-zinc-200 rounded-lg overflow-hidden overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-zinc-100 [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-track]:bg-zinc-700 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-500 dark:bg-zinc-900 dark:border-zinc-700',
		optionClasses:
			'py-2 px-4 w-full text-base text-zinc-600 cursor-pointer hover:bg-zinc-100 rounded-lg focus:outline-hidden focus:bg-zinc-100 hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-200 dark:focus:bg-zinc-800',
		optionTemplate: `<div class="flex justify-between items-center w-full">
			<span data-title></span>
			<span class="hidden hs-selected:block">
				<span class="icon-[lucide--check] size-3.5 shrink-0 text-blue-600 dark:text-blue-500"></span>
			</span></div>`,
		extraMarkup: `<div class=\"absolute top-1/2 end-3 -translate-y-1/2\">
										<span class="icon-[lucide--chevrons-up-down] size-3.5 shrink-0 text-zinc-500 dark:text-zinc-500"></span>
		</div>`
	})}
	class="hidden"
>
	<option selected={selected === ''}></option>
	{#each options as { label, value, disabled } (value)}
		<option {value} {disabled} selected={selected === value}>{label}</option>
	{/each}
</select>

{#if isInvalid}
	<p class="dark:text-red-00 mt-2 text-xs text-red-500">{invalidMessage}</p>
{/if}
