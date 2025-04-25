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
		<!-- Barra de turno -->
		<div class="flex flex-col">
			<ProductTurn />
		</div>
	</div>
	<div class="mt-1.5 flex items-center justify-between">
		<!-- Modal Trigger -->
		<button
			type="button"
			class="rounded-lg bg-zinc-100 hover:bg-zinc-200 focus:bg-zinc-200 focus:outline-hidden dark:bg-zinc-900 dark:hover:bg-zinc-700 dark:focus:bg-zinc-700"
			aria-haspopup="dialog"
			aria-expanded="false"
			aria-controls="hs-modal-{id}"
			data-hs-overlay="#hs-modal-{id}"
		>
			<!-- Linha do tempo -->
			<ProductTimeline />
		</button>

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

<!-- Modal -->
<div
	id="hs-modal-{id}"
	class="hs-overlay pointer-events-none fixed start-0 top-0 z-80 hidden size-full overflow-x-hidden overflow-y-auto"
	role="dialog"
	tabindex="-1"
	aria-labelledby="hs-modal-label-{id}"
>
	<div
		class="hs-overlay-open:mt-7 hs-overlay-open:opacity-100 hs-overlay-open:duration-500 m-3 mt-0 flex min-h-[calc(100%-56px)] items-center opacity-0 transition-all ease-out lg:mx-auto lg:w-full lg:max-w-4xl"
	>
		<div
			class="pointer-events-auto flex w-full flex-col rounded-xl border border-gray-200 bg-white shadow-2xs dark:border-neutral-700 dark:bg-neutral-800 dark:shadow-neutral-700/70"
		>
			<!-- Calendário do produto -->
			<div class="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-neutral-700">
				<div class="flex gap-3">
					<span class="icon-[lucide--folder-git-2] size-6 shrink-0 text-zinc-400"></span>
					<h3 id="hs-modal-label-{id}" class="font-bold text-gray-800 dark:text-white">{name}</h3>
					{#if priority == 'low'}
						<span class="inline-flex items-center gap-x-1 rounded-full bg-green-200 px-3 py-1 text-xs font-medium text-green-600 uppercase">Baixa</span>
					{:else if priority == 'normal'}
						<span class="inline-flex items-center gap-x-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-500 uppercase dark:bg-blue-500">Normal</span>
					{:else if priority == 'urgent'}
						<span class="inline-flex items-center gap-x-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-500 uppercase">Urgente</span>
					{/if}
				</div>
				<button
					type="button"
					class="inline-flex size-8 items-center justify-center gap-x-2 rounded-full border border-transparent bg-gray-100 text-gray-800 hover:bg-gray-200 focus:bg-gray-200 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50 dark:bg-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-600 dark:focus:bg-neutral-600"
					aria-label="Close"
					data-hs-overlay="#hs-modal-{id}"
				>
					<span class="sr-only">Close</span>
					<span class="icon-[lucide--x] size-4 shrink-0 text-zinc-400"></span>
				</button>
			</div>
			<div class="flex flex-col divide-y divide-zinc-200">
				<ProductCalendar calendar={month1} />
				<ProductCalendar calendar={month2} />
			</div>

			<div class="flex items-center justify-end gap-x-2 border-t border-gray-200 px-4 py-3 dark:border-neutral-700">
				<button
					type="button"
					class="inline-flex items-center gap-x-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-2xs hover:bg-gray-50 focus:bg-gray-50 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
					data-hs-overlay="#hs-modal-{id}"
				>
					Fechar
				</button>
			</div>
		</div>
	</div>
</div>
