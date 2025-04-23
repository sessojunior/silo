<script lang="ts">
	import { onMount } from 'svelte'
	import { enhance } from '$app/forms'
	import { toast } from '$lib/client/utils/toast'

	let { image } = $props()

	let fileInput: HTMLInputElement
	let submitButton: HTMLButtonElement

	let previewUrl: string | null = $state(null)
	let isInvalid = $state(false)
	let invalidMessage = $state('')

	// Define a imagem inicial após a montagem para evitar erros em tempo de compilação
	onMount(() => {
		previewUrl = image ? `${image}?timestamp=${Date.now()}` : null
	})

	// Função que envia o arquivo e atualiza a imagem de perfil
	function handleFileChange(event: Event) {
		const input = event.target as HTMLInputElement
		const file = input.files?.[0]

		if (file) {
			const reader = new FileReader()
			reader.onload = (e) => {
				previewUrl = e.target?.result as string
				// Dispara o clique no botão de submit
				submitButton.click()
			}
			reader.readAsDataURL(file)
		} else {
			previewUrl = null
		}
	}

	// Função que apaga a imagem de perfil
	async function deleteProfileImage() {
		const formData = new FormData()
		formData.append('intent', 'delete-profile-image')

		const res = await fetch('?/delete-profile-image', {
			method: 'POST',
			body: formData
		})

		if (res.ok) {
			previewUrl = null
			fileInput.value = ''
			isInvalid = false
			toast({
				title: 'Imagem de perfil removida com sucesso!',
				icon: 'icon-[lucide--trash-2]',
				type: 'success',
				duration: 10000,
				position: 'bottom-right'
			})
		} else {
			const { message } = await res.json()
			invalidMessage = message ?? 'Erro ao apagar imagem.'
			isInvalid = true
			toast({
				title: invalidMessage,
				icon: 'icon-[lucide--triangle-alert]',
				type: 'error',
				duration: 10000,
				position: 'bottom-right'
			})
		}
	}

	// Função que limpa o input de arquivo
	function clearFile() {
		if (fileInput) fileInput.value = ''
		previewUrl = null
	}
</script>

<form
	class="flex w-full"
	method="post"
	action="?/upload-profile-image"
	enctype="multipart/form-data"
	use:enhance={() => {
		return async ({ update, result }) => {
			await update()

			if (result.type === 'success') {
				isInvalid = false
				toast({
					title: 'Imagem de perfil atualizada com sucesso!',
					icon: 'icon-[lucide--circle-check]',
					type: 'success',
					duration: 10000,
					position: 'bottom-right'
				})
			} else if (result.type === 'failure') {
				isInvalid = true
				invalidMessage = (result.data as any).message ?? 'Erro ao atualizar imagem de perfil.'
				previewUrl = image ? `${image}?timestamp=${Date.now()}` : null
				toast({
					title: invalidMessage,
					icon: 'icon-[lucide--triangle-alert]',
					type: 'error',
					duration: 10000,
					position: 'bottom-right'
				})
			}
		}
	}}
>
	<div class="flex w-full gap-4">
		<div class="flex items-center justify-center">
			<!-- Preview -->
			<button
				type="button"
				onclick={() => fileInput.click()}
				aria-label="Alterar imagem de perfil"
				class="group relative flex size-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-zinc-300 bg-zinc-100 transition duration-200 hover:border-zinc-400 hover:bg-zinc-200 hover:ring-2 hover:ring-zinc-300"
			>
				{#if previewUrl}
					<img
						src={previewUrl}
						onerror={() => (previewUrl = null)}
						alt="Preview da imagem"
						class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
					/>
				{:else}
					<span class="icon-[lucide--circle-user-round] size-9 text-zinc-400 transition-colors duration-200 group-hover:text-zinc-500"></span>
				{/if}
			</button>
		</div>
		<div class="flex flex-col justify-center gap-2">
			<div class="block font-semibold {isInvalid ? 'text-red-500' : ''}">Foto de perfil</div>
			<!-- Botões -->
			<div class="flex gap-2">
				<!-- Botão de alterar -->
				<button
					type="button"
					class="inline-flex items-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
					onclick={() => fileInput.click()}
				>
					<span class="icon-[lucide--upload] size-4"></span>
					Alterar
				</button>

				<!-- Botão de apagar -->
				<button
					type="button"
					class="inline-flex items-center gap-x-2 rounded-lg border border-transparent bg-white px-3 py-2 text-xs font-medium text-zinc-600 hover:border-zinc-200 hover:bg-zinc-100"
					onclick={deleteProfileImage}
				>
					<span class="icon-[lucide--trash] size-4"></span>
					Apagar
				</button>
			</div>
			{#if isInvalid}
				<p class="mt-1 text-xs text-red-500">{invalidMessage}</p>
			{:else}
				<p class="mt-1 text-xs text-zinc-400">Formatos aceitos: JPEG, PNG e WEBP.</p>
			{/if}
		</div>

		<!-- Campo de input real (oculto) -->
		<input bind:this={fileInput} type="file" name="fileToUpload" accept="image/png, image/jpeg, image/webp" class="hidden" onchange={handleFileChange} />

		<!-- Botão de submit (será disparado pelo handleFileChange) -->
		<button bind:this={submitButton} type="submit" style="display: none;">Submeter</button>
	</div>
</form>
