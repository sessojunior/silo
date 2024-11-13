"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { signIn } from "next-auth/react"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface Props {
	onEmailSubmitted: (email: string) => void
}

// Esquema de validação com Zod
const emailSchema = z.object({
	email: z.string().email("Por favor, insira um e-mail válido"),
})

type EmailFormData = z.infer<typeof emailSchema>

export default function LoginOtpEmailForm({ onEmailSubmitted }: Props) {
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<EmailFormData>({
		resolver: zodResolver(emailSchema),
	})

	const [error, setError] = useState<string | null>(null)
	const router = useRouter()

	async function onSubmit(data: EmailFormData) {
		setError(null)

		const response = await signIn("nodemailer-otp", { email: data.email, redirect: false })
		if (response?.error) {
			setError("Erro ao enviar o e-mail. Tente novamente.")
		} else {
			onEmailSubmitted(data.email) // Passa para o próximo estágio
		}
	}

	return (
		<Card className='mx-auto max-w-xs'>
			<CardHeader>
				<CardTitle className='text-2xl'>Login</CardTitle>
				<CardDescription>Digite seu e-mail abaixo. Você receberá uma chave por e-mail para fazer login.</CardDescription>
			</CardHeader>
			<CardContent>
				<div className='grid gap-4'>
					<form onSubmit={handleSubmit(onSubmit)} className='grid gap-4'>
						<div className='grid gap-2'>
							<Label htmlFor='email'>E-mail</Label>
							<Input id='email' type='email' placeholder='seu@email.com' {...register("email")} />
						</div>
						{errors.email && <p className='text-red-600 text-sm'>{errors.email.message}</p>}
						{error && <p className='text-red-600 text-sm'>{error}</p>}
						<div className='grid gap-2'>
							<Button type='submit' disabled={isSubmitting} className='w-full'>
								{isSubmitting ? "Enviando..." : "Login"}
							</Button>
						</div>
					</form>
				</div>
				<div className='mt-4 text-center text-sm'>
					Não tem uma conta?{" "}
					<Link href='/register' className='underline'>
						Registre-se
					</Link>
				</div>
			</CardContent>
		</Card>
	)
}
