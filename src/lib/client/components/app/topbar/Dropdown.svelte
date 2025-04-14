<script lang="ts">
	let { account } = $props()
</script>

<div class="hs-dropdown relative inline-flex [--placement:bottom-right]">
	<button
		id="hs-dropdown-account"
		type="button"
		class="group inline-flex items-center justify-center gap-x-2 rounded-full border border-transparent text-sm font-semibold text-neutral-800 focus:outline-none disabled:pointer-events-none disabled:opacity-50 dark:text-white"
		aria-haspopup="menu"
		aria-expanded="false"
		aria-label="Dropdown"
	>
		<!-- <div class="relative inline-block">
        <span class="inline-flex items-center justify-center size-[46px] rounded-full bg-neutral-500 text-sm font-semibold text-white leading-none border-2 group-hover:border-4 group-focus:border-4 border-neutral-200 dark:border-neutral-700 group-focus:border-neutral-200 dark:group-focus:border-neutral-700">MJ</span>
        <span class="absolute bottom-0 end-0 block size-3 rounded-full ring-2 ring-white bg-teal-400 dark:ring-neutral-800"></span>
      </div> -->
		<div class="relative inline-block">
			<img
				class="inline-block size-[46px] rounded-full border-2 border-neutral-200 transition-all duration-200 group-hover:border-4 group-focus:border-4 group-focus:border-neutral-200 dark:border-neutral-700 dark:group-focus:border-neutral-700"
				src={account.avatar}
				alt="Avatar"
			/>
			<span class="absolute end-0 bottom-0 block size-3 rounded-full bg-teal-400 ring-2 ring-white dark:ring-neutral-800"></span>
		</div>
		<div
			class="flex size-6 shrink-0 items-center justify-center rounded-full transition-all duration-200 group-hover:bg-neutral-200 group-focus:bg-neutral-100 dark:group-hover:bg-neutral-700 dark:group-focus:bg-neutral-700"
		>
			<span class="icon-[lucide--chevron-down] size-4 shrink-0 text-neutral-400"></span>
		</div>
	</button>
	<!-- Dropdown Menu -->
	<div
		class="hs-dropdown-menu duration hs-dropdown-open:opacity-100 mt-2 hidden min-w-60 rounded-lg border border-neutral-200 bg-white opacity-0 shadow-md transition-[opacity,margin] before:absolute before:start-0 before:-top-4 before:h-4 before:w-full after:absolute after:start-0 after:-bottom-4 after:h-4 after:w-full dark:divide-neutral-700 dark:border-neutral-700 dark:bg-neutral-800"
		role="menu"
		aria-orientation="vertical"
		aria-labelledby="hs-dropdown-account"
	>
		<div class="rounded-t-lg bg-neutral-100 px-5 py-3 dark:bg-neutral-700">
			<p class="text-base leading-none font-medium text-neutral-800 dark:text-neutral-200">
				{account.name}
			</p>
			<p class="text-sm text-neutral-500 dark:text-neutral-400">
				{account.email}
			</p>
		</div>
		<div class="space-y-0.5 p-1.5">
			{#each account.links as link (link.id)}
				<a
					class="flex items-center gap-x-3 rounded-lg px-3 py-2 text-base font-medium text-neutral-800 transition-all duration-500 hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-none dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-300 dark:focus:bg-neutral-700 dark:focus:text-neutral-300"
					href={link.url}
				>
					<span class="{link.icon} size-4 shrink-0 text-neutral-400"></span>
					{link.title}
				</a>
			{/each}
		</div>
	</div>
</div>
