<script lang="ts">
	let { children } = $props()
</script>

<div class="flex min-h-screen justify-between bg-white dark:bg-neutral-900">
	<div class="h-screen w-full md:w-1/2 md:max-w-[600px]">
		<div class="scrollbar size-full overflow-y-auto">
			<div class="flex h-full w-full flex-col">
				<div class="flex">
					<div class="flex items-center justify-center gap-2 px-10 pt-10">
						<img src="/images/logo.png" alt="Logo" class="block h-8 w-8" />
						<div class="inline-block pt-0.5 text-2xl font-bold dark:text-white">Silo</div>
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
