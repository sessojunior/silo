<script lang="ts"></script>

<!-- Header -->
{@render header({
	icon: 'icon-[lucide--key-round]',
	title: 'Esqueceu a senha',
	paragraph: 'Não se preocupe, iremos te ajudar a recuperar sua senha.'
})}

<!-- Form -->
<form class="mt-10">
	<fieldset class="grid gap-5">
		<div>
			<label for="email" class="mb-2 block text-sm dark:text-white">E-mail</label>
			<div class="relative">
				<input
					type="email"
					id="email"
					name="email"
					placeholder="email@inpe.br"
					autocomplete="email"
					required
					aria-describedby="email-error"
					class="block w-full rounded-lg border-red-500 px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600"
				/>
				<div class="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3">
					<span class="icon-[lucide:info] size-4 text-red-600"></span>
				</div>
			</div>
			<p class="mt-2 text-xs text-red-600" id="email-error">Digite um e-mail válido.</p>
		</div>
		<div>
			<button
				type="submit"
				class="inline-flex w-full items-center justify-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 focus:bg-blue-700 focus:outline-none disabled:pointer-events-none disabled:opacity-50"
				>Enviar instruções
			</button>
		</div>
	</fieldset>
</form>
<p class="mt-8 text-center text-sm">
	<a
		href="/login"
		class="text-primary font-semibold underline-offset-2 hover:underline dark:text-white"
		>Voltar e entrar</a
	>
</p>

{#snippet header({ icon, title, paragraph }: any)}
	<div
		class="mx-auto mb-4 flex size-14 items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-700 dark:text-white"
	>
		<span class="{icon} size-6"></span>
	</div>
	<h1 class="text-center text-3xl font-bold tracking-tight dark:text-white">{title}</h1>
	<p class="mt-1 text-center text-sm dark:text-white">
		{paragraph}
	</p>
{/snippet}
