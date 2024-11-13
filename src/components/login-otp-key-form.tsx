"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface Props {
	email: string
}

// Esquema de validação para OTP
const otpSchema = z.object({
	code: z.string().length(4, "O código deve ter 4 dígitos").regex(/^\d+$/, "O código deve conter apenas números"),
})

type OTPFormData = z.infer<typeof otpSchema>

export default function LoginOtpKeyForm({ email }: Props) {
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<OTPFormData>({
		resolver: zodResolver(otpSchema),
	})

	const [error, setError] = useState<string | null>(null)
	const router = useRouter()

	async function onSubmit(data: OTPFormData) {
		setError(null)

		const otpRequestURL = `/api/auth/callback/nodemailer-otp?email=${encodeURIComponent(email.toLowerCase().trim())}&token=${encodeURIComponent(data.code)}&callbackUrl=${encodeURIComponent("/admin")}`

		const response = await fetch(otpRequestURL)

		if (response.ok && response.url.includes("/admin")) {
			router.push(response.url)
		} else {
			setError("Código de verificação inválido. Tente novamente.")
			console.log("response", response)
		}
	}

	return (
		<Card className='mx-auto max-w-xs'>
			<CardHeader>
				<CardTitle className='text-2xl'>Login</CardTitle>
				<CardDescription>Digite o código de verificação enviado para o e-mail.</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit(onSubmit)} className='grid gap-4'>
					<div className='grid gap-2'>
						<Label htmlFor='code'>Código OTP</Label>
						<Input id='code' type='text' placeholder='0000' {...register("code")} />
						{errors.code && <p className='text-red-600 text-sm'>{errors.code.message}</p>}
						{error && <p className='text-red-600 text-sm'>{error}</p>}
					</div>
					<p className='text-sm'>
						Lembre-se, o código expira em <strong>5 minutos</strong>.
					</p>
					<Button type='submit' disabled={isSubmitting} className='w-full'>
						{isSubmitting ? "Verificando..." : "Verificar"}
					</Button>
				</form>
			</CardContent>
		</Card>
	)
}
