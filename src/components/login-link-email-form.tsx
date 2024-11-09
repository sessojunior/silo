import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { signIn } from "@/auth"

export function LoginLinkEmailForm() {
	return (
		<Card className='mx-auto max-w-xs'>
			<CardHeader>
				<CardTitle className='text-2xl'>Login</CardTitle>
				<CardDescription>Digite seu e-mail abaixo. Você receberá um link por e-mail para fazer login.</CardDescription>
			</CardHeader>
			<CardContent>
				<div className='grid gap-4'>
					<form
						action={async (formData) => {
							"use server"
							await signIn("sendgrid-link", formData)
						}}
						className='grid gap-4'
					>
						<div className='grid gap-2'>
							<Label htmlFor='email'>E-mail</Label>
							<Input id='email' type='email' name='email' placeholder='seu@email.com' required />
						</div>
						<div className='grid gap-2'>
							<Button type='submit' className='w-full'>
								Login
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
