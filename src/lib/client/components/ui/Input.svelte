<script lang="ts">
	import { onMount } from 'svelte'

	onMount(() => {
		window.HSStaticMethods.autoInit()
	})

	let {
		type,
		mask = null,
		id,
		name,
		placeholder,
		autocomplete,
		autofocus = false,
		minlength = 2,
		maxlength = 255,
		value = $bindable(''),
		className = null,
		required,
		isInvalid,
		invalidMessage
	} = $props()

	// Deixa o telefone no formato (00) 00000-0000 ou (00) 0000-0000
	function phoneMask(value: string) {
		value = value.replace(/\D/g, '')

		if (value.length > 10) {
			return value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3')
		} else if (value.length > 6) {
			return value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3')
		} else if (value.length > 2) {
			return value.replace(/^(\d{2})(\d{0,5})/, '($1) $2')
		} else {
			return value.replace(/^(\d*)/, '($1')
		}
	}

	// Se o tipo do campo for 'email', converte para minúsculo o que for digitado
	// mas se tiver mask 'phone', aplica a máscara de telefone
	function handleInput(event: Event) {
		const input = event.target as HTMLInputElement

		// Se o tipo do campo for 'phone', aplica a máscara de telefone
		if (mask === 'phone') {
			const cursor = input.selectionStart ?? 0
			const originalLength = input.value.length

			const masked = phoneMask(input.value)
			input.value = masked
			value = masked

			const diff = masked.length - originalLength
			const newCursor = Math.max(0, cursor + diff)
			requestAnimationFrame(() => {
				input.setSelectionRange(newCursor, newCursor)
			})
		} else {
			// Se o tipo do campo for 'email', converte para minúsculo o que for digitado
			value = type === 'email' ? input.value.toLowerCase() : input.value
		}
	}
</script>

{#if type === 'strong-password'}
	<!-- Senha forte -->
	<div class="flex">
		<div class="flex-1">
			<div class="relative">
				<!-- svelte-ignore a11y_autofocus -->
				<input
					{id}
					{name}
					{type}
					{placeholder}
					{autocomplete}
					{maxlength}
					{required}
					bind:value
					{autofocus}
					class="block rounded-lg py-3 ps-4 pe-10 disabled:pointer-events-none disabled:opacity-50
					{isInvalid ? 'border-red-600 focus:border-red-600 focus:ring-red-500' : 'focus:border-blue-500 focus:ring-blue-500'} 
					{className ?? 'w-full'}
        border-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:placeholder-zinc-500 dark:focus:ring-zinc-600"
				/>
				<button
					type="button"
					data-hs-toggle-password={JSON.stringify({ target: `#${id}` })}
					class="absolute inset-y-0 end-0 z-20 flex cursor-pointer items-center rounded-e-md px-3 text-zinc-400 focus:text-blue-600 focus:outline-none dark:text-zinc-600 dark:focus:text-blue-500"
					aria-label="Exibir ou ocultar senha"
				>
					<span class="icon-[lucide--eye] hs-password-active:block hidden size-4"></span>
					<span class="icon-[lucide--eye-off] hs-password-active:hidden size-4"></span>
				</button>
			</div>
			<div
				id="hs-strong-password"
				data-hs-strong-password={JSON.stringify({
					target: `#${id}`,
					minLength: `${minlength}`,
					hints: '#hs-strong-password-hints',
					stripClasses: 'hs-strong-password:opacity-100 hs-strong-password-accepted:bg-teal-500 h-1 flex-auto rounded-full bg-zinc-300 opacity-50 mx-1'
				})}
				class="-mx-1 mt-2 flex"
			></div>
			{#if isInvalid}
				{@render message({ message: invalidMessage })}
			{/if}
		</div>
	</div>
	<div id="hs-strong-password-hints" class="mb-2">
		<div class="mt-4 mb-2">
			<span class="font-semibold text-zinc-500 dark:text-zinc-200">Força da senha: </span>
			<span
				data-hs-strong-password-hints-weakness-text={JSON.stringify(['nenhuma', 'fraca', 'média', 'forte', 'muito forte', 'super forte'])}
				class="font-semibold text-zinc-500 dark:text-zinc-200"
			></span>
		</div>
		<ul class="space-y-1 text-sm text-zinc-500 dark:text-zinc-500">
			{@render passwordRule({
				rule: 'min-length',
				message: `Precisa ter pelo menos ${minlength} caracteres.`
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
	{#snippet passwordRule({ rule, message }: any)}
		<li data-hs-strong-password-hints-rule-text={rule} class="hs-strong-password-active:text-teal-500 flex items-center gap-x-2">
			<span class="hidden" data-check="">
				<span class="flex items-center justify-center">
					<span class="icon-[lucide--check] size-5 text-teal-500"></span>
				</span>
			</span>
			<span data-uncheck="">
				<span class="flex items-center justify-center">
					<span class="icon-[lucide--x] size-5 text-zinc-400"></span>
				</span>
			</span>
			{message}
		</li>
	{/snippet}
{:else if type === 'password'}
	<!-- Senha -->
	<div class="relative">
		<!-- svelte-ignore a11y_autofocus -->
		<input
			{id}
			{name}
			{type}
			{placeholder}
			{autocomplete}
			{minlength}
			{maxlength}
			{required}
			bind:value
			{autofocus}
			class="block rounded-lg py-3 ps-4 pe-10 disabled:pointer-events-none disabled:opacity-50
				{isInvalid ? 'border-red-600 focus:border-red-600 focus:ring-red-500' : 'focus:border-blue-500 focus:ring-blue-500'} 
				{className ?? 'w-full'}
        border-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:placeholder-zinc-500 dark:focus:ring-zinc-600"
		/>
		<button
			type="button"
			data-hs-toggle-password={JSON.stringify({ target: `#${id}` })}
			class="absolute inset-y-0 end-0 z-20 flex cursor-pointer items-center rounded-e-md pe-4 {isInvalid
				? 'focus:text-red-400 dark:focus:text-red-600'
				: 'focus:text-blue-400 dark:focus:text-blue-600'} 
        text-zinc-400 focus:outline-none dark:text-zinc-400"
			aria-label="Exibir ou ocultar senha"
		>
			<span class="icon-[lucide--eye] hs-password-active:block hidden size-5"></span>
			<span class="icon-[lucide--eye-off] hs-password-active:hidden size-5"></span>
		</button>
	</div>
	{#if isInvalid}
		{@render message({ message: invalidMessage })}
	{/if}
{:else}
	<!-- Outros tipos de campo -->
	<div class="relative">
		<!-- svelte-ignore a11y_autofocus -->
		<input
			{id}
			{name}
			{type}
			{placeholder}
			{autocomplete}
			{minlength}
			{maxlength}
			{required}
			bind:value
			{autofocus}
			oninput={handleInput}
			class="block rounded-lg py-3 ps-4 pe-10 disabled:pointer-events-none disabled:opacity-50
				{isInvalid
				? 'border-red-400 focus:border-red-400 focus:ring-red-600 dark:border-red-800 dark:focus:border-red-800 dark:focus:ring-red-800'
				: 'focus:border-blue-500 focus:ring-blue-500'} 
				{className ?? 'w-full'}
        border-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:placeholder-zinc-500 dark:focus:ring-zinc-600"
		/>
		{#if isInvalid}
			<div class="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-4">
				<span class="icon-[lucide--triangle-alert] size-5 text-red-400 dark:text-red-900"></span>
			</div>
		{/if}
	</div>
	{#if isInvalid}
		{@render message({ message: invalidMessage })}
	{/if}
{/if}

{#snippet message({ message }: any)}
	<p class="dark:text-red-00 mt-2 text-xs text-red-500">{message}</p>
{/snippet}
