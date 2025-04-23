<script lang="ts">
	import { page } from '$app/state'
	import { fade } from 'svelte/transition'

	let { children }: { children: any } = $props()
</script>

<div class="bg-zinc-50 dark:bg-zinc-800">
	<div class="flex w-full flex-shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-700">
		<div
			class="size-full h-[calc(100vh-131px)] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-500 [&::-webkit-scrollbar-track]:bg-zinc-50 dark:[&::-webkit-scrollbar-track]:bg-zinc-700"
		>
			<!-- O bloco {#key} força a recriação e ativa a transição -->
			{#key page.url.pathname}
				<!-- Efeito de transição (fade) ao mudar de página-->
				<div transition:fade={{ duration: 500 }}>
					<div class="flex h-full w-full flex-col items-start justify-start gap-8 p-8 text-zinc-600 dark:text-zinc-200">
						{@render children()}
					</div>
				</div>
			{/key}
		</div>
	</div>
</div>
