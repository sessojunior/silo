'use client'

import { useState, useRef, useEffect } from 'react'

import { toast } from '@/lib/toast'

import AuthHeader from '@/components/auth/AuthHeader'
import AuthLink from '@/components/auth/AuthLink'

import Label from '@/components/ui/Label'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import InputPasswordHints from '@/components/ui/InputPasswordHints'
import Pin from '@/components/ui/Pin'

export default function SetupPasswordPage() {
	const [loading, setLoading] = useState(false)
	const [step, setStep] = useState(1)
	const [form, setForm] = useState<{ field: string | null; message: string }>({ field: null, message: '' })

	const [email, setEmail] = useState('')
	const [code, setCode] = useState('')
	const [password, setPassword] = useState('')

	const emailRef = useRef<HTMLInputElement>(null)
	const passwordRef = useRef<HTMLInputElement>(null)

	// Foca no campo inválido quando houver erro
	useEffect(() => {
		if (!form.field) return

		switch (form.field) {
			case 'email':
				emailRef.current?.focus()
				break
			case 'password':
				passwordRef.current?.focus()
				break
		}
	}, [form])

	// Etapa 1: Verificar código OTP e definir senha
	const handleSetupPassword = async (e: React.FormEvent) => {
		e.preventDefault()
		setLoading(true)
		setForm({ field: null, message: '' })

		try {
			const res = await fetch('/api/auth/setup-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, code, password }),
			})

			const data = await res.json()

			if (!res.ok) {
				setForm({ field: data.field || null, message: data.message })
				toast({
					type: 'error',
					title: data.message,
				})
			} else {
				toast({
					type: 'success',
					title: 'Senha definida com sucesso!',
				})
				// Redireciona para a etapa 2 (sucesso)
				setStep(2)
			}
		} catch (err) {
			console.error('❌ [PAGE_SETUP_PASSWORD] Erro ao definir senha:', { error: err })
			toast({
				type: 'error',
				title: 'Erro inesperado. Tente novamente.',
			})
			setForm({ field: null, message: 'Erro inesperado. Tente novamente.' })
		} finally {
			setLoading(false)
		}
	}

	return (
		<>
			{/* Header */}
			{step === 1 && (
				<AuthHeader
					icon='icon-[lucide--lock-keyhole]'
					title='Definir senha'
					description='Informe seu e-mail, o código recebido e defina sua senha de acesso.'
				/>
			)}
			{step === 2 && (
				<AuthHeader
					icon='icon-[lucide--key]'
					title='Senha definida com sucesso!'
					description='Sua senha foi configurada. Agora você pode fazer login no sistema.'
				/>
			)}

			{/* Container */}
			<div className='mt-10 text-base text-zinc-600 dark:text-zinc-200'>
				{/* Etapa 1: Definir senha com código OTP */}
				{step === 1 && (
					<>
						<form onSubmit={handleSetupPassword}>
							<fieldset className='grid gap-5' disabled={loading}>
								<div>
									<Label htmlFor='email' isInvalid={form?.field === 'email'}>
										E-mail
									</Label>
									<Input
										ref={emailRef}
										type='email'
										id='email'
										name='email'
										value={email}
										setValue={setEmail}
										autoComplete='email'
										placeholder='seuemail@inpe.br'
										minLength={8}
										maxLength={255}
										required
										autoFocus
										isInvalid={form?.field === 'email'}
										invalidMessage={form?.message ?? ''}
									/>
								</div>

								<div>
									<Label htmlFor='code' isInvalid={form?.field === 'code'}>
										Código OTP recebido por e-mail
									</Label>
									<Pin
										id='code'
										name='code'
										length={5}
										value={code}
										setValue={setCode}
										isInvalid={form?.field === 'code'}
										invalidMessage={form?.message ?? ''}
									/>
								</div>

								<div>
									<Label htmlFor='password' isInvalid={form?.field === 'password'}>
										Nova senha
									</Label>
									<InputPasswordHints
										ref={passwordRef}
										id='password'
										name='password'
										value={password}
										setValue={setPassword}
										autoComplete='new-password'
										placeholder='••••••••'
										minLength={8}
										maxLength={160}
										required
										isInvalid={form?.field === 'password'}
										invalidMessage={form?.message}
									/>
								</div>

								<div>
									<Button type='submit' disabled={loading} className='w-full'>
										{loading ? (
											<>
												<span className='icon-[lucide--loader-circle] animate-spin'></span> Definindo senha...
											</>
										) : (
											<>Definir senha</>
										)}
									</Button>
								</div>

								<p className='text-center'>
									<AuthLink href='/login'>Voltar para login</AuthLink>
								</p>
							</fieldset>
						</form>
					</>
				)}

				{/* Etapa 2: Senha definida com sucesso */}
				{step === 2 && (
					<>
						<div className='grid gap-5'>
							<div>
								<Button href='/login' type='button' className='w-full'>
									Ir para login
								</Button>
							</div>
							<p className='text-center'>
								<AuthLink href='/login'>Voltar</AuthLink>
							</p>
						</div>
					</>
				)}
			</div>
		</>
	)
}

