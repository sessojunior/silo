export default function ProgressBarMultiple({ items, total }: { items: { progress: number; color: string; colorDark: string; title: string }[]; total: number }) {
	return (
		<div className='relative flex h-2.5 w-full gap-1 overflow-visible rounded bg-zinc-200 text-xs dark:bg-zinc-700'>
			{items.map(({ progress, color, colorDark, title }, index) => (
				<div
					key={index}
					className={`flex flex-col justify-center overflow-hidden rounded-full ${color} dark:${colorDark} text-center text-xs whitespace-nowrap text-white transition-transform duration-150 origin-bottom hover:scale-y-150 hover:z-10`}
					style={{
						width: `${(progress / total) * 100}%`,
					}}
					role='progressbar'
					aria-valuenow={(progress / total) * 100}
					aria-valuemin={0}
					aria-valuemax={100}
					title={title}
				/>
			))}
		</div>
	)
}
