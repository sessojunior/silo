<script lang="ts">
	let { children } = $props()
</script>

<div class="flex min-h-screen justify-between bg-white dark:bg-neutral-900">
	<div class="h-screen w-full md:w-1/2 md:max-w-[600px]">
		<div
			class="size-full overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500 [&::-webkit-scrollbar-track]:bg-gray-100 dark:[&::-webkit-scrollbar-track]:bg-neutral-700"
		>
			<div class="flex h-full w-full flex-col">
				<div class="flex">
					<div class="flex gap-2 px-10 pt-10">
						<img src="/images/logo.png" alt="Logo" width="32" height="32" class="block" />
						<div class="block text-2xl font-bold dark:text-white">Silo</div>
					</div>
				</div>
				<div class="flex flex-grow items-center justify-center">
					<div class="mx-auto w-full max-w-[330px] px-5 py-10">
						{@render children()}
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Background -->
	<div class="hidden min-h-screen flex-grow md:flex md:w-1/2 lg:w-1/2">
		<img src="/images/background-1.png" alt="Fundo" class="size-full h-screen object-cover" />
	</div>

	<!-- Toogle dark/light mode -->
	<div class="fixed right-5 bottom-5 z-20">
		{@render toggleThemeButton()}
	</div>
</div>

{#snippet toggleThemeButton()}
	<button
		type="button"
		class="hs-dark-mode-active:hidden hs-dark-mode block rounded-full font-medium text-neutral-200 hover:bg-neutral-800 focus:bg-neutral-800 focus:outline-none"
		data-hs-theme-click-value="dark"
		aria-label="Trocar tema para escuro"
	>
		<span class="group inline-flex size-9 shrink-0 items-center justify-center">
			<span class="icon-[lucide--moon] size-5 shrink-0"></span>
		</span>
	</button>
	<button
		type="button"
		class="hs-dark-mode-active:block hs-dark-mode hidden rounded-full font-medium text-gray-800 hover:bg-gray-200 focus:bg-gray-200 focus:outline-none dark:text-neutral-200 dark:hover:bg-neutral-800 dark:focus:bg-neutral-800"
		data-hs-theme-click-value="light"
		aria-label="Trocar tema para claro"
	>
		<span class="group inline-flex size-9 shrink-0 items-center justify-center">
			<span class="icon-[lucide--sun] size-5 shrink-0"></span>
		</span>
	</button>
{/snippet}

{#snippet scrollBar()}
	<div
		class="size-full overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500 [&::-webkit-scrollbar-track]:bg-gray-100 dark:[&::-webkit-scrollbar-track]:bg-neutral-700"
	>
		{@render children()}
	</div>
{/snippet}
