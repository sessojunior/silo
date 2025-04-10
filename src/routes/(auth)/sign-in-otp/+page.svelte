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
	<Header icon="icon-[lucide--log-in]" title="Entrar" description="Entre para começar a usar." />
{:else if step === 2}
	<Header icon="icon-[lucide--square-asterisk]" title="Verifique a conta" description="Precisamos verificar seu e-mail, insira o código que recebeu por e-mail." />
{/if}

<!-- Container -->
<div class="mt-10 text-base text-neutral-600 dark:text-neutral-200">
	<!-- Etapa 1: Inserir o e-mail para fazer login -->
	{#if step === 1}
		<form
			method="post"
			action="?/login"
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
						invalidMessage={form?.message}
					/>
				</div>
				<div>
					<Button type="submit" disabled={loading}>
						{#if loading}
							<span class="icon-[lucide--loader-circle] animate-spin"></span>
							Entrando...
						{:else}
							Entrar
						{/if}
					</Button>
				</div>
				<Divider>ou</Divider>
				<div class="flex w-full flex-col items-center justify-center gap-3">
					<Button href="/sign-in" type="button" style="bordered" icon="icon-[lucide--log-in]">Entrar com e-mail e senha</Button>
					<Button type="button" style="bordered" icon="icon-[logos--google-icon]">Entrar com Google</Button>
					<Button type="button" style="bordered" icon="icon-[logos--facebook]">Entrar com Facebook</Button>
				</div>
				<p class="mt-2 text-center">
					Não tem conta? <Link href="/sign-up">Cadastre-se</Link>
				</p>
			</fieldset>
		</form>
	{/if}

	<!-- Etapa 2: Enviar o código OTP para fazer login -->
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
					<Pin type="text" id="code" name="code" placeholder="" length="5" value="" isInvalid={form?.field === 'code'} invalidMessage={form?.message} />
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
