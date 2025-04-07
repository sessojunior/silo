<script lang="ts">
	let { type, id, name, placeholder, autocomplete, minlength = 2, maxlength = 255, value = '', required, isInvalid, invalidMessage } = $props()
</script>

{#if type === 'strong-password'}
	<!-- Senha forte -->
	<div class="flex">
		<div class="flex-1">
			<div class="relative">
				<input
					{id}
					{name}
					{type}
					{placeholder}
					{autocomplete}
					{minlength}
					{maxlength}
					{required}
					{value}
					class="block w-full rounded-lg py-3 ps-4 pe-10 disabled:pointer-events-none disabled:opacity-50 {isInvalid
						? 'border-red-600 focus:border-red-600 focus:ring-red-500'
						: 'focus:border-blue-500 focus:ring-blue-500'} 
        border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600"
				/>
				<button
					type="button"
					data-hs-toggle-password={JSON.stringify({
						target: `#${id}`
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
					target: `#${id}`,
					hints: '#hs-strong-password-hints',
					stripClasses: 'hs-strong-password:opacity-100 hs-strong-password-accepted:bg-teal-500 h-1 flex-auto rounded-full bg-neutral-300 opacity-50 mx-1'
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
			<span class="font-semibold text-neutral-500 dark:text-neutral-200">Força da senha: </span>
			<span
				data-hs-strong-password-hints-weakness-text={JSON.stringify(['nenhuma', 'fraca', 'média', 'forte', 'muito forte', 'super forte'])}
				class="font-semibold text-neutral-500 dark:text-neutral-200"
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
	{#snippet passwordRule({ rule, message }: any)}
		<li data-hs-strong-password-hints-rule-text={rule} class="hs-strong-password-active:text-teal-500 flex items-center gap-x-2">
			<span class="hidden" data-check="">
				<span class="flex items-center justify-center">
					<span class="icon-[lucide--check] size-5 text-teal-500"></span>
				</span>
			</span>
			<span data-uncheck="">
				<span class="flex items-center justify-center">
					<span class="icon-[lucide--x] size-5 text-neutral-400"></span>
				</span>
			</span>
			{message}
		</li>
	{/snippet}
{:else if type === 'password'}
	<!-- Senha -->
	<div class="relative">
		<input
			{id}
			{name}
			{type}
			{placeholder}
			{autocomplete}
			{minlength}
			{maxlength}
			{required}
			{value}
			class="block w-full rounded-lg py-3 ps-4 pe-10 disabled:pointer-events-none disabled:opacity-50 {isInvalid
				? 'border-red-600 focus:border-red-600 focus:ring-red-500'
				: 'focus:border-blue-500 focus:ring-blue-500'} 
        border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600"
		/>
		<button
			type="button"
			data-hs-toggle-password={JSON.stringify({ target: '#hs-toggle-password' })}
			class="absolute inset-y-0 end-0 z-20 flex cursor-pointer items-center rounded-e-md pe-4 {isInvalid
				? 'focus:text-red-400 dark:focus:text-red-600'
				: 'focus:text-blue-400 dark:focus:text-blue-600'} 
        text-neutral-400 focus:outline-none dark:text-neutral-400"
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
		<input
			{id}
			{name}
			{type}
			{placeholder}
			{autocomplete}
			{minlength}
			{maxlength}
			{required}
			{value}
			oninput={(e) => {
				// Se o tipo do campo for 'email', converte para minúsculo o que for digitado
				const input = e.target as HTMLInputElement
				value = type === 'email' ? input.value.toLowerCase() : input.value
			}}
			class="block w-full rounded-lg py-3 ps-4 pe-10 disabled:pointer-events-none disabled:opacity-50 {isInvalid
				? 'border-red-400 focus:border-red-400 focus:ring-red-600 dark:border-red-800 dark:focus:border-red-800 dark:focus:ring-red-800'
				: 'focus:border-blue-500 focus:ring-blue-500'} 
        border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:placeholder-neutral-500 dark:focus:ring-neutral-600"
		/>
		{#if isInvalid}
			<div class="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-4">
				<span class="icon-[lucide--info] size-5 text-red-400 dark:text-red-900"></span>
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
