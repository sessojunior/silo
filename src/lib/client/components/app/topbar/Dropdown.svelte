<script lang="ts">
	import { page } from '$app/state'

	let { account } = $props()
</script>

<div class="hs-dropdown relative inline-flex [--placement:bottom-right]">
	<button
		id="hs-dropdown-account"
		type="button"
		class="group inline-flex items-center justify-center gap-x-2 rounded-full border border-transparent text-sm font-semibold text-zinc-800 focus:outline-none disabled:pointer-events-none disabled:opacity-50 dark:text-white"
		aria-haspopup="menu"
		aria-expanded="false"
		aria-label="Dropdown"
	>
		<!-- <div class="relative inline-block">
        <span class="inline-flex items-center justify-center size-[46px] rounded-full bg-zinc-500 text-sm font-semibold text-white leading-none border-2 group-hover:border-4 group-focus:border-4 border-zinc-200 dark:border-zinc-700 group-focus:border-zinc-200 dark:group-focus:border-zinc-700">MJ</span>
        <span class="absolute bottom-0 end-0 block size-3 rounded-full ring-2 ring-white bg-teal-400 dark:ring-zinc-800"></span>
      </div> -->
		<div class="relative inline-block">
			<img
				class="inline-block size-[46px] rounded-full border-2 border-zinc-200 transition-all duration-100 group-hover:border-4 group-focus:border-4 group-focus:border-zinc-200 dark:border-zinc-700 dark:group-focus:border-zinc-700"
				src={account.avatar}
				alt="Avatar"
			/>
			<span class="absolute end-0 bottom-0 block size-3 rounded-full bg-teal-400 ring-2 ring-white dark:ring-zinc-800"></span>
		</div>
		<div
			class="flex size-6 shrink-0 items-center justify-center rounded-full transition-all duration-500 group-hover:bg-zinc-100 group-focus:bg-zinc-100 dark:group-hover:bg-zinc-700 dark:group-focus:bg-zinc-700"
		>
			<span class="icon-[lucide--chevron-down] size-4 shrink-0 text-zinc-400"></span>
		</div>
	</button>
	<!-- Dropdown Menu -->
	<div
		class="hs-dropdown-menu duration hs-dropdown-open:opacity-100 mt-2 hidden min-w-60 rounded-lg border border-zinc-200 bg-white opacity-0 shadow-md transition-[opacity,margin] before:absolute before:start-0 before:-top-4 before:h-4 before:w-full after:absolute after:start-0 after:-bottom-4 after:h-4 after:w-full dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-800"
		role="menu"
		aria-orientation="vertical"
		aria-labelledby="hs-dropdown-account"
	>
		<div class="rounded-t-lg bg-zinc-100 px-5 py-3 dark:bg-zinc-700">
			<p class="text-base leading-none font-medium text-zinc-800 dark:text-zinc-200">
				{account.name}
			</p>
			<p class="text-sm text-zinc-500 dark:text-zinc-400">
				{account.email}
			</p>
		</div>
		<div class="space-y-0.5 p-1.5">
			{#each account.links as link (link.id)}
				<a
					class="flex items-center gap-x-3 rounded-lg px-3 py-2 text-base font-medium text-zinc-800 transition-all duration-500 hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-300 dark:focus:bg-zinc-700 dark:focus:text-zinc-300
					{page.url.pathname === link.url ? 'bg-zinc-100' : ''}"
					href={link.url}
				>
					<span class="{link.icon} size-4 shrink-0 text-zinc-400"></span>
					{link.title}
				</a>
			{/each}
		</div>
	</div>
</div>
