import { clsx } from 'clsx'

interface SkeletonProps {
	className?: string
}

export default function Skeleton({ className }: SkeletonProps) {
	return <div className={clsx('animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700', className)} />
}
