<script lang="ts">
	let { children, disabled = false, icon = null, href = null, active = false } = $props()
</script>

<a
	{href}
	role="button"
	aria-disabled={disabled}
	class="{active ? 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-800' : 'border-transparent bg-transparent dark:bg-zinc-700'} 
	dark:text-zinc-200} inline-flex items-center gap-x-2 rounded-lg border px-4 py-2 text-base font-medium text-zinc-800 transition-all duration-500 hover:text-zinc-500 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50"
>
	{#if icon}
		<span class="{icon} size-4 shrink-0" aria-hidden="true"></span>
	{/if}
	{@render children()}
</a>
