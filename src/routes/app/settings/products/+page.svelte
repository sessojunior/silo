<script lang="ts">
	import { enhance } from '$app/forms'
	import type { PageProps } from './$types'

	import { toast } from '$lib/client/utils/toast'

	import Label from '$lib/client/components/ui/Label.svelte'
	import Input from '$lib/client/components/ui/Input.svelte'
	import Button from '$lib/client/components/ui/Button.svelte'

	let { data, form }: PageProps = $props()
	let loading = $state(false)
</script>

<!-- Cabeçalho -->
<div class="flex w-full">
	<div class="w-full flex-grow">
		<h1 class="text-3xl font-bold tracking-tight">Produtos & tasks</h1>
		<p class="mt-1 text-base">Adicione, altere ou remova produtos e tasks.</p>
	</div>
</div>

<!-- Cartões -->
<div class="flex w-full max-w-7xl gap-8">
	<div class="flex flex-grow flex-col self-start rounded-xl border border-zinc-200 bg-white shadow-2xs">
		<div class="flex items-center rounded-t-xl border-b border-zinc-200 bg-zinc-100 px-6 py-4">
			<h3 class="text-xl font-bold">Lista de produtos</h3>
		</div>
		<div class="flex flex-col gap-4 p-6">
			<p>Lista de produtos e tasks aqui.</p>
		</div>
	</div>

	<div class="flex flex-col gap-8">
		<div class="flex w-96 flex-col self-start rounded-xl border border-zinc-200 bg-white shadow-2xs">
			<div class="flex items-center rounded-t-xl border-b border-zinc-200 bg-zinc-100 px-6 py-4">
				<h3 class="text-xl font-bold">Adicionar produto</h3>
			</div>
			<div class="flex flex-col gap-4 p-6">
				<form
					class="flex w-full"
					method="post"
					action="?/create-product"
					use:enhance={() => {
						loading = true
						return async ({ update, result }) => {
							await update()
							loading = false

							if (result.type === 'success') {
								toast({
									title: 'O produto foi cadastrado com sucesso!',
									icon: 'icon-[lucide--circle-check]',
									type: 'success',
									duration: 10000,
									position: 'bottom-right'
								})
							} else if (result.type === 'failure') {
								toast({
									title: (result.data as any).message ?? 'Erro desconhecido ao enviar os dados.',
									icon: 'icon-[lucide--triangle-alert]',
									type: 'error',
									duration: 10000,
									position: 'bottom-right'
								})
							}
						}
					}}
				>
					<fieldset class="grid w-full gap-5">
						<div>
							<Label htmlFor="name" isInvalid={form?.field === 'name'}>Nome</Label>
							<Input
								type="text"
								id="name"
								name="name"
								autocomplete="name"
								placeholder="Fulano"
								value=""
								required
								isInvalid={form?.field === 'name'}
								invalidMessage={form?.message}
							/>
						</div>
						<div>
							<Button type="submit" disabled={loading} className="w-auto">
								{#if loading}
									<span class="icon-[lucide--loader-circle] animate-spin"></span>
									Aguarde...
								{:else}
									Cadastrar
								{/if}
							</Button>
						</div>
					</fieldset>
				</form>
			</div>
		</div>
	</div>
</div>
