<script lang="ts">
	import { enhance } from '$app/forms'
	import type { PageProps } from './$types'

	import Header from '$lib/client/components/auth/Header.svelte'
	import Label from '$lib/client/components/auth/Label.svelte'
	import Input from '$lib/client/components/auth/Input.svelte'
	import Button from '$lib/client/components/auth/Button.svelte'
	import Link from '$lib/client/components/auth/Link.svelte'
	import Pin from '$lib/client/components/auth/Pin.svelte'
	import Alert from '$lib/client/components/auth/Alert.svelte'

	let { form }: PageProps = $props()

	let loading = $state(false)
	let step = $state(1)
	let email = $state('')
	let token = $state('')
</script>

<!-- Header -->
{#if step === 1}
	<Header icon="icon-[lucide--key-round]" title="Esqueceu a senha" description="Não se preocupe, iremos te ajudar a recuperar sua senha." />
{:else if step === 2}
	<Header icon="icon-[lucide--square-asterisk]" title="Verifique a conta" description="Para sua segurança, insira o código que recebeu por e-mail." />
{:else if step === 3}
	<Header icon="icon-[lucide--lock]" title="Redefinir a senha" description="Agora você precisa digitar a nova senha para sua conta." />
{:else if step === 4}
	<Header icon="icon-[lucide--lock-keyhole]" title="Senha alterada" description="A sua senha foi alterada com sucesso! Volte para continuar." />
{/if}

<!-- Container -->
<div class="mt-10 text-base text-neutral-600 dark:text-neutral-200">
	<!-- Etapa 1: Inserir e-mail para enviar o código OTP para o e-mail -->
	{#if step === 1}
		<form
			method="post"
			action="?/send-email"
			use:enhance={() => {
				loading = true
				return async ({ update }) => {
					await update()
					loading = false
					step = form?.step ?? 1
					email = form?.email ?? ''
				}
			}}
		>
			<fieldset class="grid gap-5">
				{#if form?.message && !form?.field}
					<Alert message={form?.message} />
				{/if}
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
						autofocus
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
	{/if}

	<!-- Etapa 2: Enviar código OTP para verificar se está correto -->
	{#if step === 2}
		<form
			method="post"
			action="?/send-code"
			use:enhance={() => {
				loading = true
				return async ({ update }) => {
					await update()
					loading = false
					step = form?.step ?? 2
					token = form?.token ?? ''
				}
			}}
		>
			<fieldset class="grid gap-5">
				{#if form?.message && !form?.field}
					<Alert message={form?.message} />
				{/if}
				<input type="hidden" name="email" value={email} />
				<div>
					<Label htmlFor="code" isInvalid={form?.field === 'code'}>Código que recebeu por e-mail</Label>
					<Pin type="text" id="code" name="code" placeholder="" length="5" value="" isInvalid={form?.field === 'code'} invalidMessage={form?.message ?? ''} />
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
	{/if}

	<!-- Etapa 3: Enviar nova senha para alteração -->
	{#if step === 3}
		<form
			method="post"
			action="?/send-password"
			use:enhance={() => {
				loading = true
				return async ({ update }) => {
					await update()
					loading = false
					step = form?.step ?? 3
				}
			}}
		>
			<fieldset class="grid gap-5">
				{#if form?.message && !form?.field}
					<Alert message={form?.message} />
				{/if}
				<input type="hidden" name="token" value={token} />
				<div>
					<Label htmlFor="hs-strong-password-with-indicator-and-hint" isInvalid={form?.field === 'password'}>Nova senha</Label>
					<Input
						type="strong-password"
						id="hs-strong-password-with-indicator-and-hint"
						name="password"
						autocomplete="current-password"
						placeholder="••••••••"
						minlength={8}
						maxlength={160}
						required
						autofocus
						isInvalid={form?.field === 'password'}
						invalidMessage={form?.message ?? ''}
					/>
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
	{/if}

	<!-- Etapa 4: Senha alterada com sucesso -->
	{#if step === 4}
		<div class="grid gap-5">
			{#if form?.message && !form?.field}
				<Alert message={form?.message} />
			{/if}
			<div>
				<Button href="/app/welcome" type="button">Ir para o painel</Button>
			</div>
			<p class="mt-2 text-center">
				<Link href="/sign-in">Voltar</Link>
			</p>
		</div>
	{/if}
</div>
