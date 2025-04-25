<script lang="ts">
	import { changeTheme } from '$lib/client/utils/changeTheme'

	// Tema inicial
	let theme = 'light'

	// Função para alterar o tema
	async function handleChangeTheme(newTheme: string) {
		// Chama a função de utilitário para mudar o tema
		theme = await changeTheme(newTheme)
	}
</script>

<div>
	<button
		type="button"
		class="hs-dark-mode-active:block hs-dark-mode hidden rounded-full font-medium text-zinc-100 transition-all duration-500 hover:bg-zinc-700 focus:bg-zinc-100 focus:outline-none dark:text-zinc-400"
		data-hs-theme-click-value="light"
		onclick={() => handleChangeTheme('light')}
	>
		<span class="group inline-flex size-8 shrink-0 items-center justify-center">
			<span class="icon-[lucide--sun] size-4 shrink-0"></span>
		</span>
		<span class="sr-only">Modo claro</span>
	</button>

	<button
		type="button"
		class="hs-dark-mode-active:hidden hs-dark-mode block rounded-full font-medium text-zinc-400 transition-all duration-500 hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800"
		data-hs-theme-click-value="dark"
		onclick={() => handleChangeTheme('dark')}
	>
		<span class="group inline-flex size-8 shrink-0 items-center justify-center">
			<span class="icon-[lucide--moon] size-4 shrink-0"></span>
		</span>
		<span class="sr-only">Modo escuro</span>
	</button>
</div>
