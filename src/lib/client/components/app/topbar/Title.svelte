<script lang="ts">
	let { children } = $props()
</script>

<div class="hidden items-center gap-x-2 sm:flex">
	<h2 class="px-4 text-2xl font-medium text-zinc-800 dark:text-zinc-100">{@render children()}</h2>
</div>
