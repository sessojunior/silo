<script lang="ts">
	import ButtonTheme from '$lib/client/components/app/sidebar/ButtonTheme.svelte'
	import ButtonClose from '$lib/client/components/app/sidebar/ButtonClose.svelte'
	import Logo from '$lib/client/components/app/sidebar/Logo.svelte'

	const { logo } = $props()
</script>

<!-- Header -->
<div class="flex h-16 flex-shrink-0 items-center justify-between border-b border-b-transparent px-4">
	<!-- Logo -->
	<Logo {logo} />

	<div class="flex gap-2">
		<!-- Botão de alternar o tema entre claro e escuro -->
		<ButtonTheme />

		<!-- Botão de fechar -->
		<ButtonClose />
	</div>
</div>
