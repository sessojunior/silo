<template>
	<NuxtLayout name="auth">
		<div class="mx-auto mb-4 flex size-14 items-center justify-center rounded-lg border dark:border-neutral-700 dark:text-white">
			<Icon class="size-6" name="lucide:log-in" />
		</div>
		<h1 class="text-3xl text-center font-bold tracking-tight dark:text-white">Entrar</h1>
		<p class="mt-1 text-center text-sm dark:text-white">Digite seus dados para entrar.</p>
		<form class="mt-10">
			<fieldset class="grid gap-5">
				<div>
					<label for="email" class="block text-sm mb-2 dark:text-white">E-mail</label>
					<div class="relative">
						<input type="email" id="email" name="email" placeholder="email@inpe.br" autocomplete="email" required aria-describedby="email-error" class="border-red-500 py-3 px-4 block w-full rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600" />
						<div class="absolute inset-y-0 end-0 flex items-center pointer-events-none pe-3">
							<Icon class="size-4 text-red-600" name="lucide:info" />
						</div>
					</div>
					<p class="text-xs text-red-600 mt-2" id="email-error">Digite um e-mail válido.</p>
				</div>
				<div>
					<label class="block text-sm mb-2 dark:text-white">Senha</label>
					<div class="relative">
						<input id="hs-toggle-password" type="password" placeholder="••••••••" autocomplete="current-password" required class="py-3 ps-4 pe-10 block w-full border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600" />
						<button
							type="button"
							data-hs-toggle-password='{
                "target": "#hs-toggle-password"
              }'
							class="absolute inset-y-0 end-0 flex items-center z-20 px-3 cursor-pointer text-gray-400 rounded-e-md focus:outline-none focus:text-blue-600 dark:text-neutral-600 dark:focus:text-blue-500"
						>
							<Icon name="lucide:eye" class="hidden hs-password-active:block size-4" />
							<Icon name="lucide:eye-off" class="hs-password-active:hidden size-4" />
						</button>
					</div>
				</div>
				<div>
					<button type="submit" class="w-full py-3 px-4 inline-flex justify-center items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none">Entrar</button>
				</div>
				<div class="py-3 flex items-center text-sm text-gray-800 before:flex-1 before:border-t before:border-gray-200 before:me-6 after:flex-1 after:border-t after:border-gray-200 after:ms-6 dark:text-white dark:before:border-neutral-600 dark:after:border-neutral-600">ou</div>
				<div class="flex w-full flex-col items-center justify-center gap-3">
					<button type="button" class="w-full py-3 px-4 inline-flex justify-center items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-sm hover:bg-gray-50 focus:outline-none focus:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-900 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800 dark:focus:bg-neutral-800">
						<Icon class="size-4" name="logos:google-icon" />
						Entrar com Google
					</button>
					<button type="button" class="w-full py-3 px-4 inline-flex justify-center items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-sm hover:bg-gray-50 focus:outline-none focus:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-900 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800 dark:focus:bg-neutral-800">
						<Icon class="size-4" name="logos:facebook" />
						Entrar com Facebook
					</button>
				</div>
			</fieldset>
		</form>
		<p class="mt-8 text-sm">
			<NuxtLink class="font-semibold text-primary underline-offset-2 hover:underline dark:text-white" to="/forgot-password">Esqueceu a senha?</NuxtLink>
		</p>
		<p class="mt-4 text-sm dark:text-white">
			Não possui uma conta?
			<NuxtLink class="font-semibold text-primary underline-offset-2 hover:underline dark:text-white" to="/create-account">Crie uma agora</NuxtLink>
		</p>
	</NuxtLayout>
</template>

<script setup lang="ts"></script>
