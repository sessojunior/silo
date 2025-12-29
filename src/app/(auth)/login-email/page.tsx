'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { toast } from '@/lib/toast'

import AuthHeader from '@/components/auth/AuthHeader'
import AuthDivider from '@/components/auth/AuthDivider'
import AuthLink from '@/components/auth/AuthLink'

import Label from '@/components/ui/Label'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Pin from '@/components/ui/Pin'

export default function LoginEmailPage() {
	const router = useRouter()

	const [loading, setLoading] = useState(false)
	const [step, setStep] = useState(1)
	const [form, setForm] = useState({ field: null as null | string, message: '' })

	const [email, setEmail] = useState('')
	const [code, setCode] = useState('')

	const emailRef = useRef<HTMLInputElement>(null)
	const codeRef = useRef<HTMLInputElement>(null)

	// Foca no campo inválido quando houver erro
	useEffect(() => {
		if (!form.field) return

		switch (form.field) {
			case 'email':
				emailRef.current?.focus()
				break
			case 'code':
				codeRef.current?.focus()
				break
		}
	}, [form])

	// Etapa 1: Fazer login
	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault()

		setLoading(true)
		setForm({ field: null, message: '' })

		try {
			const res = await fetch('/api/auth/login-email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email }),
			})

			const data = await res.json()

			if (!res.ok) {
				setForm({ field: data.field, message: data.message })
				toast({
					type: 'error',
					title: data.message,
				})
			} else {
				if (data.step && data.step === 2) {
					toast({
						type: 'info',
						title: 'Agora só falta verificar seu e-mail.',
					})
					// Redireciona para a etapa 2
					setStep(2)
					return
				}

				// Redireciona para a página protegida
				router.push('/admin/welcome')
			}
		} catch (err) {
			console.error('❌ [PAGE_LOGIN_EMAIL] Erro inesperado:', { error: err })
			toast({
				type: 'error',
				title: 'Erro inesperado. Tente novamente.',
			})
			setForm({ field: null, message: 'Erro inesperado. Tente novamente.' })
		} finally {
			setLoading(false)
		}
	}

	// Etapa 2: Enviar código de verificação
	const handleVerifyCode = async (e: React.FormEvent) => {
		e.preventDefault()
		setLoading(true)
		setForm({ field: null, message: '' })

		try {
			const res = await fetch('/api/auth/verify-code', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, code }),
			})

			const data = await res.json()

			if (!res.ok) {
				setForm({ field: data.field, message: data.message })
				toast({
					type: 'error',
					title: data.message,
				})
			} else {
				toast({
					type: 'success',
					title: 'Conta verificada com sucesso.',
				})
				// Redireciona para a página protegida
				router.push('/admin/welcome')
			}
		} catch (err) {
			console.error('❌ [PAGE_LOGIN_EMAIL] Erro ao verificar o código:', { error: err })
			toast({
				type: 'error',
				title: 'Erro ao verificar o código.',
			})
			setForm({ field: null, message: 'Erro ao verificar o código.' })
		} finally {
			setLoading(false)
		}
	}

	return (
		<>
			{/* Header */}
			{step === 1 && <AuthHeader icon='icon-[lucide--log-in]' title='Entrar' description='Entre para commençar a usar.' />}
			{step === 2 && <AuthHeader icon='icon-[lucide--square-asterisk]' title='Verifique a conta' description='Precisamos verificar seu e-mail, insira o código que recebeu por e-mail.' />}

			{/* Container */}
			<div className='mt-10 text-base text-zinc-600 dark:text-zinc-200'>
				{/* Etapa 1: Inserir o e-mail para fazer login */}
				{step === 1 && (
					<>
						<form onSubmit={handleLogin}>
							<fieldset className='grid gap-5' disabled={loading}>
								<div>
									<Label htmlFor='email' isInvalid={form?.field === 'email'}>
										E-mail
									</Label>
									<Input ref={emailRef} type='email' id='email' name='email' value={email} setValue={setEmail} autoComplete='email' placeholder='seuemail@inpe.br' minLength={8} maxLength={255} required autoFocus isInvalid={form?.field === 'email'} invalidMessage={form?.message} />
								</div>
								<div>
									<Button type='submit' disabled={loading} className='w-full'>
										{loading ? (
											<>
												<span className='icon-[lucide--loader-circle] animate-spin'></span> Entrando...
											</>
										) : (
											<>Entrar</>
										)}
									</Button>
								</div>
								<AuthDivider>ou</AuthDivider>
								<div className='flex w-full flex-col items-center justify-center gap-3'>
									<Button href='/login' type='button' style='bordered' icon='icon-[lucide--log-in]' className='w-full'>
										Entrar com e-mail e senha
									</Button>
									<Button
										type='button'
										style='bordered'
										icon='icon-[logos--google-icon]'
										className='w-full'
										onClick={() => {
											window.location.href = '/login-google'
										}}
									>
										Entrar com Google
									</Button>
								</div>
								<p className='text-center'>
									Não tem conta? <AuthLink href='/register'>Cadastre-se</AuthLink>.
								</p>
							</fieldset>
						</form>
					</>
				)}

				{/* Etapa 2: Enviar o código OTP para fazer login */}
				{step === 2 && (
					<>
						<form onSubmit={handleVerifyCode}>
							<fieldset className='grid gap-5' disabled={loading}>
								<input type='hidden' name='email' value={email} />
								<div>
									<Label htmlFor='code' isInvalid={form?.field === 'code'}>
										Código que recebeu por e-mail
									</Label>
									<Pin id='code' name='code' length={5} value={code} setValue={setCode} isInvalid={form?.field === 'code'} invalidMessage={form?.message} />
								</div>
								<div>
									<Button type='submit' disabled={loading} className='w-full'>
										{loading ? (
											<>
												<span className='icon-[lucide--loader-circle] animate-spin'></span> Enviando...
											</>
										) : (
											<>Enviar código</>
										)}
									</Button>
								</div>
								<p className='text-center'>
									<AuthLink onClick={() => setStep(1)}>Voltar</AuthLink>
								</p>
							</fieldset>
						</form>
					</>
				)}
			</div>
		</>
	)
}
