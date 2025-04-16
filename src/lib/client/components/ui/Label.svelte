<script lang="ts">
	let { children, htmlFor, isInvalid } = $props()
</script>

<label for={htmlFor} class="mb-2 block font-semibold {isInvalid ? 'text-red-500' : ''}">{@render children()}</label>
