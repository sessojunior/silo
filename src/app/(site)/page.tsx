import Link from 'next/link'

export default function HomePage() {
	return (
		<div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden before:absolute before:start-1/2 before:top-0 before:-z-1 before:size-full before:-translate-x-1/2 before:transform before:bg-[url('/images/background-home.svg')] before:bg-cover before:bg-top before:bg-no-repeat">
			<div className='mx-auto max-w-[85rem] px-4 pt-24 pb-10 sm:px-6 lg:px-8'>
				{/* Banner */}
				<div className='flex justify-center'>
					<Link href='/register' className='group inline-flex items-center gap-x-2 rounded-full border border-zinc-200 bg-white p-1 ps-3 text-sm text-zinc-800 transition hover:border-zinc-400 focus:border-zinc-300 focus:outline-hidden'>
						Crie sua conta agora mesmo!
						<span className='inline-flex items-center justify-center gap-x-2 rounded-full bg-zinc-100 px-2.5 py-1.5 text-sm font-semibold text-zinc-600 group-hover:bg-zinc-200'>
							<span className='icon-[lucide--chevron-right]'></span>
						</span>
					</Link>
				</div>

				{/* Titulo */}
				<div className='mx-auto mt-5 max-w-2xl text-center'>
					<h1 className='block text-4xl font-bold text-zinc-800 md:text-5xl lg:text-6xl'>
						<span>Bem-vindo ao </span>
						<span className='bg-linear-to-tl from-blue-600 to-violet-600 bg-clip-text text-transparent'>Silo</span>
					</h1>
				</div>

				{/* Subtitulo */}
				<div className='mx-auto mt-5 max-w-3xl text-center'>
					<p className='text-lg text-zinc-600'>Silo é um aplicativo de gerenciamento de produtos e tarefas para o CPTEC, INPE.</p>
				</div>

				{/* Botão */}
				<div className='mt-8 flex justify-center gap-3'>
					<Link href='/login' className='inline-flex items-center justify-center gap-x-3 rounded-md border border-transparent bg-linear-to-tl from-blue-600 to-violet-600 px-4 py-3 text-center text-base font-medium text-white hover:from-violet-600 hover:to-blue-600 focus:from-violet-600 focus:to-blue-600 focus:outline-hidden'>
						Entrar no aplicativo
					</Link>
				</div>
			</div>
		</div>
	)
}
