<script lang="ts">
	import { getContext } from 'svelte'

	import Product from '$lib/client/components/app/dashboard/Product.svelte'
	import ChartColumn from '$lib/client/components/app/dashboard/ChartColumn.svelte'
	import ChartDonut from '$lib/client/components/app/dashboard/ChartDonut.svelte'
	import ChartLine from '$lib/client/components/app/dashboard/ChartLine.svelte'

	// Pega os dados da página por meio do context
	const contextPage = getContext<{ title: string }>('contextPage')

	// Atualiza o título da página dinamicamente
	contextPage.title = 'Visão geral'
</script>

<div class="flex w-full bg-white dark:bg-zinc-900">
	<!-- Side left -->
	<div class="flex flex-grow flex-col">
		<div
			class="size-full h-[calc(100vh-64px)] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-500 [&::-webkit-scrollbar-track]:bg-zinc-50 dark:[&::-webkit-scrollbar-track]:bg-zinc-700"
		>
			<!-- Stats -->
			<div class="flex flex-col border-b border-b-zinc-200 p-8 pb-10 dark:border-b-zinc-700">
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
							color: 'bg-zinc-200',
							colorDark: 'bg-zinc-700'
						}
					]
				})}
			</div>

			<!-- Columns -->
			<div class="flex flex-col divide-zinc-200 border-zinc-200 md:grid md:grid-cols-2 md:divide-x dark:divide-zinc-700 dark:border-zinc-700 dark:border-b-zinc-700">
				<!-- Column left -->
				<div class="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-700">
					<!-- Products & tasks -->
					<!-- Item 1 -->
					<div class="p-8">
						<h3 class="pb-4 text-xl font-medium text-zinc-500 dark:text-zinc-400">Produtos não iniciados</h3>
						<div class="flex flex-col gap-3">
							<!-- Product item -->
							<Product id="bam" name="BAM" progress={84} priority="low" date="21 mar. 16:35" />
							<!-- Product item -->
							<Product id="smec" name="SMEC" progress={91} priority="normal" date="21 mar. 09:41" />
						</div>
					</div>
					<!-- Item 2 -->
					<div class="p-8">
						<h3 class="pb-4 text-xl font-medium text-orange-500">Produtos rodando</h3>
						<div class="flex flex-col">
							<!-- Product item -->
							<Product id="brams_15km" name="BRAMS 15 km" progress={78} priority="urgent" date="21 mar. 11:17" />
						</div>
					</div>
					<!-- Item 3 -->
					<div class="p-8">
						<h3 class="pb-4 text-xl font-medium text-green-500">Produtos finalizados</h3>
						<div class="flex flex-col"></div>
					</div>
				</div>
				<!-- Column right -->
				<div class="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-700">
					<!-- Charts -->
					<!-- Item 1 -->
					<div class="flex flex-col p-8">
						<h3 class="pb-2 text-xl font-medium">Incidentes por data</h3>
						<div class="mx-auto -mb-4 w-full">
							<ChartColumn />
						</div>
					</div>
					<!-- Item 2 -->
					<div class="flex flex-col p-8">
						<h3 class="pb-2 text-xl font-medium">Causas de problemas</h3>
						<div class="flex">
							<div class="mx-auto w-full">
								<ChartDonut />
							</div>
						</div>
					</div>
					<!-- Item 3 -->
					<div class="flex flex-col p-8">
						<h3 class="pb-2 text-xl font-medium">Problemas & soluções</h3>
						<div class="flex">
							<div class="mx-auto w-full">
								<ChartLine />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Side right -->
	<div class="hidden w-[400px] flex-shrink-0 flex-col border-l border-l-zinc-200 2xl:flex dark:border-l-zinc-700">
		<div
			class="size-full h-[calc(100vh-64px)] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-500 [&::-webkit-scrollbar-track]:bg-zinc-50 dark:[&::-webkit-scrollbar-track]:bg-zinc-700"
		>
			<div class="p-8">
				<!-- Resume text -->
				<div class="flex flex-col border-b border-b-zinc-200 pb-6 dark:border-b-zinc-700">
					<h3 class="pb-4 text-2xl font-medium">Resumo do dia</h3>
					<p class="text-base">
						Hoje você tem
						<strong>20%</strong>
						mais problemas que o normal, você resolveu
						<strong>3 problemas</strong> em dois projetos, mas o foco está
						<strong>12%</strong>
						menor.
					</p>
				</div>

				<!-- Activity resume -->
				<div class="grid grid-cols-2 border-b border-b-zinc-200 py-6 dark:border-b-zinc-700">
					<div>
						<h4 class="pb-2 text-base font-medium">Tempo parado</h4>
						<div>
							<span class="text-xl font-medium">6h 18min</span>
						</div>
					</div>
					<div>
						<h4 class="pb-2 text-base font-medium">Produtos finalizados</h4>
						<div>
							<span class="flex items-center">
								{@render circleProgress({
									percent: 79,
									strokeWidth: 4,
									showText: false,
									size: 'size-6',
									fontSize: 'text-sm',
									fontColor: 'text-zinc-600',
									fontColorDark: 'text-zinc-200',
									colorFilled: 'text-zinc-200',
									colorDarkFilled: 'text-zinc-600',
									colorUnfilled: 'text-blue-500',
									colorDarkUnfilled: 'text-blue-600'
								})}
								<span class="px-2 text-xl font-medium"> 79% </span>
								<span class="pt-0.5 text-sm text-zinc-400">17 de 23</span>
							</span>
						</div>
					</div>
				</div>

				<!-- Radial Progress -->
				<div class="grid w-full grid-cols-3 divide-x divide-zinc-200 border-b border-b-zinc-200 dark:divide-zinc-700 dark:border-b-zinc-700">
					{@render radial({
						name: 'Produtos',
						progress: 16,
						color: 'text-purple-500',
						colorDark: 'text-purple-600'
					})}
					{@render radial({
						name: 'Processos',
						progress: 77,
						color: 'text-teal-500',
						colorDark: 'text-teal-600'
					})}
					{@render radial({
						name: 'Projetos',
						progress: 63,
						color: 'text-rose-400',
						colorDark: 'text-rose-500'
					})}
				</div>

				<!-- Ongoing projects -->
				<div class="flex flex-col py-6">
					<h3 class="pb-4 text-xl font-medium text-zinc-800">Projetos em andamento</h3>
					<div class="flex flex-col gap-3">
						<!-- Project item -->
						{@render project({
							name: 'Nome do projeto 1',
							progress: 56,
							time: '14 dias'
						})}
						<!-- Project item -->
						{@render project({
							name: 'Nome do projeto 2',
							progress: 78,
							time: '69 dias'
						})}
						<!-- Project item -->
						{@render project({
							name: 'Nome do projeto 3',
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
				<span class="text-2xl font-medium text-zinc-800 dark:text-zinc-200">{items.reduce((total: number, item: any) => total + item.progress, 0)}</span>
				<span class="text-xl font-medium text-zinc-800 dark:text-zinc-200">produtos</span>
			</div>
			<div>
				<span class="text-2xl font-medium text-zinc-800 dark:text-zinc-200">{items.reduce((total: number, item: any) => total + item.incidents, 0)}</span>
				<span class="text-xl font-medium text-zinc-800 dark:text-zinc-200">incidentes hoje</span>
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
			<div class="text-muted-foreground flex items-center text-sm">
				<div class="flex flex-wrap gap-x-6 gap-y-1 text-zinc-600 dark:text-zinc-200">
					{#each items as { name, progress, color, colorDark }: any}
						<div class="flex items-center">
							<div class="mr-1.5 h-2 w-2 shrink-0 rounded-full {color} dark:{colorDark}"></div>
							<div>
								<span>{name}: <span class="font-bold">{progress}</span></span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
{/snippet}

{#snippet radial({ name, progress, color, colorDark }: any)}
	<div class="flex flex-col items-center justify-center gap-1.5 px-2 py-6">
		{@render circleProgress({
			percent: progress,
			strokeWidth: 4,
			showText: true,
			size: 'size-20',
			fontSize: 'text-base',
			fontColor: 'text-zinc-600',
			fontColorDark: 'text-zinc-200',
			colorFilled: 'text-zinc-200',
			colorDarkFilled: 'text-zinc-600',
			colorUnfilled: color,
			colorDarkUnfilled: colorDark
		})}
		<div class="text-base font-medium">{name}</div>
	</div>
{/snippet}

{#snippet project({ name, progress, time }: any)}
	<div class="flex flex-col rounded-lg border border-dashed border-zinc-200 bg-white p-4 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
		<div class="flex w-full flex-row items-center">
			<div class="flex w-full flex-col">
				<div class="flex items-center gap-2">
					<span class="icon-[lucide--square-chart-gantt] size-5 shrink-0 text-zinc-400"></span>
					<span class="text-lg font-medium">{name}</span>
				</div>
				<div class="flex items-center">
					<div class="w-40 text-sm">
						{progress}% <span class="text-zinc-300">•</span>
						{time}
					</div>
					<!-- Progress -->
					{@render progressBar({
						value: progress,
						min: 0,
						max: 100,
						bgColorFilled: 'bg-zinc-200',
						bgColorDarkFilled: 'bg-zinc-700',
						bgColorUnfilled: 'bg-blue-400',
						bgColorDarkUnfilled: 'bg-blue-500',
						height: 'h-2'
					})}
				</div>
			</div>
		</div>
	</div>
{/snippet}

{#snippet progressBar({ value, min, max, bgColorFilled, bgColorDarkFilled, bgColorUnfilled, bgColorDarkUnfilled, height }: any)}
	<div
		class="flex {height} w-full overflow-hidden rounded-full {bgColorFilled} dark:{bgColorDarkFilled}"
		role="progressbar"
		aria-valuenow={value}
		aria-valuemin={min}
		aria-valuemax={max}
	>
		<div style="width: {value}%" class="flex flex-col justify-center overflow-hidden rounded-full {bgColorUnfilled} dark:{bgColorDarkUnfilled} transition duration-500"></div>
	</div>
{/snippet}

{#snippet progressBarMultiple({ items, total }: { items: any; total: number })}
	<div class="flex h-2 w-full gap-1 overflow-hidden rounded bg-zinc-200 text-xs dark:bg-zinc-700">
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

{#snippet circleProgress({ percent, strokeWidth, showText, size, fontSize, fontColor, fontColorDark, colorFilled, colorDarkFilled, colorUnfilled, colorDarkUnfilled }: any)}
	<div class="relative {size}">
		<svg class="size-full rotate-90" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
			<!-- Background Circle -->
			<circle cx="18" cy="18" r="16" fill="none" class="stroke-current {colorFilled} dark:{colorDarkFilled}" stroke-width={strokeWidth}></circle>
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
				<span class="text-center {fontSize} font-bold {fontColor} dark:{fontColorDark}">{percent}%</span>
			</div>
		{/if}
	</div>
{/snippet}
