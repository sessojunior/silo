<script lang="ts">
	let { children, type, disabled = false, icon = null, style = 'filled', className = null, href = null } = $props()

	const classButton = {
		bordered:
			'inline-flex items-center justify-center gap-x-2 rounded-lg border border-zinc-200 bg-white px-5 py-3 font-medium shadow-xs hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-none disabled:pointer-events-none disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800 transition-all duration-500',
		filled:
			'inline-flex items-center justify-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 focus:bg-blue-700 focus:outline-none disabled:pointer-events-none disabled:opacity-50 transition-all duration-500'
	}
</script>

{#if href}
	<a {href} role="button" aria-disabled={disabled} class="{style === 'filled' ? classButton.filled : classButton.bordered} {className ?? 'w-full'}">
		{#if icon}
			<span class="{icon} size-4 shrink-0" aria-hidden="true"></span>
		{/if}
		{@render children()}
	</a>
{:else}
	<button {type} {disabled} class="{style === 'filled' ? classButton.filled : classButton.bordered} {className ?? 'w-full'}">
		{#if icon}
			<span class="{icon} size-4 shrink-0" aria-hidden="true"></span>
		{/if}
		{@render children()}
	</button>
{/if}
