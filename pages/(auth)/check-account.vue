<template>
	<NuxtLayout name="auth">
		<div class="mx-auto mb-4 flex size-14 items-center justify-center rounded-lg border dark:border-neutral-700 dark:text-white">
			<Icon class="size-6" name="lucide:square-asterisk" />
		</div>
		<h1 class="text-3xl text-center font-bold tracking-tight dark:text-white">Verificar conta</h1>
		<p class="mt-1 text-center text-sm dark:text-white">Insira abaixo o código de verificação enviado para seu e-mail.</p>
		<form class="mt-10">
			<fieldset class="grid gap-5">
				<div>
					<label for="code" class="block text-sm mb-2 dark:text-white">Código de verificação</label>
					<div
						class="flex gap-x-3"
						data-hs-pin-input='{
            "availableCharsRE": "^[0-9]+$"
          }'
					>
						<input type="text" autofocus class="block w-[38px] text-center border-gray-200 rounded-md text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600" data-hs-pin-input-item="" />
						<input type="text" class="block w-[38px] text-center border-gray-200 rounded-md text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600" data-hs-pin-input-item="" />
						<input type="text" class="block w-[38px] text-center border-gray-200 rounded-md text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600" data-hs-pin-input-item="" />
						<input type="text" class="block w-[38px] text-center border-gray-200 rounded-md text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600" data-hs-pin-input-item="" />
					</div>
					<p class="text-xs text-red-600 mt-2" id="email-error">Digite um código de verificação válido.</p>
				</div>
				<div>
					<button type="submit" class="w-full py-3 px-4 inline-flex justify-center items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none">Verificar conta</button>
				</div>
			</fieldset>
		</form>
		<p class="mt-8 text-center text-sm">
			<NuxtLink class="font-semibold text-primary underline-offset-2 hover:underline dark:text-white" to="/login">Voltar e entrar</NuxtLink>
		</p>
	</NuxtLayout>
</template>

<script setup lang="ts"></script>
