import Image from 'next/image'

export default function SidebarLogo() {
	return (
		<div className='flex items-center'>
			<Image src='/images/logo.png' alt='Logo' width={32} height={32} className='-ml-1 block h-8 w-8' />
			<div 
				className={`inline-block px-1 text-zinc-600 dark:text-zinc-200 text-2xl font-bold tracking-[-0.5px] flex-1 m-0 uppercase`}
				style={{
					fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
				}}
			>
				SILO
			</div>
		</div>
	)
}
