export default function TopbarTitle({ children }: { children: React.ReactNode }) {
	return (
		<div className='hidden items-center gap-x-2 sm:flex'>
			<h2 className='inline-flex px-2 pb-1 text-2xl font-medium text-zinc-800 dark:text-zinc-100'>{children}</h2>
		</div>
	)
}
