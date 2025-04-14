<script lang="ts">
	const { logo } = $props()
</script>

<div class="flex gap-2">
	{#if logo.image}
		<img src={logo.image} alt="Logo" class="block h-8 w-8" />
	{/if}
	{#if logo.title}
		<div class="inline-block text-2xl font-bold text-neutral-600 dark:text-neutral-200">{logo.title}</div>
	{/if}
</div>
