<script lang="ts">
	let calendar = {
		month: 3,
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
				dateWeek: 'thuesday',
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
			},
			{
				dateDay: 29,
				dateWeek: 'saturday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'orange' },
					{ dateTurn: 12, dateStatus: 'green' },
					{ dateTurn: 18, dateStatus: 'red' }
				]
			},
			{
				dateDay: 30,
				dateWeek: 'sunday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'red' },
					{ dateTurn: 6, dateStatus: 'green' },
					{ dateTurn: 12, dateStatus: 'orange' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			},
			{
				dateDay: 31,
				dateWeek: 'monday',
				dateTurns: [
					{ dateTurn: 0, dateStatus: 'green' },
					{ dateTurn: 6, dateStatus: 'orange' },
					{ dateTurn: 12, dateStatus: 'red' },
					{ dateTurn: 18, dateStatus: 'green' }
				]
			}
		]
	}
	const monthName = (month: number): string =>
		['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][month - 1] || ''
	const weekDayLetter = (day: string): string => ({ sunday: 'D', monday: 'S', tuesday: 'T', wednesday: 'Q', thursday: 'Q', friday: 'S', saturday: 'S' })[day.toLowerCase()] || ''
	const turns = [0, 6, 12, 18]

	// Classes Tailwind
	const turn = 'flex h-5 w-5 items-center justify-end pt-0.5 pr-1 text-center text-xs font-bold text-neutral-400 dark:text-neutral-400'
	const dayNormal = 'py-2 flex-col rounded-sm bg-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800'
	const dayWeekend = 'py-2 bg-neutral-50 rounded-sm hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-600'
	const dayWeek = 'flex h-5 w-5 items-center justify-center text-xs text-neutral-300 dark:text-neutral-500'
	const dayNumber = 'flex h-5 w-5 items-center justify-center text-xs font-bold text-neutral-400 dark:text-neutral-400'
	const dayTurn = 'flex h-5 w-5 items-center justify-center'
	const dayButton = 'flex h-4 w-4 items-center justify-center rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-600'
	const dayGreen = 'h-2.5 w-2.5 rounded-full bg-green-200 dark:bg-green-900'
	const dayOrange = 'h-2.5 w-2.5 rounded-full bg-orange-400'
	const dayRed = 'h-2.5 w-2.5 rounded-full bg-red-600'
	const dayNone = 'h-2.5 w-2.5 rounded-full bg-transparent'
</script>

<!-- Mês -->

<!-- Month -->
<div class="flex flex-col rounded-lg border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
	<div class="flex flex-col rounded-lg text-neutral-600 dark:text-neutral-400">
		<div class="text-md flex justify-between bg-neutral-100 px-4 py-3 text-neutral-800">
			<div class="text-neutral-600">{monthName(calendar.month)}</div>
			<div class="text-neutral-400">{calendar.year}</div>
		</div>
		<div class="flex px-2">
			<!-- Turnos -->
			<div class="flex-col py-2">
				<div class="h-5 w-5"></div>
				<div class="h-5 w-5"></div>
				{#each turns as turnValue}
					<div class={turn}>{turnValue}</div>
				{/each}
			</div>
			<!-- Dias do mês -->
			{#each calendar.dates as date (date.dateDay)}
				<div class={date.dateWeek === 'saturday' || date.dateWeek === 'sunday' ? dayWeekend : dayNormal}>
					<div class={dayWeek}>{weekDayLetter(date.dateWeek)}</div>
					<div class={dayNumber}>{date.dateDay}</div>
					{#each date.dateTurns as turn}
						<div class={dayTurn}>
							<div class={dayButton}>
								<div class={turn.dateStatus === 'green' ? dayGreen : turn.dateStatus === 'orange' ? dayOrange : turn.dateStatus === 'red' ? dayRed : ''}></div>
							</div>
						</div>
					{/each}
				</div>
			{/each}
		</div>
	</div>
</div>
