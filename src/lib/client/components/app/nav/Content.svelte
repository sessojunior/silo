<script lang="ts">
	import { page } from '$app/state'
	import { fly } from 'svelte/transition'

	let { children } = $props()
</script>

<div class="bg-zinc-50 dark:bg-zinc-800">
	<div class="flex w-full flex-shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-700">
		<div class="scrollbar size-full h-[calc(100vh-131px)] overflow-y-auto">
			<!-- O bloco {#key} força a recriação e ativa a transição -->
			{#key page.url.pathname}
				<!-- Efeito de transição ao mudar de página-->
				<div in:fly={{ x: -500, duration: 500 }}>
					{@render children()}
				</div>
			{/key}
		</div>
	</div>
</div>
