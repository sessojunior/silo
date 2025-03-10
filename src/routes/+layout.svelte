<script lang="ts">
	import '../app.css'

	// Preline
	import { afterNavigate } from '$app/navigation'
	afterNavigate(() => {
		window.HSStaticMethods.autoInit()
	})

	let { children } = $props()
</script>

{@render children()}
