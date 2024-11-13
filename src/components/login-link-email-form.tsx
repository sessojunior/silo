"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { signIn } from "next-auth/react"

interface Props {
	initialEmail?: string
	onEmailSubmitted: (email: string) => void
}

export default function LoginLinkEmailForm({ initialEmail = "", onEmailSubmitted }: Props) {
	const [email, setEmail] = useState(initialEmail)
	const [error, setError] = useState<string | null>(null)
	const [isSubmitting, setIsSubmitting] = useState(false)

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault()
		setError(null)
		setIsSubmitting(true)

		try {
			const response = await signIn("sendgrid-link", { email, redirect: false })
			console.log("response", response)

			if (response?.error) {
				throw new Error(response.error)
			}

			console.log("E-mail enviado com sucesso para:", email)
			onEmailSubmitted(email)
		} catch (err) {
			setError("Erro ao enviar o e-mail. Tente novamente.")
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<Card className='mx-auto max-w-xs'>
			<CardHeader>
				<CardTitle className='text-2xl'>Login</CardTitle>
				<CardDescription>Digite seu e-mail abaixo. Você receberá um link por e-mail para fazer login.</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className='grid gap-4'>
					<div className='grid gap-2'>
						<Label htmlFor='email'>E-mail</Label>
						<Input id='email' type='email' name='email' placeholder='seu@email.com' value={email} onChange={(e) => setEmail(e.target.value)} required />
						{error && <p className='text-red-600 text-sm'>{error}</p>}
					</div>
					<div className='grid gap-2'>
						<Button type='submit' disabled={isSubmitting} className='w-full'>
							{isSubmitting ? "Enviando..." : "Login"}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	)
}
