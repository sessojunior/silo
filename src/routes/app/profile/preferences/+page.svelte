<script lang="ts">
	import { enhance } from '$app/forms'
	import type { PageProps } from './$types'

	import { toast } from '$lib/client/utils/toast'

	import Select from '$lib/client/components/ui/Select.svelte'
	import Switch from '$lib/client/components/ui/Switch.svelte'
	import Button from '$lib/client/components/ui/Button.svelte'

	let { data, form }: PageProps = $props()
	let loading = $state(false)
</script>

<!-- Cabeçalho -->
<div class="flex w-full justify-between">
	<div class="w-full flex-grow">
		<h1 class="text-3xl font-bold tracking-tight">Preferências</h1>
		<p class="mt-1 text-base">Altere suas perferências no sistema.</p>
	</div>
</div>

<!-- Cartões -->
<div class="flex w-full max-w-7xl gap-8">
	<div class="flex flex-grow flex-col self-start rounded-xl border border-zinc-200 bg-white shadow-2xs">
		<div class="flex items-center rounded-t-xl border-b border-zinc-200 bg-zinc-50 px-6 py-4">
			<h3 class="text-xl font-bold">Permissões gerais</h3>
		</div>
		<form
			class="flex flex-col gap-6 p-6"
			method="post"
			action="?/update-preferences"
			use:enhance={() => {
				loading = true
				return async ({ update, result }) => {
					await update()
					loading = false

					if (result.type === 'success') {
						toast({
							title: 'Suas preferências	foram alteradas com sucesso!',
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
			<Switch
				id="notify-updates"
				name="notifyUpdates"
				checked={data.notifyUpdates}
				size="lg"
				title="Notificar quando houver novas atualizações"
				description="Notifique-me quando houver novas atualizações no sistema ou novas versões."
				isInvalid={form?.field === 'notifyUpdates'}
				invalidMessage={form?.message}
			/>
			<Switch
				id="send-newsletters"
				name="sendNewsletters"
				checked={data.sendNewsletters}
				size="lg"
				title="Enviar e-mails semanalmente"
				description="Enviar e-mails semanalmente com novidades e atualizações."
				isInvalid={form?.field === 'sendNewsletters'}
				invalidMessage={form?.message}
			/>
			<div class="flex items-center justify-between">
				<div>
					<h3 class="text-lg font-bold tracking-tight text-zinc-600 dark:text-zinc-200">Tema padrão do sistema</h3>
					<p class="mt-1 text-base text-zinc-400 dark:text-zinc-600">Alterne entre o tema claro e escuro.</p>
				</div>
				<div>
					<Select
						name="theme"
						selected={data.theme}
						placeholder="Selecione..."
						options={[
							{ label: 'Claro', value: 'light' },
							{ label: 'Escuro', value: 'dark' }
						]}
						isInvalid={form?.field === 'location'}
						invalidMessage={form?.message}
					/>
				</div>
			</div>
			<div>
				<Button type="submit" disabled={loading} className="w-auto">
					{#if loading}
						<span class="icon-[lucide--loader-circle] animate-spin"></span>
						Aguarde...
					{:else}
						Salvar
					{/if}
				</Button>
			</div>
		</form>
	</div>

	<div class="flex flex-col gap-8">
		<div class="flex w-96 flex-col self-start rounded-xl border border-zinc-200 bg-white shadow-2xs">
			<div class="flex items-center rounded-t-xl border-b border-zinc-200 bg-zinc-100 px-6 py-4">
				<h3 class="text-xl font-bold">Recomendações</h3>
			</div>
			<div class="flex flex-col gap-6">
				<div class="p-6">
					<h3 class="text-lg font-bold tracking-tight text-zinc-600 dark:text-zinc-200">Alterar senha</h3>
					<p class="mt-1 text-base text-zinc-400 dark:text-zinc-200">Sua senha não é alterada há 605 dias. É recomendável alterar a senha para manter sua conta segura.</p>
					<div class="mt-4">
						<button
							type="button"
							class="border-zinx-200 inline-flex items-center gap-x-2 rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs font-semibold text-zinc-600 transition-all duration-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 focus:bg-zinc-100 focus:outline-hidden disabled:pointer-events-none disabled:opacity-75"
							>Ir para segurança</button
						>
					</div>
				</div>
			</div>
			<div class="h-px w-full bg-zinc-200"></div>
			<div class="flex flex-col gap-6">
				<div class="p-6">
					<h3 class="text-lg font-bold tracking-tight text-zinc-600 dark:text-zinc-200">Adicionar produtos</h3>
					<p class="mt-1 text-base text-zinc-400 dark:text-zinc-200">
						Você ainda não adicionou nenhum produto para monitoramento. É recomendável adicionar ao menos algum produto.
					</p>
					<div class="mt-4">
						<button
							type="button"
							class="border-zinx-200 inline-flex items-center gap-x-2 rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs font-semibold text-zinc-600 transition-all duration-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 focus:bg-zinc-100 focus:outline-hidden disabled:pointer-events-none disabled:opacity-75"
							>Adicionar produto</button
						>
					</div>
				</div>
			</div>
			<div class="h-px w-full bg-zinc-200"></div>
			<div class="flex flex-col gap-6">
				<div class="p-6">
					<h3 class="text-lg font-bold tracking-tight text-zinc-600 dark:text-zinc-200">Adicionar projetos</h3>
					<p class="mt-1 text-base text-zinc-400 dark:text-zinc-200">
						Você ainda não adicionou nenhum projeto para monitoramento. É recomendável adicionar ao menos algum projeto.
					</p>
					<div class="mt-4">
						<button
							type="button"
							class="border-zinx-200 inline-flex items-center gap-x-2 rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs font-semibold text-zinc-600 transition-all duration-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 focus:bg-zinc-100 focus:outline-hidden disabled:pointer-events-none disabled:opacity-75"
							>Adicionar projeto</button
						>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
