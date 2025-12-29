export default function CircleProgress({ percent, strokeWidth = 4, showText = true, size = 'w-20 h-20', fontSize = 'text-sm', fontColor = 'text-zinc-800', fontColorDark = 'dark:text-zinc-100', colorFilled = 'text-zinc-200', colorDarkFilled = 'dark:text-zinc-700', colorUnfilled = 'text-green-500', colorDarkUnfilled = 'dark:text-green-400' }: { percent: number; strokeWidth?: number; showText?: boolean; size?: string; fontSize?: string; fontColor?: string; fontColorDark?: string; colorFilled?: string; colorDarkFilled?: string; colorUnfilled?: string; colorDarkUnfilled?: string }) {
	return (
		<div className={`relative ${size}`}>
			{/* Círculo */}
			<svg className='size-full rotate-90' viewBox='0 0 36 36' xmlns='http://www.w3.org/2000/svg'>
				{/* Fundo */}
				<circle cx='18' cy='18' r='16' fill='none' className={`stroke-current ${colorFilled} dark:${colorDarkFilled}`} strokeWidth={strokeWidth}></circle>
				{/* Progresso */}
				<circle cx='18' cy='18' r='16' fill='none' className={`stroke-current ${colorUnfilled} dark:${colorDarkUnfilled}`} strokeWidth={strokeWidth} strokeDasharray='100' strokeDashoffset={100 - percent} strokeLinecap='round'></circle>
			</svg>

			{/* Texto de porcentagem */}
			{showText && (
				<div className='absolute start-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform'>
					<span className={`text-center font-bold ${fontSize} ${fontColor} dark:${fontColorDark}`}>{percent}%</span>
				</div>
			)}
		</div>
	)
}
