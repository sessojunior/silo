import React from 'react'

export default function ProductSkeleton() {
	return (
		<div className='flex flex-col rounded-lg border border-dashed border-zinc-200 bg-white p-4 animate-pulse dark:border-zinc-700 dark:bg-zinc-900'>
			<div className='flex items-center justify-between'>
				<div className='flex flex-col gap-1'>
					<div className='h-5 w-36 rounded-md bg-zinc-200 dark:bg-zinc-700'></div>
					<div className='h-3 w-24 rounded-md bg-zinc-100 dark:bg-zinc-700'></div>
				</div>
				<div className='flex gap-1'>
					{[...Array(3)].map((_, i) => (
						<div key={i} className='h-5 w-10 rounded-md bg-zinc-200 dark:bg-zinc-700'></div>
					))}
				</div>
			</div>
			<div className='mt-2 flex items-center justify-between gap-16'>
				<div className='h-5 flex-grow rounded-md bg-zinc-200 dark:bg-zinc-700'></div>
				<div className='h-5 w-14 rounded-md bg-zinc-200 dark:bg-zinc-700'></div>
			</div>
		</div>
	)
}
