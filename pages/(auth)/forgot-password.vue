<template>
	<NuxtLayout name="auth">
		<div class="mx-auto mb-4 flex size-14 items-center justify-center rounded-lg border dark:border-neutral-700 dark:text-white">
			<Icon class="size-6" name="lucide:key-round" />
		</div>
		<h1 class="text-3xl text-center font-bold tracking-tight dark:text-white">Esqueceu a senha</h1>
		<p class="mt-1 text-center text-sm dark:text-white">Não se preocupe, iremos te ajudar a recuperar sua senha.</p>
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
					<button type="submit" class="w-full py-3 px-4 inline-flex justify-center items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none">Enviar instruções</button>
				</div>
			</fieldset>
		</form>
		<p class="mt-8 text-center text-sm">
			<NuxtLink class="font-semibold text-primary underline-offset-2 hover:underline dark:text-white" to="/login">Voltar e entrar</NuxtLink>
		</p>
	</NuxtLayout>
</template>

<script setup lang="ts"></script>
