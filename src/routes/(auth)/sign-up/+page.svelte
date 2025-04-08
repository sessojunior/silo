<script lang="ts">
	import { enhance, applyAction } from '$app/forms'
	import type { PageProps } from './$types'

	import Header from '$lib/client/components/auth/Header.svelte'
	import Label from '$lib/client/components/auth/Label.svelte'
	import Input from '$lib/client/components/auth/Input.svelte'
	import Button from '$lib/client/components/auth/Button.svelte'
	import Link from '$lib/client/components/auth/Link.svelte'
	import Divider from '$lib/client/components/auth/Divider.svelte'

	let { form }: PageProps = $props()

	let loading = $state(false)
</script>

<!-- Header -->
<Header icon="icon-[lucide--user-round-plus]" title="Criar conta" description="Crie sua conta e comece a usar." />

<!-- Container -->
<div class="mt-10 text-base text-neutral-600 dark:text-neutral-200">
	<!-- Form -->
	<form
		method="post"
		action="?/register"
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
				<Label htmlFor="name" isInvalid={form?.field === 'name'}>Nome</Label>
				<Input type="text" id="name" name="name" autocomplete="name" placeholder="Fulano" required isInvalid={form?.field === 'name'} invalidMessage={form?.message ?? ''} />
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
					invalidMessage={form?.message ?? ''}
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
					minlength={6}
					maxlength={160}
					required
					isInvalid={form?.field === 'password'}
					invalidMessage={form?.message ?? ''}
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
				<Button type="button" icon="icon-[logos--google-icon]">Criar com Google</Button>
				<Button type="button" icon="icon-[logos--facebook]">Criar com Facebook</Button>
			</div>
			<p class="mt-2 text-center">
				Tem uma conta? <Link href="/sign-in">Entre</Link>
			</p>
		</fieldset>
	</form>
</div>
