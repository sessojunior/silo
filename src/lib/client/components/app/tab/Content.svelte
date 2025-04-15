<script lang="ts">
	let { children, id, labelledby }: { children: any; id: string; labelledby: string } = $props()
</script>

<div {id} class="bg-zinc-50 dark:bg-zinc-800" role="tabpanel" aria-labelledby={labelledby}>
	<div class="container flex">
		<div class="flex w-full flex-shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-700">
			<div
				class="size-full h-[calc(100vh-131px)] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-500 [&::-webkit-scrollbar-track]:bg-zinc-50 dark:[&::-webkit-scrollbar-track]:bg-zinc-700"
			>
				<div class="flex h-full w-full flex-col items-start justify-start gap-8 p-8 text-zinc-600 dark:text-zinc-200">
					{@render children()}
				</div>
			</div>
		</div>
	</div>
</div>
