<script lang="ts">
	import { onMount } from 'svelte'

	onMount(() => {
		window.HSStaticMethods.autoInit()
	})

	let { url, isInvalid, invalidMessage } = $props()
</script>

<div data-hs-file-upload={JSON.stringify({ url, acceptedFiles: 'image/*', maxFiles: 1, singleton: true })}>
	<template data-hs-file-upload-preview="">
		<div class="size-20">
			<img class="w-full rounded-full object-contain" data-dz-thumbnail="" alt="Imagem" />
		</div>
	</template>

	<div class="flex flex-wrap items-center gap-3 sm:gap-5">
		<div class="group" data-hs-file-upload-previews="" data-hs-file-upload-pseudo-trigger="">
			<span
				class="flex size-20 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-dotted border-zinc-300 text-zinc-400 transition-all duration-500 group-has-[div]:hidden hover:bg-zinc-50"
			>
				<span class="icon-[lucide--circle-user-round] size-7 shrink-0"></span>
			</span>
		</div>
		<div class="flex flex-col">
			<div>
				<span class="mb-2 block font-semibold {isInvalid ? 'text-red-500' : ''}">Foto de perfil</span>
			</div>
			<div class="grow">
				<div class="flex items-center gap-x-2 pb-2">
					<button
						type="button"
						class="inline-flex items-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-all duration-500 hover:bg-blue-700 focus:bg-blue-700 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50"
						data-hs-file-upload-trigger=""
					>
						<span class="icon-[lucide--upload] size-4 shrink-0"></span>
						Alterar
					</button>
					<button
						type="button"
						class="border-zinx-200 inline-flex items-center gap-x-2 rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs font-semibold text-zinc-500 transition-all duration-500 hover:border-zinc-200 hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50"
						data-hs-file-upload-clear="">Apagar</button
					>
				</div>
			</div>
		</div>
	</div>
</div>

{#if isInvalid}
	<p class="dark:text-red-00 mt-2 text-xs text-red-500">{invalidMessage}</p>
{/if}
