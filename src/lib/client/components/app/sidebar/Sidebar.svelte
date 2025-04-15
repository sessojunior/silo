<script lang="ts">
	import Header from '$lib/client/components/app/sidebar/Header.svelte'
	import Footer from '$lib/client/components/app/sidebar/Footer.svelte'
	import Menu from '$lib/client/components/app/sidebar/Menu.svelte'
	import Blocks from '$lib/client/components/app/sidebar/Blocks.svelte'

	const { user, logo, sidebar } = $props()
</script>

<!-- Barra lateral -->
<div
	id="hs-application-sidebar"
	class="hs-overlay hs-overlay-open:translate-x-0 fixed inset-y-0 start-0 z-[60] hidden h-full w-[260px] -translate-x-full transform border-e border-zinc-200 bg-white transition-all duration-300 [--auto-close:lg] lg:end-auto lg:bottom-0 lg:block lg:translate-x-0 dark:border-zinc-700 dark:bg-zinc-900"
	role="dialog"
	tabindex="-1"
	aria-label="Barra lateral"
>
	<div class="relative flex h-full max-h-full flex-col">
		<!-- Cabeçalho e logotipo -->
		<Header {logo} />

		<!-- Conteúdo -->
		<div
			class="size-full overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-500 [&::-webkit-scrollbar-track]:bg-zinc-100 dark:[&::-webkit-scrollbar-track]:bg-zinc-700"
		>
			<!-- Container -->
			<div class="flex h-full w-full flex-col justify-between">
				<!-- Top -->
				<div class="flex w-full">
					<!-- Menu -->
					<Menu menu={sidebar.menu} />
				</div>
				<!-- Bottom -->
				<div class="flex w-full flex-col">
					<!-- Blocos -->
					<Blocks blocks={sidebar.blocks} />
				</div>
			</div>
		</div>

		<!-- Rodapé -->
		<Footer {user} />
	</div>
</div>
