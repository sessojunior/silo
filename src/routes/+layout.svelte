<script lang="ts">
	import { afterNavigate } from '$app/navigation'
	import '../app.css'

	let { children } = $props()

	// Executar após navegar entre as páginas
	afterNavigate(() => {
		window.HSStaticMethods.autoInit()
	})
</script>

{@render children()}
