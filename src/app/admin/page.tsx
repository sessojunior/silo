import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { SignOutButton } from "@/components/logout-button"

export default async function AdminPage() {
	const session = await auth()
	if (!session) redirect("/login")

	return (
		<main className='flex flex-col items-center justify-center min-h-screen bg-gray-50'>
			<h1 className='text-6xl font-bold text-gray-800 mb-2'>Silo</h1>
			<h2 className='text-2xl font-bold text-gray-800 mb-6'>Sistema de Gerenciamento de Serviços</h2>
			<p className='text-gray-600 mb-4'>Esta é uma rota privada. Não pode ser acessada se não tiver feito o login.</p>

			<div className='space-x-4'>
				<pre>{JSON.stringify(session, null, 2)}</pre>
			</div>

			<div className='space-x-4'>
				<SignOutButton />
			</div>
		</main>
	)
}
