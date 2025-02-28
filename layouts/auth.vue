<template>
	<div class="flex min-h-screen justify-between bg-white dark:bg-neutral-900">
		<div class="w-full md:w-1/2 md:max-w-[600px]">
			<div class="flex flex-col w-full h-full">
				<div className="flex">
					<div class="flex gap-2 px-10 pt-10">
						<NuxtImg src="/logo.png" alt="Logo" width="32" height="32" class="block" />
						<div class="block text-2xl font-bold dark:text-white">Silo</div>
					</div>
				</div>

				<div class="flex items-center flex-grow justify-center">
					<div class="mx-auto w-full max-w-[330px] px-5 py-10">
						<slot />
					</div>
				</div>
			</div>
		</div>

		<div class="hidden min-h-screen flex-grow md:flex md:w-1/2 lg:w-1/2">
			<NuxtImg src="/placeholder.svg" alt="Fundo" class="size-full h-screen object-cover" />
		</div>

		<div class="fixed bottom-5 right-5 z-20">
			<button type="button" class="hs-dark-mode hs-dark-mode-active:hidden inline-flex items-center justify-center h-10 w-10 bg-neutral-800 rounded-full text-sm text-white hover:bg-black focus:outline-none focus:bg-black" data-hs-theme-click-value="dark">
				<Icon name="lucide:moon" class="shrink-0 size-5" />
			</button>
			<button type="button" class="hs-dark-mode hs-dark-mode-active:inline-flex hidden items-center justify-center h-10 w-10 bg-neutral-100 rounded-full text-sm text-neutral-900 hover:bg-white focus:outline-none focus:bg-white" data-hs-theme-click-value="light">
				<Icon name="lucide:sun" class="shrink-0 size-5" />
			</button>
		</div>
	</div>
</template>

<script setup lang="ts"></script>
