export default function ProgressBar({ value, min = 0, max = 100, height = 'h-2', bgColorFilled = 'bg-zinc-200', bgColorDarkFilled = 'bg-zinc-700', bgColorUnfilled = 'bg-green-600', bgColorDarkUnfilled = 'bg-green-400' }: { value: number; min?: number; max?: number; height?: string; bgColorFilled?: string; bgColorDarkFilled?: string; bgColorUnfilled?: string; bgColorDarkUnfilled?: string }) {
	const percentage = (Math.min(Math.max(value, min), max) / (max - min)) * 100

	return (
		<div className={`flex w-full overflow-hidden rounded-full ${height} ${bgColorFilled} dark:${bgColorDarkFilled}`} role='progressbar' aria-valuenow={value} aria-valuemin={min} aria-valuemax={max}>
			<div style={{ width: `${percentage}%` }} className={`transition-all duration-500 rounded-full ${bgColorUnfilled} dark:${bgColorDarkUnfilled}`}></div>
		</div>
	)
}
