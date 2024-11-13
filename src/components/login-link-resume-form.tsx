"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface Props {
	email: string
	onRetry: () => void
}

export default function LoginLinkResumeForm({ email, onRetry }: Props) {
	return (
		<Card className='mx-auto max-w-xs'>
			<CardHeader>
				<CardTitle className='text-2xl'>Verifique seu e-mail</CardTitle>
				<CardDescription>
					<p className='pb-2'>
						Um link para fazer login foi enviado para <strong>{email}</strong>.
					</p>
					<p className='pb-2'>Verifique sua caixa de entrada (e também a pasta de spam) e clique no link para fazer login.</p>
					<p>Se não recebeu o e-mail em até 2 minutos, tente novamente.</p>
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className='text-center text-sm'>
					<Button variant='outline' onClick={onRetry}>
						Tentar novamente
					</Button>
				</div>
			</CardContent>
		</Card>
	)
}
