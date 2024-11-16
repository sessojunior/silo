"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ForgotPasswordForm() {
	const [email, setEmail] = useState("")
	const [message, setMessage] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [isSubmitting, setIsSubmitting] = useState(false)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setIsSubmitting(true)
		setError(null)
		setMessage(null)

		try {
			const response = await fetch("/api/auth/forgot-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email }),
			})

			if (response.ok) {
				setMessage("Um e-mail de recuperação foi enviado. Verifique sua caixa de entrada.")
				setEmail("")
			} else {
				const data = await response.json()
				setError(data.message || "Ocorreu um erro ao enviar o e-mail de recuperação.")
			}
		} catch (err) {
			setError("Erro ao conectar-se ao servidor. Tente novamente mais tarde.")
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<Card className='mx-auto max-w-xs'>
			<CardHeader>
				<CardTitle className='text-2xl'>Recuperar senha</CardTitle>
				<CardDescription>Digite o seu e-mail abaixo para receber instruções de recuperação de senha.</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit}>
					<div className='grid gap-4'>
						<div className='grid gap-2'>
							<Label htmlFor='email'>E-mail</Label>
							<Input id='email' type='email' value={email} onChange={(e) => setEmail(e.target.value)} placeholder='seu@email.com' autoComplete='email' required />
						</div>
						{error && <p className='text-red-500 text-sm'>{error}</p>}
						{message && <p className='text-green-500 text-sm'>{message}</p>}
						<Button type='submit' className='w-full' disabled={isSubmitting}>
							{isSubmitting ? "Enviando..." : "Enviar"}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	)
}
