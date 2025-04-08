<script lang="ts">
	import { enhance, applyAction } from '$app/forms'
	import type { PageProps } from './$types'

	import Header from '$lib/client/components/auth/Header.svelte'
	import Label from '$lib/client/components/auth/Label.svelte'
	import Input from '$lib/client/components/auth/Input.svelte'
	import Button from '$lib/client/components/auth/Button.svelte'
	import Link from '$lib/client/components/auth/Link.svelte'

	let { form }: PageProps = $props()

	let loading = $state(false)
	let step = $state(1)

	let email = $state('')
</script>

<!-- Header -->
{#if step === 1}
	<Header icon="icon-[lucide--key-round]" title="Esqueceu a senha" description="Não se preocupe, iremos te ajudar a recuperar sua senha." />
{:else if step === 2}
	<Header icon="icon-[lucide--key-round]" title="Verifique a conta" description="Para sua segurança, insira o código que recebeu por e-mail." />
{:else if step === 3}
	<Header icon="icon-[lucide--key-round]" title="Redefinir a senha" description="Agora você precisa digitar a nova senha para sua conta." />
{:else if step === 4}
	<Header icon="icon-[lucide--key-round]" title="Senha alterada" description="A sua senha foi alterada com sucesso! Volte para continuar." />
{/if}

<!-- Container -->
<div class="mt-10 text-base text-neutral-600 dark:text-neutral-200">
	{#if step === 1}
		<!-- Form -->
		<form
			method="post"
			action="?/send-email"
			use:enhance={(formElement) => {
				loading = true
				return async ({ result }) => {
					loading = false
					// Se etapa é igual a 2
					if (result.type === 'success' && typeof result.data?.step === 'number') {
						step = result.data.step
					}
					await applyAction(result) // Não invalida os dados de resposta
				}
			}}
		>
			<fieldset class="grid gap-5">
				<div>
					<Label htmlFor="email" isInvalid={form?.field === 'email'}>E-mail</Label>
					<Input
						type="email"
						id="email"
						name="email"
						autocomplete="email"
						placeholder="seuemail@inpe.br"
						minlength={8}
						maxlength={255}
						required
						bind:value={email}
						isInvalid={form?.field === 'email'}
						invalidMessage={form?.message ?? ''}
					/>
				</div>
				<div>
					<Button type="submit" disabled={loading}>
						{#if loading}
							<span class="icon-[lucide--loader-circle] animate-spin"></span>
							Enviando...
						{:else}
							Enviar instruções
						{/if}
					</Button>
				</div>
				<p class="mt-2 text-center">
					<Link href="/sign-in">Voltar</Link>
				</p>
			</fieldset>
		</form>
	{:else if step === 2}
		<!-- Form -->
		<form
			method="post"
			action="?/send-code"
			use:enhance={(formElement) => {
				loading = true
				return async ({ result }) => {
					loading = false
					await applyAction(result) // Não invalida os dados de resposta
				}
			}}
		>
			<fieldset class="grid gap-5">
				<div>
					<input type="hidden" name="email" value={email} />
					<Label htmlFor="code" isInvalid={form?.field === 'code'}>Código que recebeu por e-mail</Label>
					<Input
						type="text"
						id="code"
						name="code"
						autocomplete="one-time-code"
						placeholder="00000000"
						minlength={8}
						maxlength={8}
						required
						isInvalid={form?.field === 'code'}
						invalidMessage={form?.message ?? ''}
					/>
				</div>
				<div>
					<Button type="submit" disabled={loading}>
						{#if loading}
							<span class="icon-[lucide--loader-circle] animate-spin"></span>
							Enviando...
						{:else}
							Enviar código
						{/if}
					</Button>
				</div>
				<p class="mt-2 text-center">
					<Link href="/sign-in">Voltar</Link>
				</p>
			</fieldset>
		</form>
	{:else if step === 3}
		<!-- Form -->
		<form
			method="post"
			action="?/reset-password"
			use:enhance={(formElement) => {
				loading = true
				return async ({ result }) => {
					loading = false
					await applyAction(result) // Não invalida os dados de resposta
				}
			}}
		>
			<fieldset class="grid gap-5">
				<div>
					<input type="hidden" name="token" value={''} />
					Token recebido e campos para alterar a senha
				</div>
				<div>
					<Button type="submit" disabled={loading}>
						{#if loading}
							<span class="icon-[lucide--loader-circle] animate-spin"></span>
							Redefinindo...
						{:else}
							Redefinir senha
						{/if}
					</Button>
				</div>
				<p class="mt-2 text-center">
					<Link href="/sign-in">Voltar</Link>
				</p>
			</fieldset>
		</form>
	{:else if step === 4}
		<!-- Form -->
		<form
			method="post"
			action="?/reset-password"
			use:enhance={(formElement) => {
				loading = true
				return async ({ result }) => {
					loading = false
					await applyAction(result) // Não invalida os dados de resposta
				}
			}}
		>
			<fieldset class="grid gap-5">
				<p class="mt-2 text-center">
					<Link href="/sign-in">Voltar</Link>
				</p>
			</fieldset>
		</form>
	{/if}
</div>
