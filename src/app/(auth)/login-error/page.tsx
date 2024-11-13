"use client"

import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function ErrorPage() {
	const searchParams = useSearchParams()
	const error = searchParams.get("error")

	const errorMessages: Record<string, string> = {
		Configuration: "Erro de configuração. Entre em contato com o administrador.",
		AccessDenied: "Acesso negado. Você não tem permissão.",
		Verification: "Falha na verificação. Tente novamente.",
	}

	return (
		<div className='flex flex-col h-screen w-full items-center justify-center px-4'>
			<h1 className='text-6xl font-bold text-gray-800 mb-6'>Silo</h1>
			<Card className='mx-auto max-w-xs'>
				<CardHeader>
					<CardTitle className='text-2xl'>Erro</CardTitle>
					<CardDescription>
						<p>{errorMessages[error!] || "Ocorreu um erro desconhecido."}</p>
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button variant='outline' onClick={() => (window.location.href = "/auth/login")}>
						Voltar para Login
					</Button>
				</CardContent>
			</Card>
		</div>
	)
}
