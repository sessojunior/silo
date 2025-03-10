<script lang="ts"></script>

<!-- Header -->
{@render header({
	icon: 'icon-[lucide--square-asterisk]',
	title: 'Verificar conta',
	paragraph: 'Insira abaixo o código de verificação enviado para seu e-mail.'
})}

<!-- Form -->
<form class="mt-10">
	<fieldset class="grid gap-5">
		<div>
			<label for="code" class="mb-2 block text-sm dark:text-white">Código de verificação</label>
			<div
				class="flex justify-between"
				data-hs-pin-input={JSON.stringify({
					availableCharsRE: '^[0-9]+$'
				})}
			>
				<!-- svelte-ignore <a11y_autofocus> -->
				<input
					type="text"
					autofocus
					class="block w-10 rounded-md border-neutral-200 text-center text-sm focus:border-blue-500 focus:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600"
					data-hs-pin-input-item=""
				/>
				<input
					type="text"
					class="block w-10 rounded-md border-neutral-200 text-center text-sm focus:border-blue-500 focus:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600"
					data-hs-pin-input-item=""
				/>
				<input
					type="text"
					class="block w-10 rounded-md border-neutral-200 text-center text-sm focus:border-blue-500 focus:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600"
					data-hs-pin-input-item=""
				/>
				<input
					type="text"
					class="block w-10 rounded-md border-neutral-200 text-center text-sm focus:border-blue-500 focus:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600"
					data-hs-pin-input-item=""
				/>
				<input
					type="text"
					class="block w-10 rounded-md border-neutral-200 text-center text-sm focus:border-blue-500 focus:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600"
					data-hs-pin-input-item=""
				/>
				<input
					type="text"
					class="block w-10 rounded-md border-neutral-200 text-center text-sm focus:border-blue-500 focus:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600"
					data-hs-pin-input-item=""
				/>
			</div>
			<p class="mt-2 text-xs text-red-600" id="email-error">
				Digite um código de verificação válido.
			</p>
		</div>
		<div>
			<button
				type="submit"
				class="inline-flex w-full items-center justify-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 focus:bg-blue-700 focus:outline-none disabled:pointer-events-none disabled:opacity-50"
				>Verificar conta</button
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
