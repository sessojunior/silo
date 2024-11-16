"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { SignInWithGoogleButton } from "./login-google-button"
import { MdKey } from "react-icons/md"
import { MdOutlineMailLock } from "react-icons/md"

import { useState } from "react"
import { signIn } from "next-auth/react"

export function LoginForm() {
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [error, setError] = useState<string | null>(null)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		console.log("Handle submit")

		const result = await signIn("credentials", {
			redirect: false,
			email,
			password,
			error,
		})
		console.log("result", result)

		if (result?.error === "Configuration") {
			setError("Ocorreu um problema com a configuração do sistema. Por favor, contate o suporte.")
		} else if (result?.error) {
			console.error("Erro no login:", result.error, result.code)
			setError("E-mail ou senha incorretos.")
		} else {
			// Redirecionar para a página de administração
			window.location.href = "/admin"
		}
	}

	return (
		<Card className='mx-auto max-w-xs'>
			<CardHeader>
				<CardTitle className='text-2xl'>Login</CardTitle>
				<CardDescription>Digite seu e-mail abaixo para fazer login em sua conta.</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit}>
					<div className='grid gap-4'>
						<div className='grid gap-2'>
							<Label htmlFor='email'>E-mail</Label>
							<Input id='email' type='email' value={email} onChange={(e) => setEmail(e.target.value)} placeholder='seu@email.com' autoComplete='email' required />
						</div>
						<div className='grid gap-2'>
							<div className='flex items-center'>
								<Label htmlFor='password'>Senha</Label>
								<Link href='/forgot-password' className='ml-auto inline-block text-sm underline'>
									Esqueceu sua senha?
								</Link>
							</div>
							<Input id='password' type='password' value={password} onChange={(e) => setPassword(e.target.value)} autoComplete='current-password' required />
						</div>
						<div>{error && <p className='text-red-500 text-sm'>{error}</p>}</div>
						<Button type='submit' className='w-full'>
							Login
						</Button>
						<Link href='/login-link-email' className='underline'>
							<Button variant='outline' className='w-full'>
								<MdOutlineMailLock /> Link por e-mail
							</Button>
						</Link>
						<Link href='/login-otp-email' className='underline'>
							<Button variant='outline' className='w-full'>
								<MdKey /> Receber token por e-mail
							</Button>
						</Link>
						<SignInWithGoogleButton />
					</div>
				</form>
				<div className='mt-4 text-center text-sm'>
					Não tem uma conta?{" "}
					<Link href='/register' className='underline'>
						Cadastre-se
					</Link>
				</div>
			</CardContent>
		</Card>
	)
}
