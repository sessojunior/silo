<script lang="ts">
	import Header from '$lib/client/components/auth/Header.svelte'
</script>

<!-- Header -->
<Header icon="icon-[lucide--log-in]" title="Entrar" paragraph="Digite seus dados para entrar." />

<!-- Container -->
<div class="mt-10 text-base text-neutral-600 dark:text-white">
	<!-- Form -->
	<form>
		<fieldset class="grid gap-5">
			<div>
				<label for="email" class="mb-2 block">E-mail</label>
				<div class="relative">
					<input
						type="email"
						id="email"
						name="email"
						placeholder="seuemail@inpe.br"
						autocomplete="email"
						required
						aria-describedby="email-error"
						class="block w-full rounded-lg border-red-500 px-4 py-3 focus:border-blue-500 focus:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600"
					/>
					<div class="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-4">
						<span class="icon-[lucide--info] size-5 text-red-600"></span>
					</div>
				</div>
				<p class="mt-2 text-xs text-red-600" id="email-error">Digite um e-mail válido.</p>
			</div>
			<div>
				<label for="hs-toggle-password" class="mb-2 block">Senha</label>
				<div class="relative">
					<input
						id="hs-toggle-password"
						type="password"
						placeholder="••••••••"
						autocomplete="current-password"
						required
						class="block w-full rounded-lg border-neutral-200 py-3 ps-4 pe-10 focus:border-blue-500 focus:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600"
					/>
					<button
						type="button"
						data-hs-toggle-password={JSON.stringify({ target: '#hs-toggle-password' })}
						class="absolute inset-y-0 end-0 z-20 flex cursor-pointer items-center rounded-e-md pe-4 text-neutral-400 focus:text-blue-600 focus:outline-none dark:text-neutral-600 dark:focus:text-blue-500"
						aria-label="Exibir ou ocultar senha"
					>
						<span class="icon-[lucide--eye] hs-password-active:block hidden size-5"></span>
						<span class="icon-[lucide--eye-off] hs-password-active:hidden size-5"></span>
					</button>
				</div>
			</div>
			<p class="text-end text-sm">
				<a href="/forgot-password" class="font-semibold underline-offset-2 hover:underline">Esqueceu a senha?</a>
			</p>
			<div>
				<button
					type="submit"
					class="inline-flex w-full items-center justify-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 focus:bg-blue-700 focus:outline-none disabled:pointer-events-none disabled:opacity-50"
					>Entrar</button
				>
			</div>
			<div
				class="flex items-center py-3 before:me-6 before:flex-1 before:border-t before:border-neutral-200 after:ms-6 after:flex-1 after:border-t after:border-neutral-200 dark:before:border-neutral-600 dark:after:border-neutral-600"
			>
				ou
			</div>
			<div class="flex w-full flex-col items-center justify-center gap-3">
				<button
					type="button"
					class="inline-flex w-full items-center justify-center gap-x-2 rounded-lg border border-neutral-200 bg-white px-4 py-3 font-medium shadow-xs hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:focus:bg-neutral-800"
				>
					<span class="icon-[logos--google-icon] size-4"></span>
					Entrar com Google
				</button>
				<button
					type="button"
					class="inline-flex w-full items-center justify-center gap-x-2 rounded-lg border border-neutral-200 bg-white px-4 py-3 font-medium shadow-xs hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:focus:bg-neutral-800"
				>
					<span class="icon-[logos--facebook] size-4"></span>
					Entrar com Facebook
				</button>
			</div>
			<p class="mt-2 text-center">
				Não tem conta?
				<a href="/create-account" class="font-semibold underline-offset-2 hover:underline">Cadastre-se</a>
			</p>
		</fieldset>
	</form>
</div>
