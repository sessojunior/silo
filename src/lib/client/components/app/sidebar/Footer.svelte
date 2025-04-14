<script lang="ts">
	const { user } = $props()
</script>

<footer class="flex h-16 justify-between border-t border-t-transparent">
	<div class="flex w-full items-center justify-between gap-2 px-4">
		<div class="flex items-center gap-2">
			<img class="inline-block size-[40px] rounded-full" src={user.avatar ? `/uploads/avatar/${user.avatar}` : '/uploads/avatar.png'} alt="Avatar" />
			<div class="w-[140px]">
				<p class="truncate text-base leading-none font-medium text-neutral-700 dark:text-white">
					{user.name}
				</p>
				<p class="truncate text-sm text-neutral-500 dark:text-neutral-300">{user.email}</p>
			</div>
		</div>
		<a
			href="/sign-out"
			type="button"
			class="relative inline-flex size-8 items-center justify-center gap-x-2 rounded-full border border-transparent text-sm font-semibold text-neutral-800 hover:bg-neutral-200 focus:bg-neutral-100 focus:outline-none disabled:pointer-events-none disabled:opacity-50 dark:text-white dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
			aria-label="Sair"
		>
			<span class="icon-[lucide--log-out] size-4 shrink-0 text-neutral-400"></span>
		</a>
	</div>
</footer>
