<script lang="ts">
	let { calendar } = $props()

	const monthFullName = (month: number): string =>
		['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][month - 1] || ''
	const weekDayLetter = (day: string): string => ({ sunday: 'D', monday: 'S', tuesday: 'T', wednesday: 'Q', thursday: 'Q', friday: 'S', saturday: 'S' })[day.toLowerCase()] || ''
	const turns = [0, 6, 12, 18]

	// Classes Tailwind
	const turn = 'flex h-5 items-center justify-end pt-0.5 px-1.5 text-center text-xs font-bold text-neutral-400 dark:text-neutral-400'
	const dayNormal = 'py-2 flex-col rounded-sm bg-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800'
	const dayWeekend = 'py-2 bg-amber-50 rounded-sm hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-600'
	const dayWeekNormal = 'flex h-5 w-5 items-center justify-center text-xs text-neutral-300 dark:text-neutral-500'
	const dayWeekWeekend = 'flex h-5 w-5 items-center justify-center text-xs text-neutral-400 dark:text-neutral-500'
	const dayNumber = 'flex h-5 w-5 items-center justify-center text-xs font-bold text-neutral-400 dark:text-neutral-400'
	const dayTurn = 'flex h-5 w-5 items-center justify-center'
	const dayButton = 'flex h-4 w-4 items-center justify-center rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-600'
	const dayGreen = 'h-2.5 w-2.5 rounded-full bg-green-200 dark:bg-green-900'
	const dayOrange = 'h-2.5 w-2.5 rounded-full bg-orange-400'
	const dayRed = 'h-2.5 w-2.5 rounded-full bg-red-600'
	const dayNone = 'h-2.5 w-2.5 rounded-full bg-transparent'
	const monthName = 'flex h-5 w-20 items-center justify-end px-1.5 text-xs font-bold text-neutral-400 dark:text-neutral-400'
</script>

<!-- Mês -->
<div class="flex px-2">
	<!-- Turnos -->
	<div class="flex-col py-2">
		<div class={monthName}>{monthFullName(calendar.month)}</div>
		<div class="h-5 w-5"></div>
		{#each turns as turnValue}
			<div class={turn}>{turnValue}</div>
		{/each}
	</div>
	<!-- Dias do mês -->
	{#each calendar.dates as date, index (date.dateDay)}
		<div
			class="{date.dateWeek === 'saturday' || date.dateWeek === 'sunday' ? dayWeekend : dayNormal}
      {index === 0 ? 'border-r border-l border-neutral-200' : ''}
      {index !== calendar.dates.length - 1 ? 'border-r border-neutral-200' : ''}"
		>
			<div class={date.dateWeek === 'saturday' || date.dateWeek === 'sunday' ? dayWeekWeekend : dayWeekNormal}>{weekDayLetter(date.dateWeek)}</div>
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
