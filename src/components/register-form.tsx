import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function RegisterForm() {
	return (
		<Card className='mx-auto max-w-xs'>
			<CardHeader>
				<CardTitle className='text-2xl'>Registre-se</CardTitle>
				<CardDescription>Digite seus dados abaixo para criar sua conta.</CardDescription>
			</CardHeader>
			<CardContent>
				<div className='grid gap-4'>
					<div className='grid gap-2'>
						<Label htmlFor='name'>Nome</Label>
						<Input id='name' type='text' placeholder='Seu nome' required />
					</div>
					<div className='grid gap-2'>
						<Label htmlFor='email'>E-mail</Label>
						<Input id='email' type='email' placeholder='seu@email.com' required />
					</div>
					<div className='grid gap-2'>
						<div className='flex items-center'>
							<Label htmlFor='password'>Senha</Label>
						</div>
						<Input id='password' type='password' required />
					</div>
					<Button type='submit' className='w-full'>
						Registrar
					</Button>
				</div>
				<div className='mt-4 text-center text-sm'>
					Possui uma conta?{" "}
					<Link href='/login' className='underline'>
						Faça login
					</Link>
				</div>
			</CardContent>
		</Card>
	)
}
