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

		<!-- Background -->
		<div class="hidden min-h-screen flex-grow md:flex md:w-1/2 lg:w-1/2">
			<NuxtImg src="/background-1.png" alt="Fundo" class="size-full h-screen object-cover" />
		</div>

		<!-- Toogle dark/light mode -->
		<div class="fixed bottom-5 right-5 z-20">
			<button type="button" class="hs-dark-mode-active:hidden block hs-dark-mode font-medium rounded-full focus:outline-none text-neutral-200 hover:bg-neutral-800 focus:bg-neutral-800" data-hs-theme-click-value="dark">
				<span class="group inline-flex shrink-0 justify-center items-center size-9">
					<Icon name="lucide:moon" class="shrink-0 size-5" />
				</span>
			</button>
			<button type="button" class="hs-dark-mode-active:block hidden hs-dark-mode font-medium text-gray-800 rounded-full hover:bg-gray-200 focus:outline-none focus:bg-gray-200 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:focus:bg-neutral-800" data-hs-theme-click-value="light">
				<span class="group inline-flex shrink-0 justify-center items-center size-9">
					<Icon name="lucide:sun" class="shrink-0 size-5" />
				</span>
			</button>
		</div>
	</div>
</template>

<script setup lang="ts"></script>
