export default function AuthDivider({ children }: { children: React.ReactNode }) {
	return <div className='flex items-center py-3 before:me-6 before:flex-1 before:border-t before:border-zinc-200 after:ms-6 after:flex-1 after:border-t after:border-zinc-200 dark:before:border-zinc-600 dark:after:border-zinc-600'>{children}</div>
}
