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
import InputPassword from '@/components/ui/InputPassword'
import Pin from '@/components/ui/Pin'

export default function LoginPage() {
	const router = useRouter()

	const [loading, setLoading] = useState(false)
	const [step, setStep] = useState(1)
	const [form, setForm] = useState({ field: null as null | string, message: '' })

	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [code, setCode] = useState('')

	const emailRef = useRef<HTMLInputElement>(null)
	const passwordRef = useRef<HTMLInputElement>(null)
	const codeRef = useRef<HTMLInputElement>(null)

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
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password }),
			})

			// Verifica se a resposta é 405 (Method Not Allowed)
			if (res.status === 405) {
				console.error('❌ [PAGE_LOGIN] Método não permitido (405). Possível problema de configuração do servidor')
				toast({
					type: 'error',
					title: 'Erro de configuração do servidor. Entre em contato com o suporte.',
				})
				setForm({ field: null, message: 'Erro de configuração do servidor. Entre em contato com o suporte.' })
				return
			}

			// Verifica se há conteúdo antes de tentar fazer parse JSON
			const contentType = res.headers.get('content-type')
			let data: { field?: string | null; message?: string; step?: number; success?: boolean } = {}

			if (contentType && contentType.includes('application/json')) {
				const text = await res.text()
				if (text) {
					try {
						data = JSON.parse(text)
					} catch (parseError) {
						console.error('❌ [PAGE_LOGIN] Erro ao fazer parse do JSON:', { parseError, text })
						toast({
							type: 'error',
							title: 'Resposta inválida do servidor.',
						})
						setForm({ field: null, message: 'Resposta inválida do servidor.' })
						return
					}
				}
			}

			if (!res.ok) {
				const errorMessage = data.message || `Erro ${res.status}: ${res.statusText}`
				setForm({ field: data.field || null, message: errorMessage })
				toast({
					type: 'error',
					title: errorMessage,
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

				if (data.success) {
					// Redireciona para a página protegida
					router.push('/admin/welcome')
				}
			}
		} catch (err) {
			console.error('❌ [PAGE_LOGIN] Erro inesperado:', { error: err })
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

			// Verifica se a resposta é 405 (Method Not Allowed)
			if (res.status === 405) {
				console.error('❌ [PAGE_LOGIN] Método não permitido (405) - possível problema de configuração do servidor')
				toast({
					type: 'error',
					title: 'Erro de configuração do servidor. Entre em contato com o suporte.',
				})
				setForm({ field: null, message: 'Erro de configuração do servidor. Entre em contato com o suporte.' })
				return
			}

			// Verifica se há conteúdo antes de tentar fazer parse JSON
			const contentType = res.headers.get('content-type')
			let data: { field?: string | null; message?: string; success?: boolean } = {}

			if (contentType && contentType.includes('application/json')) {
				const text = await res.text()
				if (text) {
					try {
						data = JSON.parse(text)
					} catch (parseError) {
						console.error('❌ [PAGE_LOGIN] Erro ao fazer parse do JSON:', { parseError, text })
						toast({
							type: 'error',
							title: 'Resposta inválida do servidor.',
						})
						setForm({ field: null, message: 'Resposta inválida do servidor.' })
						return
					}
				}
			}

			if (!res.ok) {
				const errorMessage = data.message || `Erro ${res.status}: ${res.statusText}`
				setForm({ field: data.field || null, message: errorMessage })
				toast({
					type: 'error',
					title: errorMessage,
				})
			} else {
				toast({
					type: 'success',
					title: 'Conta verificada com sucesso.',
				})

				if (data.success) {
					// Redireciona para a página protegida
					router.push('/admin/welcome')
				}
			}
		} catch (err) {
			console.error('❌ [PAGE_LOGIN] Erro ao verificar o código:', { error: err })
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
			{step === 1 && <AuthHeader icon='icon-[lucide--log-in]' title='Entrar' description='Entre para começar a usar.' />}
			{step === 2 && <AuthHeader icon='icon-[lucide--square-asterisk]' title='Verifique a conta' description='Precisamos verificar seu e-mail, insira o código que recebeu por e-mail.' />}

			{/* Container */}
			<div className='mt-10 text-base text-zinc-600 dark:text-zinc-200'>
				{/* Etapa 1: Inserir o e-mail e a senha para fazer login */}
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
									<Label htmlFor='password' isInvalid={form?.field === 'password'}>
										Senha
									</Label>
									<InputPassword ref={passwordRef} id='password' name='password' value={password} setValue={setPassword} autoComplete='current-password' placeholder='••••••••' minLength={6} maxLength={160} required isInvalid={form?.field === 'password'} invalidMessage={form?.message} />
								</div>
								<p className='text-end'>
									<AuthLink href='/forget-password'>Redefinir ou esqueceu a senha?</AuthLink>
								</p>
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
									<Button href='/login-email' type='button' style='bordered' icon='icon-[lucide--log-in]' className='w-full'>
										Entrar só com e-mail
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

				{/* Etapa 2: Se o e-mail do usuário não estiver verificado, envia o código OTP para verificar o e-mail */}
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
									<AuthLink href='/login'>Voltar</AuthLink>
								</p>
							</fieldset>
						</form>
					</>
				)}
			</div>
		</>
	)
}
