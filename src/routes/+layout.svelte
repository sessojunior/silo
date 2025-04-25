<script lang="ts">
	import { afterNavigate } from '$app/navigation'
	import { themeStore } from '$lib/client/stores/theme'
	import type { LayoutProps } from './$types'
	import '../app.css'

	import Toast from '$lib/client/components/ui/Toast.svelte'

	let { children }: LayoutProps = $props()

	// Executar após navegar entre as páginas
	afterNavigate(() => {
		window.HSStaticMethods.autoInit()
	})
</script>

<svelte:head>
	<title>Silo</title>
</svelte:head>

<!-- Usa o store do tema do usuário -->
<div class={$themeStore}>
	{@render children()}
</div>

<!-- Toast -->
<Toast />
