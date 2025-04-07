<script lang="ts">
	import Header from '$lib/client/components/auth/Header.svelte'
	import Label from '$lib/client/components/auth/Label.svelte'
	import Input from '$lib/client/components/auth/Input.svelte'
	import Button from '$lib/client/components/auth/Button.svelte'
	import Link from '$lib/client/components/auth/Link.svelte'
	import Divider from '$lib/client/components/auth/Divider.svelte'
</script>

<!-- Header -->
<Header icon="icon-[lucide--user-round-plus]" title="Criar conta" description="Crie sua conta e comece a usar." />

<!-- Container -->
<div class="mt-10 text-base text-neutral-600 dark:text-neutral-200">
	<!-- Form -->
	<form>
		<fieldset class="grid gap-5">
			<div>
				<Label htmlFor="name">Nome</Label>
				<Input type="text" id="name" name="name" autocomplete="name" placeholder="Fulano" required isInvalid={false} invalidMessage="Digite um nome válido." />
			</div>
			<div>
				<Label htmlFor="email">E-mail</Label>
				<Input type="email" id="email" name="email" autocomplete="email" placeholder="seuemail@inpe.br" required isInvalid={false} invalidMessage="Digite um e-mail válido." />
			</div>
			<div>
				<Label htmlFor="hs-strong-password-with-indicator-and-hint">Senha</Label>
				<Input
					type="strong-password"
					id="hs-strong-password-with-indicator-and-hint"
					name="password"
					autocomplete="current-password"
					required
					isInvalid={false}
					invalidMessage="Digite uma senha válida."
					placeholder="••••••••"
				/>
			</div>
			<div>
				<Button type="submit">Criar conta</Button>
			</div>
			<Divider>ou</Divider>
			<div class="flex w-full flex-col items-center justify-center gap-3">
				<Button type="button" icon="icon-[logos--google-icon]">Criar com Google</Button>
				<Button type="button" icon="icon-[logos--facebook]">Criar com Facebook</Button>
			</div>
			<p class="mt-2 text-center">
				Tem uma conta? <Link href="/login">Entre</Link>
			</p>
		</fieldset>
	</form>
</div>
