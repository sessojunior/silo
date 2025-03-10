<script lang="ts"></script>

<!-- Header -->
{@render header({
	icon: 'icon-[lucide--user-round-plus]',
	title: 'Criar conta',
	paragraph: 'Crie uma conta e comece a usar.'
})}

<!-- Form -->
<form class="mt-10">
	<fieldset class="grid gap-5">
		<div>
			<label for="name" class="mb-2 block text-sm dark:text-white">Nome</label>
			<div class="relative">
				<input
					type="text"
					id="name"
					name="name"
					placeholder="Fulano"
					autocomplete="name"
					required
					aria-describedby="name-error"
					class="block w-full rounded-lg border-neutral-200 px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600"
				/>
				<div class="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3">
					<span class="icon-[lucide--info] size-4 text-red-600"></span>
				</div>
			</div>
			<p class="mt-2 hidden text-xs text-red-600" id="email-error">Digite um nome válido.</p>
		</div>
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
					class="block w-full rounded-lg border-neutral-200 px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600"
				/>
				<div class="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3">
					<span class="icon-[lucide--info] size-4 text-red-600"></span>
				</div>
			</div>
			<p class="mt-2 hidden text-xs text-red-600" id="email-error">Digite um e-mail válido.</p>
		</div>

		<!-- Strong Password -->
		<div>
			<label
				for="hs-strong-password-with-indicator-and-hint"
				class="mb-2 block text-sm dark:text-white">Senha</label
			>
			<div class="mb-2 flex">
				<div class="flex-1">
					<div class="relative">
						<input
							type="password"
							placeholder="••••••••"
							autocomplete="current-password"
							required
							id="hs-strong-password-with-indicator-and-hint"
							class="hs-toggle-password block w-full rounded-md border-neutral-200 px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600"
						/>
						<button
							type="button"
							data-hs-toggle-password={JSON.stringify({
								target: '#hs-strong-password-with-indicator-and-hint'
							})}
							class="absolute inset-y-0 end-0 z-20 flex cursor-pointer items-center rounded-e-md px-3 text-neutral-400 focus:text-blue-600 focus:outline-none dark:text-neutral-600 dark:focus:text-blue-500"
							aria-label="Exibir ou ocultar senha"
						>
							<span class="icon-[lucide--eye] hs-password-active:block hidden size-4"></span>
							<span class="icon-[lucide--eye-off] hs-password-active:hidden size-4"></span>
						</button>
					</div>
					<div
						id="hs-strong-password"
						data-hs-strong-password={JSON.stringify({
							target: '#hs-strong-password-with-indicator-and-hint',
							hints: '#hs-strong-password-hints',
							stripClasses:
								'hs-strong-password:opacity-100 hs-strong-password-accepted:bg-teal-500 h-1 flex-auto rounded-full bg-blue-400 opacity-50 mx-1'
						})}
						class="-mx-1 mt-2 flex"
					></div>
				</div>
			</div>
			<div id="hs-strong-password-hints" class="mb-2">
				<div class="mt-6 mb-2">
					<span class="text-sm font-semibold text-neutral-800 dark:text-white"
						>Força da senha:
					</span>
					<span
						data-hs-strong-password-hints-weakness-text={JSON.stringify([
							'Nenhuma',
							'Fraca',
							'Média',
							'Forte',
							'Muito forte',
							'Super forte'
						])}
						class="text-sm font-semibold text-neutral-800 dark:text-neutral-200"
					></span>
				</div>
				<ul class="space-y-1 text-sm text-neutral-500 dark:text-neutral-500">
					{@render passwordRule({
						rule: 'min-length',
						message: 'Precisa ter pelo menos 6 caracteres.'
					})}
					{@render passwordRule({
						rule: 'lowercase',
						message: 'Precisa ter letras minúsculas.'
					})}
					{@render passwordRule({
						rule: 'uppercase',
						message: 'Precisa ter letras maiúsculas.'
					})}
					{@render passwordRule({
						rule: 'numbers',
						message: 'Precisa ter números.'
					})}
					{@render passwordRule({
						rule: 'special-characters',
						message: 'Precisa ter caracteres especiais.'
					})}
				</ul>
			</div>
		</div>

		<div>
			<button
				type="submit"
				class="inline-flex w-full items-center justify-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 focus:bg-blue-700 focus:outline-none disabled:pointer-events-none disabled:opacity-50"
				>Criar conta</button
			>
		</div>
		<div
			class="flex items-center py-3 text-sm text-neutral-800 before:me-6 before:flex-1 before:border-t before:border-neutral-200 after:ms-6 after:flex-1 after:border-t after:border-neutral-200 dark:text-white dark:before:border-neutral-600 dark:after:border-neutral-600"
		>
			ou
		</div>
		<div class="flex w-full flex-col items-center justify-center gap-3">
			<button
				type="button"
				class="inline-flex w-full items-center justify-center gap-x-2 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-800 shadow-xs hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800 dark:focus:bg-neutral-800"
			>
				<span class="icon-[logos--google-icon] size-4"></span>
				Entrar com Google
			</button>
			<button
				type="button"
				class="inline-flex w-full items-center justify-center gap-x-2 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-800 shadow-xs hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800 dark:focus:bg-neutral-800"
			>
				<span class="icon-[logos--facebook] size-4"></span>
				Entrar com Facebook
			</button>
		</div>
	</fieldset>
</form>
<p class="mt-8 text-center text-sm dark:text-white">
	Já possui uma conta?
	<a
		href="/login"
		class="text-primary font-semibold underline-offset-2 hover:underline dark:text-white"
		>Entre agora</a
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

{#snippet passwordRule({ rule, message }: any)}
	<li
		data-hs-strong-password-hints-rule-text={rule}
		class="hs-strong-password-active:text-teal-500 flex items-center gap-x-2"
	>
		<span class="hidden" data-check="">
			<span class="flex items-center justify-center">
				<span class="icon-[lucide--circle-check-big] size-4"></span>
			</span>
		</span>
		<span data-uncheck="">
			<span class="flex items-center justify-center">
				<span class="icon-[lucide--circle-x] size-4"></span>
			</span>
		</span>
		{message}
	</li>
{/snippet}
