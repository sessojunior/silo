"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function VerifyPage() {
	return (
		<div className='flex flex-col h-screen w-full items-center justify-center px-4'>
			<h1 className='text-6xl font-bold text-gray-800 mb-6'>Silo</h1>
			<Card className='mx-auto max-w-xs'>
				<CardHeader>
					<CardTitle className='text-2xl'>Verifique seu e-mail</CardTitle>
					<CardDescription>
						<p className='pb-2'>Um link para fazer login foi enviado para o seu e-mail.</p>
						<p>Verifique sua caixa de entrada (e também a pasta de spam) e clique no link.</p>
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className='text-center text-sm'>
						<a href='/auth/login' className='underline text-blue-600'>
							Voltar para Login
						</a>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
