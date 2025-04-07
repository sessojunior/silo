<script lang="ts">
	let { children } = $props()
</script>

<div
	class="flex items-center py-3 before:me-6 before:flex-1 before:border-t before:border-neutral-200 after:ms-6 after:flex-1 after:border-t after:border-neutral-200 dark:before:border-neutral-600 dark:after:border-neutral-600"
>
	{@render children()}
</div>
