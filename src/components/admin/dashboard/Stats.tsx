import ProgressBarMultiple from '@/components/admin/dashboard/ProgressBarMultiple'

export interface StatItem {
	name: string
	progress: number
	color: string
	colorDark: string
	incidents: number
}

export default function Stats({ productCount, items }: { productCount: number; items: StatItem[] }) {
	const totalTurns = items.reduce((sum, item) => sum + item.progress, 0)
	const totalIncidents = items.reduce((sum, item) => sum + item.incidents, 0)

	return (
		<div className='flex flex-col'>
			<div className='flex gap-6'>
				<div>
					<span className='text-2xl font-medium text-zinc-800 dark:text-zinc-200'>{productCount}</span>
					<span className='ml-1 text-xl text-zinc-600 dark:text-zinc-300'>produtos</span>
				</div>
				<div>
					<span className='text-2xl font-medium text-zinc-800 dark:text-zinc-200'>{totalIncidents}</span>
					<span className='ml-1 text-xl text-zinc-600 dark:text-zinc-300'>incidentes nos últimos 28 dias</span>
				</div>
			</div>

			<div className='my-4'>
				<ProgressBarMultiple
					total={totalTurns}
					items={items.map(({ name, progress, color, colorDark }) => ({
						progress,
						color,
						colorDark,
						title: `${name}: ${progress} turnos nos últimos 28 dias`,
					}))}
				/>
			</div>

			<div className='flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-200'>
				{items.map(({ name, progress, color, colorDark }, index) => (
					<div className='flex items-center gap-1.5 cursor-default' key={index} title={`${name}: ${progress} turnos nos últimos 28 dias`}>
						<div className={`h-2 w-2 rounded-full ${color} dark:${colorDark}`} />
						<span>
							{name}: <span className='font-bold'>{progress}</span>
						</span>
					</div>
				))}
			</div>
		</div>
	)
}
