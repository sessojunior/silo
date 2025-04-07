<script lang="ts">
	let { children, htmlFor } = $props()
</script>

<label for={htmlFor} class="mb-2 block">{@render children()}</label>
