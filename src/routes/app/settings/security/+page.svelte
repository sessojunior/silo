<script lang="ts">
	import { enhance } from '$app/forms'
	import type { PageProps } from './$types'

	import Label from '$lib/client/components/ui/Label.svelte'
	import Input from '$lib/client/components/ui/Input.svelte'
	import Alert from '$lib/client/components/ui/Alert.svelte'
	import Button from '$lib/client/components/ui/Button.svelte'

	let { form }: PageProps = $props()

	let loading = $state(false)
</script>

<!-- Cabeçalho -->
<div class="flex w-full">
	<div class="w-full flex-grow">
		<h1 class="text-3xl font-bold tracking-tight">Segurança</h1>
		<p class="mt-1 text-base">Altere seu e-mail de acesso ou sua senha.</p>
	</div>
</div>

<!-- Cartões -->
<div class="flex w-full max-w-7xl gap-8">
	<div class="flex w-1/2 flex-col">
		<div class="mb-8 flex w-full flex-grow flex-col self-start rounded-xl border border-zinc-200 bg-white shadow-2xs">
			<div class="flex items-center rounded-t-xl border-b border-zinc-200 bg-zinc-100 px-6 py-4">
				<h3 class="text-xl font-bold">Alterar seu e-mail</h3>
			</div>
			<div class="flex flex-col gap-4 p-6">
				<form
					class="flex w-full"
					method="post"
					action="?/update-email"
					use:enhance={() => {
						loading = true
						return async ({ update }) => {
							await update()
							loading = false
						}
					}}
				>
					<fieldset class="grid w-full gap-5">
						{#if form?.message && !form?.field}
							<Alert message={form.message} />
						{/if}
						<div class="flex gap-4">
							<div class="w-full">
								<Label htmlFor="email" isInvalid={form?.field === 'email'}>Novo e-mail</Label>
								<Input
									type="email"
									id="email"
									name="email"
									autocomplete="email"
									placeholder="seuemail@inpe.br"
									minlength={8}
									maxlength={255}
									required
									isInvalid={form?.field === 'email'}
									invalidMessage={form?.message}
								/>
							</div>
						</div>
						<div>
							<Button type="submit" disabled={loading} className="w-auto">
								{#if loading}
									<span class="icon-[lucide--loader-circle] animate-spin"></span>
									Salvando...
								{:else}
									Salvar
								{/if}
							</Button>
						</div>
					</fieldset>
				</form>
			</div>
		</div>

		<div class="mb-8 flex w-full flex-grow flex-col self-start rounded-xl border border-zinc-200 bg-white shadow-2xs">
			<div class="flex items-center rounded-t-xl border-b border-zinc-200 bg-zinc-100 px-6 py-4">
				<h3 class="text-xl font-bold">Alterar sua senha</h3>
			</div>
			<div class="flex flex-col gap-4 p-6">
				<form
					class="flex w-full"
					method="post"
					action="?/update-password"
					use:enhance={() => {
						loading = true
						return async ({ update }) => {
							await update()
							loading = false
						}
					}}
				>
					<fieldset class="grid w-full gap-5">
						{#if form?.message && !form?.field}
							<Alert message={form.message} />
						{/if}
						<div class="flex gap-4">
							<div class="w-full">
								<Label htmlFor="email" isInvalid={form?.field === 'email'}>Nova senha</Label>
								<Input
									type="strong-password"
									id="hs-strong-password-with-indicator-and-hint"
									name="password"
									autocomplete="current-password"
									placeholder="••••••••"
									minlength={8}
									maxlength={160}
									required
									isInvalid={form?.field === 'password'}
									invalidMessage={form?.message}
								/>
							</div>
						</div>
						<div>
							<Button type="submit" disabled={loading} className="w-auto">
								{#if loading}
									<span class="icon-[lucide--loader-circle] animate-spin"></span>
									Salvando...
								{:else}
									Salvar
								{/if}
							</Button>
						</div>
					</fieldset>
				</form>
			</div>
		</div>
	</div>

	<div class="mb-8 flex w-1/2 flex-col gap-8">
		<div class="flex w-full flex-col self-start rounded-xl border border-zinc-200 bg-white shadow-2xs">
			<div class="flex items-center rounded-t-xl border-b border-zinc-200 bg-zinc-100 px-6 py-4">
				<h3 class="text-xl font-bold">Informações importantes</h3>
			</div>
			<div class="flex flex-col gap-6">
				<div class="p-6">
					<h3 class="text-lg font-bold tracking-tight text-zinc-600 dark:text-zinc-200">Alterar e-mail</h3>
					<div class="text-base text-zinc-400 dark:text-zinc-200">
						<p class="mt-1">Altere seu e-mail somente se for realmente necessário.</p>
						<p class="mt-1">
							Quando alterar seu e-mail, será enviado um código para seu novo e-mail para confirmação de que ele existe. Você deve digitar esse código no campo correspondente que
							irá aparecer em seguida.
						</p>
					</div>
				</div>
			</div>
			<div class="h-px w-full bg-zinc-200"></div>
			<div class="flex flex-col gap-6">
				<div class="p-6">
					<h3 class="text-lg font-bold tracking-tight text-zinc-600 dark:text-zinc-200">Alterar senha</h3>
					<div class="text-base text-zinc-400 dark:text-zinc-200">
						<p class="mt-1">É bom sempre alterar senha pelo menos uma vez ao ano.</p>
						<p class="mt-1">Crie uma senha forte, se possível única, que contenha de 8 a 12 caracteres, com letras maiúsculas e minúsculas, números e caracteres especiais.</p>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
