<script lang="ts">
	import { enhance } from '$app/forms'
	import type { PageProps } from './$types'

	import Header from '$lib/client/components/auth/Header.svelte'
	import Label from '$lib/client/components/auth/Label.svelte'
	import Input from '$lib/client/components/auth/Input.svelte'
	import Button from '$lib/client/components/auth/Button.svelte'
	import Link from '$lib/client/components/auth/Link.svelte'
	import Divider from '$lib/client/components/auth/Divider.svelte'
	import Pin from '$lib/client/components/auth/Pin.svelte'
	import Alert from '$lib/client/components/auth/Alert.svelte'

	let { form }: PageProps = $props()

	let loading = $state(false)
	let step = $state(1)
	let email = $state('')
</script>

<!-- Header -->
{#if step === 1}
	<Header icon="icon-[lucide--user-round-plus]" title="Criar conta" description="Preencha os dados abaixo para criar sua conta e começar a usar." />
{:else if step === 2}
	<Header icon="icon-[lucide--square-asterisk]" title="Verifique a conta" description="Precisamos verificar seu e-mail, insira o código que recebeu por e-mail." />
{/if}

<!-- Container -->
<div class="mt-10 text-base text-zinc-600 dark:text-zinc-200">
	<!-- Etapa 1: Inserir os dados para criar a conta -->
	{#if step === 1}
		<form
			method="post"
			action="?/register"
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
					<Alert message={form.message} />
				{/if}
				<div>
					<Label htmlFor="name" isInvalid={form?.field === 'name'}>Nome</Label>
					<Input type="text" id="name" name="name" autocomplete="name" placeholder="Fulano" required isInvalid={form?.field === 'name'} invalidMessage={form?.message} />
				</div>
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
						isInvalid={form?.field === 'email'}
						invalidMessage={form?.message}
					/>
				</div>
				<div>
					<Label htmlFor="hs-strong-password-with-indicator-and-hint" isInvalid={form?.field === 'password'}>Senha</Label>
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
				<div>
					<Button type="submit" disabled={loading}>
						{#if loading}
							<span class="icon-[lucide--loader-circle] animate-spin"></span>
							Criando conta...
						{:else}
							Criar conta
						{/if}
					</Button>
				</div>
				<Divider>ou</Divider>
				<div class="flex w-full flex-col items-center justify-center gap-3">
					<Button href="/sign-in/google" type="button" style="bordered" icon="icon-[logos--google-icon]">Criar com Google</Button>
				</div>
				<p class="mt-2 text-center">
					Tem uma conta? <Link href="/sign-in">Entre</Link>.
				</p>
			</fieldset>
		</form>
	{/if}

	<!-- Etapa 2: Se o e-mail do usuário não estiver verificado, envia o código OTP para verificar o e-mail -->
	{#if step === 2}
		<form
			method="post"
			action="?/send-code"
			use:enhance={() => {
				loading = true
				return async ({ update }) => {
					await update()
					loading = false
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
</div>
