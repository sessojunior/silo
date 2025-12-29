import CircleProgress from '@/components/admin/dashboard/CircleProgress'

export default function Radial({ name, progress, color, colorDark, title }: { name: string; progress: number; color: string; colorDark: string; title: string }) {
	return (
		<div className='flex flex-col items-center justify-center gap-1.5 px-2 py-6' title={title}>
			<CircleProgress percent={progress} strokeWidth={4} size='size-20' fontSize='text-base' fontColor='text-zinc-600' fontColorDark='text-zinc-200' colorFilled='text-zinc-200' colorDarkFilled='text-zinc-600' colorUnfilled={color} colorDarkUnfilled={colorDark} />
			<div className='text-base font-medium'>{name}</div>
		</div>
	)
}
