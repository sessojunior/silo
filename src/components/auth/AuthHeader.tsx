export default function AuthHeader({ icon, title, description }: { icon: string; title: string; description: string }) {
	return (
		<>
			<div className='mx-auto mb-4 flex size-14 items-center justify-center rounded-lg border border-zinc-200 bg-white dark:bg-zinc-900 dark:border-zinc-700 dark:text-white'>
				<span className={`${icon} size-6`}></span>
			</div>
			<h1 className='text-center text-3xl font-bold tracking-tight text-zinc-600 dark:text-zinc-200'>{title}</h1>
			<p className='mt-1 text-center text-base text-zinc-600 dark:text-zinc-200'>{description}</p>
		</>
	)
}
