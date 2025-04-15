<script lang="ts">
	const { icon, title, description } = $props()
</script>

<div class="mx-auto mb-4 flex size-14 items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-700 dark:text-white">
	<span class="{icon} size-6"></span>
</div>
<h1 class="text-center text-3xl font-bold tracking-tight text-zinc-600 dark:text-zinc-200">
	{title}
</h1>
<p class="mt-1 text-center text-base text-zinc-600 dark:text-zinc-200">
	{description}
</p>
