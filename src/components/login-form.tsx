import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { SignInWithGoogleButton } from "./login-google-button"

export function LoginForm() {
	return (
		<Card className='mx-auto max-w-xs'>
			<CardHeader>
				<CardTitle className='text-2xl'>Login</CardTitle>
				<CardDescription>Digite seu e-mail abaixo para fazer login em sua conta.</CardDescription>
			</CardHeader>
			<CardContent>
				<div className='grid gap-4'>
					<div className='grid gap-2'>
						<Label htmlFor='email'>E-mail</Label>
						<Input id='email' type='email' placeholder='seu@email.com' required />
					</div>
					<div className='grid gap-2'>
						<div className='flex items-center'>
							<Label htmlFor='password'>Senha</Label>
							<Link href='/forgot-password' className='ml-auto inline-block text-sm underline'>
								Esqueceu sua senha?
							</Link>
						</div>
						<Input id='password' type='password' required />
					</div>
					<Button type='submit' className='w-full'>
						Login
					</Button>
					<Link href='/login-link-email' className='underline'>
						<Button variant='outline' className='w-full'>
							Link por e-mail
						</Button>
					</Link>
					<Link href='/login-otp-email' className='underline'>
						<Button variant='outline' className='w-full'>
							Token por e-mail
						</Button>
					</Link>
					<SignInWithGoogleButton />
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
