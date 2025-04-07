<script lang="ts">
	import Header from '$lib/client/components/auth/Header.svelte'
	import Label from '$lib/client/components/auth/Label.svelte'
	import Input from '$lib/client/components/auth/Input.svelte'
	import Button from '$lib/client/components/auth/Button.svelte'
	import Link from '$lib/client/components/auth/Link.svelte'
</script>

<!-- Header -->
<Header icon="icon-[lucide--key-round]" title="Esqueceu a senha" description="Não se preocupe, iremos te ajudar a recuperar sua senha." />

<!-- Container -->
<div class="mt-10 text-base text-neutral-600 dark:text-neutral-200">
	<!-- Form -->
	<form>
		<fieldset class="grid gap-5">
			<div>
				<Label htmlFor="email">E-mail</Label>
				<Input type="email" id="email" name="email" autocomplete="email" placeholder="seuemail@inpe.br" required isInvalid={false} invalidMessage="Digite um e-mail válido." />
			</div>
			<div>
				<Button type="submit">Enviar instruções</Button>
			</div>
			<p class="mt-2 text-center">
				<Link href="/login">Voltar</Link>
			</p>
		</fieldset>
	</form>
</div>
