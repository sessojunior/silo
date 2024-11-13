"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function NewUserPage() {
	return (
		<div className='flex flex-col h-screen w-full items-center justify-center px-4'>
			<h1 className='text-6xl font-bold text-gray-800 mb-6'>Silo</h1>
			<Card className='mx-auto max-w-xs'>
				<CardHeader>
					<CardTitle className='text-2xl'>Bem-vindo(a)!</CardTitle>
					<CardDescription>Complete seu cadastro para começar a usar a plataforma.</CardDescription>
				</CardHeader>
				<CardContent>
					<Button className='w-full' variant='outline' onClick={() => (window.location.href = "/admin/profile")}>
						Ir para o Perfil
					</Button>
				</CardContent>
			</Card>
		</div>
	)
}
