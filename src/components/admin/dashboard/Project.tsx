import ProgressBar from '@/components/admin/dashboard/ProgressBar'

export default function Project({ name, progress, time }: { name: string; progress: number; time: string }) {
	return (
		<div className='flex flex-col rounded-lg border border-dashed border-zinc-200 bg-white p-4 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-300'>
			<div className='flex w-full flex-row items-center'>
				<div className='flex w-full flex-col gap-1'>
					<div className='flex items-center gap-2'>
						<span className='icon-[lucide--square-chart-gantt] size-5 shrink-0 text-zinc-400 dark:text-zinc-500'></span>
						<span className='text-lg font-medium text-zinc-800 dark:text-zinc-100 truncate'>{name}</span>
					</div>
					<div className='flex items-center gap-2'>
						<div className='text-sm text-zinc-500 dark:text-zinc-400 shrink-0'>
							{progress}% <span className='text-zinc-400 dark:text-zinc-500'>•</span> {time}
						</div>
						{/* Barra de progresso */}
						<ProgressBar value={progress} min={0} max={100} bgColorFilled='bg-zinc-200' bgColorDarkFilled='bg-zinc-700' bgColorUnfilled='bg-blue-400' bgColorDarkUnfilled='bg-blue-500' height='h-2' />
					</div>
				</div>
			</div>
		</div>
	)
}
