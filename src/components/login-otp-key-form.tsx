"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"

interface OtpProps {
	email: string
}

export default function LoginOtpKeyForm({ email }: OtpProps) {
	const [error, setError] = useState<string | null>(null)
	const [code, setCode] = useState("")
	const [isSubmitting, setIsSubmitting] = useState(false)
	const router = useRouter()

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault()
		setError(null)

		// Validação do código OTP
		if (!/^\d{4}$/.test(code)) {
			setError("O token precisa ter 4 dígitos numéricos.")
			return
		}

		setIsSubmitting(true)

		try {
			const otpRequestURL = `/api/auth/callback/nodemailer-otp?email=${encodeURIComponent(email.toLowerCase().trim())}&token=${encodeURIComponent(code)}&callbackUrl=${encodeURIComponent("/admin")}`

			const response = await fetch(otpRequestURL)

			if (response.ok && response.url.includes("/admin")) {
				router.push(response.url)
			} else {
				setError("Token inválido. Tente novamente.")
			}
		} catch (err) {
			console.error("Erro ao verificar o token:", err)
			setError("Ocorreu um erro. Por favor, tente novamente.")
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<Card className='mx-auto max-w-xs'>
			<CardHeader>
				<CardTitle className='text-2xl'>Login</CardTitle>
				<CardDescription>Digite abaixo o token de verificação que recebeu por e-mail.</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className='grid gap-4'>
					<div className='grid gap-2'>
						<InputOTP maxLength={4} value={code} onChange={(code) => setCode(code)}>
							<InputOTPGroup>
								<InputOTPSlot index={0} />
								<InputOTPSlot index={1} />
								<InputOTPSlot index={2} />
								<InputOTPSlot index={3} />
							</InputOTPGroup>
						</InputOTP>
						{error && <p className='text-red-600 text-sm'>{error}</p>}
					</div>
					<p className='text-sm'>O token expira em 5 minutos.</p>
					<Button type='submit' disabled={isSubmitting} className='w-full'>
						{isSubmitting ? "Verificando..." : "Verificar"}
					</Button>
				</form>
			</CardContent>
		</Card>
	)
}
