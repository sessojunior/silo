<template>
	<NuxtLayout name="auth">
		<div class="mx-auto mb-4 flex size-14 items-center justify-center rounded-lg border dark:border-neutral-700 dark:text-white">
			<Icon class="size-6" name="lucide:mail" />
		</div>
		<h1 class="text-3xl text-center font-bold tracking-tight dark:text-white">Confira seu e-mail</h1>
		<p class="mt-1 text-center text-sm dark:text-white">Enviamos um e-mail com instruções para redefinir sua senha.</p>
		<form class="mt-10">
			<fieldset class="grid gap-5">
				<div>
					<NuxtLink to="/forgot-password">
						<button type="button" class="w-full py-3 px-4 inline-flex justify-center items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none">
							<Icon class="size-5" name="lucide:arrow-left" />
							<span>Reenviar instruções</span>
						</button>
					</NuxtLink>
				</div>
			</fieldset>
		</form>
		<p class="mt-8 text-center text-sm">
			<NuxtLink class="font-semibold text-primary underline-offset-2 hover:underline dark:text-white" to="/login">Voltar e entrar</NuxtLink>
		</p>
	</NuxtLayout>
</template>

<script setup lang="ts"></script>
