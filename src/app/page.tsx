import { auth } from "@/auth-node"
import Link from "next/link"
import { Button } from "@/components/ui/button"

import { getUsers, getUsers2 } from "@/drizzle/db"

export default async function HomePage() {
	const session = await auth()
	const data = await getUsers()
	const data2 = await getUsers2()

	return (
		<main className='flex flex-col items-center justify-center min-h-screen bg-gray-50'>
			<h1 className='text-6xl font-bold text-gray-800 mb-2'>Silo</h1>
			<h2 className='text-2xl font-bold text-gray-800 mb-6'>Sistema de Gerenciamento de Serviços</h2>
			<p className='text-gray-600 mb-4'>Acesse ou crie sua conta para começar.</p>

			<div className='space-x-4'>
				<Link href='/login'>
					<Button variant='default'>Login</Button>
				</Link>
				<Link href='/register'>
					<Button variant='outline'>Registre-se</Button>
				</Link>
			</div>

			<div className='flex flex-col justify-center items-center text-center mt-8'>
				<h3>Testando a aplicação:</h3>
				<div>sql-like: {JSON.stringify(data)}</div>
				<div>relational: {JSON.stringify(data2)}</div>
			</div>

			{!session ? (
				<div className='m-4'>Usuário não autenticado.</div>
			) : (
				<div className='flex flex-col justify-center items-center text-center mt-8'>
					<h3>Usuário autenticado:</h3>
					<div>{JSON.stringify(session, null, 2)}</div>
					<div className='m-4'>
						<Link href='/admin/profile'>
							<Button variant='default'>Perfil do usuário</Button>
						</Link>
					</div>
				</div>
			)}
		</main>
	)
}
