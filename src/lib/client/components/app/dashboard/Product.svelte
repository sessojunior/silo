<script lang="ts">
	import ProductTimeline from '$lib/client/components/app/dashboard/ProductTimeline.svelte'
	import ProductTurn from '$lib/client/components/app/dashboard/ProductTurn.svelte'
	import ProductCalendar from '$lib/client/components/app/dashboard/ProductCalendar.svelte'

	let { id, name, progress, priority, date } = $props()

	let month1 = {
		month: 1,
		year: 2025,
		dates: [
			{
				dateDay: 1,
				dateWeek: 'wednesday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 2,
				dateWeek: 'thursday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'orange' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 3,
				dateWeek: 'friday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'red' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'orange' }
				]
			},
			{
				dateDay: 4,
				dateWeek: 'saturday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'red' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 5,
				dateWeek: 'sunday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'orange' }
				]
			},
			{
				dateDay: 6,
				dateWeek: 'monday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'orange' },
					{ dateTurn: 6, dateStatus: 'red' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 7,
				dateWeek: 'tuesday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 8,
				dateWeek: 'wednesday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'orange' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'red' }
				]
			},
			{
				dateDay: 9,
				dateWeek: 'thursday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'orange' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 10,
				dateWeek: 'friday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 11,
				dateWeek: 'saturday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'orange' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 12,
				dateWeek: 'sunday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'red' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'orange' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 13,
				dateWeek: 'monday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'orange' }
				]
			},
			{
				dateDay: 14,
				dateWeek: 'thursday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'red' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'orange' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 15,
				dateWeek: 'wednesday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'orange' }
				]
			},
			{
				dateDay: 16,
				dateWeek: 'thursday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'red' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 17,
				dateWeek: 'friday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 18,
				dateWeek: 'saturday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'orange' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 19,
				dateWeek: 'sunday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 20,
				dateWeek: 'monday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'orange' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'red' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 21,
				dateWeek: 'thursday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'orange' }
				]
			},
			{
				dateDay: 22,
				dateWeek: 'wednesday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'orange' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 23,
				dateWeek: 'thursday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 24,
				dateWeek: 'friday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'orange' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 25,
				dateWeek: 'saturday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'red' }
				]
			},
			{
				dateDay: 26,
				dateWeek: 'sunday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'red' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'orange' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 27,
				dateWeek: 'monday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 28,
				dateWeek: 'thursday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'orange' }
				]
			},
			{
				dateDay: 29,
				dateWeek: 'wednesday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'orange' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 30,
				dateWeek: 'thursday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 31,
				dateWeek: 'friday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			}
		]
	}
	let month2 = {
		month: 2,
		year: 2025,
		dates: [
			{
				dateDay: 1,
				dateWeek: 'saturday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 2,
				dateWeek: 'sunday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'orange' },
					{ dateTurn: 12, dateStatus: 'orange' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 3,
				dateWeek: 'monday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'red' },
					{ dateTurn: 6, dateStatus: 'red' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 4,
				dateWeek: 'tuesday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'orange' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 5,
				dateWeek: 'wednesday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'red' }
				]
			},
			{
				dateDay: 6,
				dateWeek: 'thursday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'orange' },
					{ dateTurn: 6, dateStatus: 'orange' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 7,
				dateWeek: 'friday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'red' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'orange' }
				]
			},
			{
				dateDay: 8,
				dateWeek: 'saturday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'red' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 9,
				dateWeek: 'sunday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'red' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'orange' }
				]
			},
			{
				dateDay: 10,
				dateWeek: 'monday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'orange' },
					{ dateTurn: 6, dateStatus: 'red' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 11,
				dateWeek: 'tuesday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'red' }
				]
			},
			{
				dateDay: 12,
				dateWeek: 'wednesday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'orange' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'red' }
				]
			},
			{
				dateDay: 13,
				dateWeek: 'thursday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'orange' },
					{ dateTurn: 6, dateStatus: 'red' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 14,
				dateWeek: 'friday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'red' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 15,
				dateWeek: 'saturday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'orange' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'red' }
				]
			},
			{
				dateDay: 16,
				dateWeek: 'sunday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'red' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'orange' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 17,
				dateWeek: 'monday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'orange' }
				]
			},
			{
				dateDay: 18,
				dateWeek: 'thursday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'red' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'orange' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 19,
				dateWeek: 'wednesday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'red' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'orange' }
				]
			},
			{
				dateDay: 20,
				dateWeek: 'thursday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'red' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 21,
				dateWeek: 'friday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 22,
				dateWeek: 'saturday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'red' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'orange' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 23,
				dateWeek: 'sunday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 24,
				dateWeek: 'monday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'orange' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'red' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 25,
				dateWeek: 'thursday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'red' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'orange' }
				]
			},
			{
				dateDay: 26,
				dateWeek: 'wednesday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'orange' },
					{ dateTurn: 12, dateStatus: 'red' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 27,
				dateWeek: 'thursday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'red' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 28,
				dateWeek: 'friday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'orange' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			}
		]
	}
</script>

<!-- Produto item -->
<div
	class="flex flex-col rounded-lg border border-dashed border-zinc-200 bg-white p-4 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
>
	<div class="flex items-center justify-between">
		<!-- Produto -->
		<div class="flex flex-col">
			<div class="flex items-center gap-2">
				<span class="icon-[lucide--folder-git-2] size-5 shrink-0 text-zinc-400"></span>
				<span class="text-lg font-medium">{name}</span>
			</div>
			<div class="text-sm">
				{progress}% <span class="text-zinc-300">•</span>
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
		<div class="hs-tooltip inline-block [--trigger:focus] sm:[--placement:top]">
			<!-- Popover Trigger -->
			<button
				type="button"
				class="hs-tooltip-toggle rounded-lg bg-zinc-100 hover:bg-zinc-200 focus:bg-zinc-200 focus:outline-hidden dark:bg-zinc-900 dark:hover:bg-zinc-700 dark:focus:bg-zinc-700"
			>
				<!-- Linha do tempo -->
				<ProductTimeline />
				<!-- Popover Content -->
				<div
					class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible invisible absolute z-[80] hidden rounded-xl border border-zinc-200 bg-white text-start opacity-0 shadow-md transition-opacity after:absolute after:-start-4 after:top-0 after:h-full after:w-4 dark:border-zinc-700 dark:bg-zinc-800"
					role="tooltip"
				>
					<div class="flex items-center justify-between rounded-t-xl border-b border-zinc-200 bg-zinc-100 px-4 py-3">
						<!-- Produto -->
						<div class="flex flex-col">
							<div class="flex items-center gap-2">
								<span class="icon-[lucide--folder-git-2] size-5 shrink-0 text-zinc-400"></span>
								<span class="text-lg font-medium">{name}</span>
							</div>
						</div>
						<!-- Prioridade -->
						<div class="flex items-center text-xs leading-none">
							{#if priority == 'urgent'}
								<div class="inline-block rounded-full bg-red-100 px-4 py-2 dark:bg-red-600">
									<span class="text-xs font-medium text-nowrap text-red-500 uppercase dark:text-white">Urgente</span>
								</div>
							{:else if priority == 'normal'}
								<div class="inline-block rounded-full bg-orange-100 px-4 py-2 dark:bg-orange-600">
									<span class="text-xs font-medium text-nowrap text-orange-500 uppercase dark:text-white">Normal</span>
								</div>
							{:else if priority == 'low'}
								<div class="inline-block rounded-full bg-green-200 px-4 py-2 dark:bg-green-700">
									<span class="text-xs font-medium text-nowrap text-green-600 uppercase dark:text-white">Baixa</span>
								</div>
							{/if}
						</div>
					</div>
					<div class="flex flex-col divide-y divide-zinc-200">
						<ProductCalendar calendar={month1} />
						<ProductCalendar calendar={month2} />
					</div>
				</div>
			</button>
		</div>

		<!-- Prioridade -->
		<div class="flex items-center text-xs leading-none">
			{#if priority == 'urgent'}
				<div class="inline-block rounded-full bg-red-100 px-4 py-2 dark:bg-red-600">
					<span class="text-xs font-medium text-nowrap text-red-500 uppercase dark:text-white">Urgente</span>
				</div>
			{:else if priority == 'normal'}
				<div class="inline-block rounded-full bg-orange-100 px-4 py-2 dark:bg-orange-600">
					<span class="text-xs font-medium text-nowrap text-orange-500 uppercase dark:text-white">Normal</span>
				</div>
			{:else if priority == 'low'}
				<div class="inline-block rounded-full bg-green-200 px-4 py-2 dark:bg-green-700">
					<span class="text-xs font-medium text-nowrap text-green-600 uppercase dark:text-white">Baixa</span>
				</div>
			{/if}
		</div>
	</div>
</div>
