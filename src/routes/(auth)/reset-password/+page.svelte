<script lang="ts"></script>

<!-- Header -->
{@render header({
	icon: 'icon-[lucide--lock]',
	title: 'Nova senha',
	paragraph: 'Digite sua nova senha abaixo.'
})}

<!-- Form -->
<form class="mt-10">
	<fieldset class="grid gap-5">
		<!-- Strong Password -->
		<div>
			<label
				for="hs-strong-password-with-indicator-and-hint"
				class="mb-2 block text-sm dark:text-white">Nova senha</label
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
				>Redefinir senha</button
			>
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
