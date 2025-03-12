<script lang="ts">
	import ProductTimeline from '$lib/dashboard/ProductTimeline.svelte'
	import ProductTurn from '$lib/dashboard/ProductTurn.svelte'
	import ProductCalendar from '$lib/dashboard/ProductCalendar.svelte'

	let { id, name, progress, priority, date } = $props()
</script>

<!-- Product item -->
<div class="flex flex-col rounded-lg border border-dashed border-neutral-200 bg-white p-4 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
	<div class="flex items-center justify-between">
		<!-- Name -->
		<div class="flex flex-col">
			<div class="flex items-center gap-2">
				<span class="icon-[lucide--folder-git-2] size-5 shrink-0 text-neutral-400"></span>
				<span class="text-lg font-medium">{name}</span>
			</div>
			<div class="text-sm">
				{progress}% <span class="text-neutral-300">•</span>
				{date}
			</div>
		</div>
		<!-- Turno -->
		<div class="flex flex-col">
			<!-- Barra de turno -->
			<ProductTurn />
		</div>
	</div>
	<div class="mt-1.5 flex items-center justify-between">
		<!-- Popover -->
		<div class="hs-tooltip inline-block [--trigger:hover] sm:[--placement:top]">
			<!-- Popover Trigger -->
			<div class="hs-tooltip-toggle">
				<!-- Linha do tempo -->
				<ProductTimeline />
				<!-- Popover Content -->
				<div
					class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible invisible absolute z-[80] hidden rounded-xl border border-gray-100 bg-white text-start opacity-0 shadow-md transition-opacity after:absolute after:-start-4 after:top-0 after:h-full after:w-4 dark:border-neutral-700 dark:bg-neutral-800"
					role="tooltip"
				>
					<div class="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
						<div class="flex items-center gap-2">
							<span class="icon-[lucide--folder-git-2] size-5 shrink-0 text-neutral-400"></span>
							<span class="text-lg font-medium">{name}</span>
						</div>
						<!-- Prioridade -->
						<div class="flex items-center text-xs leading-none">
							{#if priority == 'urgent'}
								<div class="inline-block rounded-full bg-red-100 px-4 py-2 dark:bg-red-600">
									<span class="text-xs font-medium text-nowrap text-red-500 uppercase dark:text-white">P. Urgente</span>
								</div>
							{:else if priority == 'normal'}
								<div class="inline-block rounded-full bg-orange-100 px-4 py-2 dark:bg-orange-600">
									<span class="text-xs font-medium text-nowrap text-orange-500 uppercase dark:text-white">P. Normal</span>
								</div>
							{:else if priority == 'low'}
								<div class="inline-block rounded-full bg-green-200 px-4 py-2 dark:bg-green-700">
									<span class="text-xs font-medium text-nowrap text-green-600 uppercase dark:text-white">P. Baixa</span>
								</div>
							{/if}
						</div>
					</div>
					<div class="m-4 flex flex-col gap-4">
						<ProductCalendar />
						<ProductCalendar />
					</div>
				</div>
			</div>
		</div>

		<!-- Prioridade -->
		<div class="flex items-center text-xs leading-none">
			{#if priority == 'urgent'}
				<div class="inline-block rounded-full bg-red-100 px-4 py-2 dark:bg-red-600">
					<span class="text-xs font-medium text-nowrap text-red-500 uppercase dark:text-white">P. Urgente</span>
				</div>
			{:else if priority == 'normal'}
				<div class="inline-block rounded-full bg-orange-100 px-4 py-2 dark:bg-orange-600">
					<span class="text-xs font-medium text-nowrap text-orange-500 uppercase dark:text-white">P. Normal</span>
				</div>
			{:else if priority == 'low'}
				<div class="inline-block rounded-full bg-green-200 px-4 py-2 dark:bg-green-700">
					<span class="text-xs font-medium text-nowrap text-green-600 uppercase dark:text-white">P. Baixa</span>
				</div>
			{/if}
		</div>
	</div>
</div>
