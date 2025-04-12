<script lang="ts">
	let { children } = $props()

	const logo = { image: '/images/logo.png', title: 'Silo' }
</script>

<div class="flex min-h-screen justify-between">
	<div
		class="h-screen w-full before:absolute before:start-1/2 before:top-0 before:-z-1 before:size-full before:-translate-x-1/2 before:transform before:bg-[url('/images/background-home.svg')] before:bg-cover before:bg-top before:bg-no-repeat md:w-1/2 md:max-w-[600px] dark:bg-neutral-900"
	>
		<div class="scrollbar size-full overflow-y-auto">
			<div class="flex h-full w-full flex-col">
				<div class="flex">
					<div class="flex items-center justify-center gap-2 px-10 pt-10">
						{#if logo.image}
							<img src={logo.image} alt="Logo" class="block h-12 w-12" />
						{/if}
						{#if logo.title}
							<div class="inline-block text-3xl font-bold text-neutral-600 dark:text-neutral-200">{logo.title}</div>
						{/if}
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
		<img src="/images/background-auth.png" alt="Fundo" class="size-full h-screen object-cover" />
	</div>

	<!-- Toogle dark/light mode -->
	<div class="fixed right-5 bottom-5 z-20">
		<button
			type="button"
			class="hs-dark-mode-active:hidden hs-dark-mode block font-medium text-neutral-200 focus:outline-none"
			data-hs-theme-click-value="dark"
			aria-label="Trocar tema para escuro"
		>
			<span class="group inline-flex size-9 shrink-0 items-center justify-center">
				<span class="icon-[lucide--moon] size-5 shrink-0"></span>
			</span>
		</button>
		<button
			type="button"
			class="hs-dark-mode-active:block hs-dark-mode hidden font-medium text-neutral-800 focus:outline-none dark:text-neutral-200"
			data-hs-theme-click-value="light"
			aria-label="Trocar tema para claro"
		>
			<span class="group inline-flex size-9 shrink-0 items-center justify-center">
				<span class="icon-[lucide--sun] size-5 shrink-0"></span>
			</span>
		</button>
	</div>
</div>
