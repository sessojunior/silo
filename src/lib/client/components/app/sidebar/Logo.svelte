<script lang="ts">
	const { logo } = $props()
</script>

<div class="flex">
	{#if logo.image}
		<img src={logo.image} alt="Logo" class="-ml-1 block h-8 w-8" />
	{/if}
	{#if logo.title}
		<div class="inline-block px-0.5 pt-0.5 text-2xl font-bold text-zinc-600 dark:text-zinc-200">{logo.title}</div>
	{/if}
</div>
