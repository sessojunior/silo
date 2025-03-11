<script lang="ts"></script>

<div class="flex w-full bg-white dark:bg-neutral-900">
	<!-- Side left -->
	<div class="flex flex-grow flex-col">
		<div
			class="size-full h-[calc(100vh-64px)] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-300 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500 [&::-webkit-scrollbar-track]:bg-neutral-100 dark:[&::-webkit-scrollbar-track]:bg-neutral-700"
		>
			<!-- Graphs -->
			<div class="grid grid-cols-2 border-b border-b-neutral-200 dark:border-b-neutral-700">
				<div
					class="flex flex-col border-r border-r-neutral-200 px-8 py-6 dark:border-r-neutral-700"
				>
					<h3 class="pb-2 text-lg font-medium">Incidentes por data</h3>
					<div class="mx-auto -mb-10 w-full max-w-96">
						<!-- <ColumnChart /> -->
					</div>
				</div>
				<div class="flex flex-col px-8 py-6">
					<h3 class="pb-2 text-lg font-medium">Causas de problemas</h3>
					<div class="flex">
						<div class="mx-auto w-full max-w-96">
							<!-- <DonutChart /> -->
						</div>
					</div>
				</div>
			</div>

			<!-- Stats -->
			<div class="flex flex-col border-b border-b-neutral-200 px-8 py-6 dark:border-b-neutral-700">
				{@render stats({
					items: [
						{
							name: 'Em execução',
							incidents: 0,
							progress: 18,
							color: 'bg-blue-400',
							colorDark: 'bg-blue-700'
						},
						{
							name: 'Precisam de atenção',
							incidents: 13,
							progress: 13,
							color: 'bg-orange-400',
							colorDark: 'bg-orange-700'
						},
						{
							name: 'Com problemas',
							incidents: 6,
							progress: 6,
							color: 'bg-red-400',
							colorDark: 'bg-red-700'
						},
						{
							name: 'Falta rodar',
							incidents: 0,
							progress: 9,
							color: 'bg-neutral-200',
							colorDark: 'bg-neutral-700'
						}
					]
				})}
			</div>

			<!-- Products & tasks -->
			<div class="flex flex-col px-8 py-6">
				<h3 class="pb-2 text-lg font-medium text-red-500">Não iniciado</h3>
				<div class="mt-2 flex flex-col">
					<!-- Product item -->
					<!-- <Product1 /> -->
					<!-- Product item -->
					<!-- <Product2 /> -->
				</div>
				<h3 class="pb-2 text-lg font-medium text-orange-500">Rodando</h3>
				<div class="mt-2 flex flex-col">
					<!-- Product item -->
					<!-- <Product3 /> -->
				</div>
				<h3 class="pb-2 text-lg font-medium text-green-500">Finalizado</h3>
				<div class="mt-2 flex flex-col"></div>
			</div>
		</div>
	</div>

	<!-- Side right -->
	<div
		class="hidden w-[400px] flex-shrink-0 flex-col border-l border-l-neutral-200 lg:flex dark:border-l-neutral-700"
	>
		<div
			class="size-full h-[calc(100vh-64px)] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-300 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500 [&::-webkit-scrollbar-track]:bg-neutral-100 dark:[&::-webkit-scrollbar-track]:bg-neutral-700"
		>
			<div class="px-8 py-6">
				<!-- Resume text -->
				<div class="flex flex-col border-b border-b-neutral-200 pb-6 dark:border-b-neutral-700">
					<h2 class="pb-4 text-xl font-medium">Resumo do dia</h2>
					<p class="text-sm">
						Hoje você tem
						<strong>20%</strong>
						mais problemas que o normal, você resolveu
						<strong>3 problemas</strong> em dois projetos, mas o foco está
						<strong>12%</strong>
						menor.
					</p>
				</div>

				<!-- Activity resume -->
				<div class="grid grid-cols-2 border-b border-b-neutral-200 py-6 dark:border-b-neutral-700">
					<div>
						<h4 class="pb-2 text-sm font-medium">Processos rodando</h4>
						<div>
							<span class="text-xl font-medium">6h 18min</span>
						</div>
					</div>
					<div>
						<h4 class="pb-2 text-sm font-medium">Produtos concluídos</h4>
						<div>
							<span class="flex items-center">
								{@render circleProgress({
									percent: 79,
									strokeWidth: 4,
									showText: false,
									size: 'size-6',
									fontSize: 'text-sm',
									fontColor: 'text-neutral-600',
									fontColorDark: 'text-neutral-200',
									colorFilled: 'text-neutral-200',
									colorDarkFilled: 'text-neutral-600',
									colorUnfilled: 'text-blue-500',
									colorDarkUnfilled: 'text-blue-600'
								})}
								<span class="px-2 text-xl font-medium"> 79% </span>
								<span class="pt-0.5 text-sm text-neutral-400">17 de 23</span>
							</span>
						</div>
					</div>
				</div>

				<!-- Radial Progress -->
				<div
					class="grid w-full grid-cols-4 border-b border-b-neutral-200 dark:border-b-neutral-700"
				>
					{@render radial({
						name: 'Produtos',
						progress: 16,
						color: 'text-purple-500',
						colorDark: 'text-purple-600',
						borderRight: true
					})}
					{@render radial({
						name: 'Processos',
						progress: 77,
						color: 'text-teal-500',
						colorDark: 'text-teal-600',
						borderRight: true
					})}
					{@render radial({
						name: 'Projetos',
						progress: 63,
						color: 'text-rose-400',
						colorDark: 'text-rose-500',
						borderRight: true
					})}
					{@render radial({
						name: 'Outros',
						progress: 37,
						color: 'text-neutral-400',
						colorDark: 'text-neutral-400',
						borderRight: false
					})}
				</div>

				<!-- Ongoing projects -->
				<div class="flex flex-col py-6">
					<h3 class="pb-2 text-lg font-medium">Projetos em andamento</h3>
					<div class="mt-4 flex flex-col gap-3">
						<!-- Project item -->
						{@render project({
							name: 'Projeto 1',
							progress: 56,
							time: '14 dias'
						})}
						<!-- Project item -->
						{@render project({
							name: 'Projeto 2',
							progress: 78,
							time: '69 dias'
						})}
						<!-- Project item -->
						{@render project({
							name: 'Projeto 3',
							progress: 19,
							time: '9 dias'
						})}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

{#snippet stats({ items }: any)}
	<div class="flex flex-col">
		<div class="flex gap-4">
			<div>
				<span class="text-xl font-bold"
					>{items.reduce((total: number, item: any) => total + item.progress, 0)}</span
				> produtos
			</div>
			<div>
				<span class="text-xl font-bold"
					>{items.reduce((total: number, item: any) => total + item.incidents, 0)}</span
				> incidentes hoje
			</div>
		</div>
		<div class="relative">
			<div class="my-2">
				{@render progressBarMultiple({
					total: items.reduce((total: number, item: any) => total + item.progress, 0),
					items: items.map(({ progress, color, colorDark }: any) => ({
						progress: progress,
						color: color,
						colorDark: colorDark
					}))
				})}
			</div>
			<div class="text-muted-foreground flex items-center text-xs">
				<div class="flex flex-wrap gap-x-6 gap-y-1 text-neutral-600 dark:text-neutral-200">
					{#each items as { name, progress, color, colorDark }: any}
						<div class="flex items-center">
							<div class="mr-1.5 h-2 w-2 shrink-0 rounded-full {color} dark:{colorDark}"></div>
							<div>
								<span>{name}1: <span class="font-bold">{progress}</span></span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
{/snippet}

{#snippet radial({ name, progress, color, colorDark, borderRight }: any)}
	<div
		class="flex flex-col items-center justify-center gap-1.5 px-2 py-6 {borderRight &&
			'border-r border-r-neutral-200 dark:border-r-neutral-700'}"
	>
		{@render circleProgress({
			percent: progress,
			strokeWidth: 4,
			showText: true,
			size: 'size-16',
			fontSize: 'text-sm',
			fontColor: 'text-neutral-600',
			fontColorDark: 'text-neutral-200',
			colorFilled: 'text-neutral-200',
			colorDarkFilled: 'text-neutral-600',
			colorUnfilled: color,
			colorDarkUnfilled: colorDark
		})}
		<div class="text-sm font-medium">{name}</div>
	</div>
{/snippet}

{#snippet project({ name, progress, time }: any)}
	<div class="flex w-full flex-row text-sm">
		<div class="mr-2">
			<button
				type="button"
				class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-100 bg-white text-neutral-800 shadow-sm hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
				aria-label="Abrir projeto"
			>
				<span class="icon-[lucide--square-chart-gantt] size-4 shrink-0"></span>
			</button>
		</div>
		<div class="flex w-full flex-col">
			<div class="py-0.5 font-medium">{name}</div>
			<div class="flex items-center">
				<div class="w-40 text-xs leading-none">
					{progress}% <span class="text-neutral-200">•</span>
					{time}
				</div>
				<!-- Progress -->
				{@render progressBar({
					value: progress,
					min: 0,
					max: 100,
					bgColorFilled: 'bg-neutral-200',
					bgColorDarkFilled: 'bg-neutral-700',
					bgColorUnfilled: 'bg-blue-300',
					bgColorDarkUnfilled: 'bg-blue-500',
					height: 'h-2'
				})}
			</div>
		</div>
	</div>
{/snippet}

{#snippet progressBar({
	value,
	min,
	max,
	bgColorFilled,
	bgColorDarkFilled,
	bgColorUnfilled,
	bgColorDarkUnfilled,
	height
}: any)}
	<div
		class="flex {height} w-full overflow-hidden rounded-full {bgColorFilled} dark:{bgColorDarkFilled}"
		role="progressbar"
		aria-valuenow={value}
		aria-valuemin={min}
		aria-valuemax={max}
	>
		<div
			style="width: {value}%"
			class="flex flex-col justify-center overflow-hidden rounded-full {bgColorUnfilled} dark:{bgColorDarkUnfilled} transition duration-500"
		></div>
	</div>
{/snippet}

{#snippet progressBarMultiple({ items, total }: { items: any; total: number })}
	<div
		class="flex h-2 w-full gap-1 overflow-hidden rounded bg-neutral-200 text-xs dark:bg-neutral-700"
	>
		{#each items as { progress, color, colorDark }}
			<div
				class="flex flex-col justify-center overflow-hidden rounded-full {color} dark:{colorDark} text-center text-xs whitespace-nowrap text-white"
				style="width: {(progress / total) * 100}%"
				role="progressbar"
				aria-valuenow={(progress / total) * 100}
				aria-valuemin="0"
				aria-valuemax="100"
			></div>
		{/each}
	</div>
{/snippet}

{#snippet circleProgress({
	percent,
	strokeWidth,
	showText,
	size,
	fontSize,
	fontColor,
	fontColorDark,
	colorFilled,
	colorDarkFilled,
	colorUnfilled,
	colorDarkUnfilled
}: any)}
	<div class="relative {size}">
		<svg class="size-full rotate-90" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
			<!-- Background Circle -->
			<circle
				cx="18"
				cy="18"
				r="16"
				fill="none"
				class="stroke-current {colorFilled} dark:{colorDarkFilled}"
				stroke-width={strokeWidth}
			></circle>
			<!-- Progress Circle -->
			<circle
				cx="18"
				cy="18"
				r="16"
				fill="none"
				class="stroke-current {colorUnfilled} dark:{colorDarkUnfilled}"
				stroke-width={strokeWidth}
				stroke-dasharray="100"
				stroke-dashoffset={100 - percent}
				stroke-linecap="round"
			></circle>
		</svg>
		<!-- Percentage Text -->
		{#if showText}
			<div class="absolute start-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform">
				<span class="text-center {fontSize} font-bold {fontColor} dark:{fontColorDark}"
					>{percent}%</span
				>
			</div>
		{/if}
	</div>
{/snippet}
