<script lang="ts">
	let { children, type, disabled = false, icon = null, style = 'filled', href = null } = $props()

	const classButton = {
		bordered:
			'inline-flex w-full items-center justify-center gap-x-2 rounded-lg border border-neutral-200 bg-white px-4 py-3 font-medium shadow-xs hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:focus:bg-neutral-800',
		filled:
			'inline-flex w-full items-center justify-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 focus:bg-blue-700 focus:outline-none disabled:pointer-events-none disabled:opacity-50'
	}
</script>

{#if href}
	<a {href} role="button" aria-disabled={disabled} class={style === 'filled' ? classButton.filled : classButton.bordered}>
		{#if icon}
			<span class="{icon} size-4 shrink-0" aria-hidden="true"></span>
		{/if}
		{@render children()}
	</a>
{:else}
	<button {type} {disabled} class={style === 'filled' ? classButton.filled : classButton.bordered}>
		{#if icon}
			<span class="{icon} size-4 shrink-0" aria-hidden="true"></span>
		{/if}
		{@render children()}
	</button>
{/if}
