"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function ResetPasswordForm() {
	const searchParams = useSearchParams()
	const token = searchParams.get("token")

	const [password, setPassword] = useState("")
	const [confirmPassword, setConfirmPassword] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [message, setMessage] = useState<string | null>(null)
	const [isSubmitting, setIsSubmitting] = useState(false)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		if (password !== confirmPassword) {
			setError("As senhas não correspondem.")
			return
		}

		setIsSubmitting(true)
		setError(null)

		try {
			const response = await fetch("/api/auth/reset-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token, password }),
			})

			const data = await response.json()

			if (response.ok) {
				setMessage("Senha alterada com sucesso.")
			} else {
				setError(data.message || "Erro ao redefinir a senha.")
			}
		} catch (err) {
			setError("Erro ao conectar-se ao servidor.")
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<Card className='mx-auto max-w-xs'>
			<CardHeader>
				<CardTitle className='text-2xl'>Redefinir senha</CardTitle>
				<CardDescription>Digite e repita a senha para redefinir a senha.</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit}>
					<div className='grid gap-4'>
						<div className='grid gap-2'>
							<Label htmlFor='password'>Nova senha</Label>
							<Input id='password' type='password' value={password} onChange={(e) => setPassword(e.target.value)} placeholder='Digite sua nova senha' required />
						</div>
						<div className='grid gap-2'>
							<Label htmlFor='confirm-password'>Confirme a nova senha</Label>
							<Input id='confirm-password' type='password' value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder='Confirme sua nova senha' required />
						</div>
						{error && <p className='text-red-500 text-sm mb-2'>{error}</p>}
						{message && <p className='text-green-500 text-sm mb-2'>{message}</p>}
						<Button type='submit' className='w-full' disabled={isSubmitting}>
							{isSubmitting ? "Salvando..." : "Redefinir Senha"}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	)
}
