<script lang="ts">
	let { children, href } = $props()
</script>

<a {href} class="font-semibold underline-offset-2 hover:underline">{@render children()}</a>
