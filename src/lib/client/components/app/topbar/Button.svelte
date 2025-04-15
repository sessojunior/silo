<script lang="ts">
	let { children, disabled = false, icon = null, href = null, style = null } = $props()
</script>

{#if style === 'alert'}
	<div class="relative inline-block">
		<a
			{href}
			role="button"
			aria-disabled={disabled}
			class="relative inline-flex size-[38px] items-center justify-center gap-x-2 rounded-full border border-transparent text-sm font-semibold text-zinc-800 transition-all duration-500 hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none disabled:pointer-events-none disabled:opacity-50 dark:text-white dark:hover:bg-zinc-700 dark:focus:bg-zinc-700"
		>
			<span class="{icon} size-4 shrink-0"></span>
			<span class="absolute end-0 top-0 flex size-2.5">
				<span class="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75 dark:bg-red-600"></span>
				<span class="relative inline-flex size-2.5 rounded-full bg-red-500"></span>
			</span>
			<span class="sr-only">{@render children()}</span>
		</a>
	</div>
{:else if style === 'menu'}
	<button
		type="button"
		class="relative inline-flex size-[38px] items-center justify-center gap-x-2 rounded-full border border-transparent text-zinc-800 transition-all duration-500 hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none disabled:pointer-events-none disabled:opacity-50 dark:text-white dark:hover:bg-zinc-700 dark:focus:bg-zinc-700"
		aria-haspopup="dialog"
		aria-expanded="false"
		aria-controls="hs-application-sidebar"
		aria-label="Exibir ou ocultar menu lateral"
		data-hs-overlay="#hs-application-sidebar"
	>
		<span class="sr-only">{@render children()}</span>
		<span class="{icon} size-5 shrink-0"></span>
	</button>
{:else}
	<a
		{href}
		role="button"
		aria-disabled={disabled}
		class="relative inline-flex size-[38px] items-center justify-center gap-x-2 rounded-full border border-transparent text-sm font-semibold text-zinc-800 transition-all duration-500 hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none disabled:pointer-events-none disabled:opacity-50 dark:text-white dark:hover:bg-zinc-700 dark:focus:bg-zinc-700"
	>
		<span class="{icon} size-4 shrink-0" aria-hidden="true"></span>
		<span class="sr-only">{@render children()}</span>
	</a>
{/if}
