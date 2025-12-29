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

export default function ForgetPasswordPage() {
	const [loading, setLoading] = useState(false)
	const [step, setStep] = useState(1)
	const [form, setForm] = useState({ field: null, message: '' })

	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [code, setCode] = useState('')
	const [token, setToken] = useState('')

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

	// Etapa 1: Enviar e-mail
	const handleSendEmail = async (e: React.FormEvent) => {
		e.preventDefault()

		setLoading(true)
		setForm({ field: null, message: '' })

		try {
			const res = await fetch('/api/auth/forget-password', {
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
				toast({
					type: 'info',
					title: 'Agora só falta verificar seu e-mail.',
				})
				// Redireciona para a etapa 2
				setStep(2)
			}
		} catch (err) {
			console.error('❌ [PAGE_FORGET_PASSWORD] Erro inesperado:', { error: err })
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
				// Salva o token
				setToken(data.token)
				toast({
					type: 'success',
					title: 'Conta verificada com sucesso.',
				})
				// Redireciona para a etapa 3
				setStep(3)
			}
		} catch (err) {
			console.error('❌ [PAGE_FORGET_PASSWORD] Erro ao verificar o código:', { error: err })
			toast({
				type: 'error',
				title: 'Erro ao verificar o código.',
			})
			setForm({ field: null, message: 'Erro ao verificar o código.' })
		} finally {
			setLoading(false)
		}
	}

	// Etapa 3: Enviar a nova senha
	const handleSendPassword = async (e: React.FormEvent) => {
		e.preventDefault()
		setLoading(true)
		setForm({ field: null, message: '' })

		try {
			const res = await fetch('/api/auth/send-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token, password }),
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
					title: 'Senha alterada com sucesso.',
				})
				// Redireciona para a etapa 4
				setStep(4)
			}
		} catch (err) {
			console.error('❌ [PAGE_FORGET_PASSWORD] Erro ao alterar a senha:', { error: err })
			toast({
				type: 'error',
				title: 'Erro ao alterar a senha.',
			})
			setForm({ field: null, message: 'Erro ao alterar a senha.' })
		} finally {
			setLoading(false)
		}
	}

	return (
		<>
			{/* Header */}
			{step === 1 && <AuthHeader icon='icon-[lucide--key-round]' title='Esqueceu a senha' description='Não se preocupe, iremos te ajudar a recuperar sua senha.' />}
			{step === 2 && <AuthHeader icon='icon-[lucide--square-asterisk]' title='Verifique a conta' description='Para sua segurança, insira o código que recebeu por e-mail.' />}
			{step === 3 && <AuthHeader icon='icon-[lucide--lock]' title='Redefinir a senha' description='Agora você precisa digitar a nova senha para sua conta.' />}
			{step === 4 && <AuthHeader icon='icon-[lucide--lock-keyhole]' title='Senha alterada' description='A sua senha foi alterada com sucesso! Volte para continuar.' />}

			{/* Container */}
			<div className='mt-10 text-base text-zinc-600 dark:text-zinc-200'>
				{/* Etapa 1: Inserir e-mail para enviar o código OTP para o e-mail */}
				{step === 1 && (
					<>
						<form onSubmit={handleSendEmail}>
							<fieldset className='grid gap-5' disabled={loading}>
								<div>
									<Label htmlFor='email' isInvalid={form?.field === 'email'}>
										E-mail
									</Label>
									<Input type='email' id='email' name='email' value={email} setValue={setEmail} autoComplete='email' placeholder='seuemail@inpe.br' minLength={8} maxLength={255} required autoFocus isInvalid={form?.field === 'email'} invalidMessage={form?.message ?? ''} />
								</div>
								<div>
									<Button type='submit' disabled={loading} className='w-full'>
										{loading ? (
											<>
												<span className='icon-[lucide--loader-circle] animate-spin'></span> Enviando...
											</>
										) : (
											<>Enviar instruções</>
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

				{/* Etapa 2: Enviar código OTP para verificar se está correto */}
				{step === 2 && (
					<>
						<form onSubmit={handleVerifyCode}>
							<fieldset className='grid gap-5' disabled={loading}>
								<input type='hidden' name='email' value={email} />
								<div>
									<Label htmlFor='code' isInvalid={form?.field === 'code'}>
										Código recebdio por e-mail
									</Label>
									<Pin id='code' name='code' length={5} value={code} setValue={setCode} isInvalid={form?.field === 'code'} invalidMessage={form?.message ?? ''} />
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

				{/* Etapa 3: Enviar nova senha para alteração */}
				{step === 3 && (
					<>
						<form onSubmit={handleSendPassword}>
							<fieldset className='grid gap-5' disabled={loading}>
								<input type='hidden' name='email' value={email} />
								<div>
									<Label htmlFor='new-password' isInvalid={form?.field === 'password'}>
										Nova senha
									</Label>
									<InputPasswordHints ref={passwordRef} id='password' name='password' value={password} setValue={setPassword} autoComplete='current-password' placeholder='••••••••' minLength={8} maxLength={160} required isInvalid={form?.field === 'password'} invalidMessage={form?.message} />
								</div>
								<div>
									<Button type='submit' disabled={loading} className='w-full'>
										{loading ? (
											<>
												<span className='icon-[lucide--loader-circle] animate-spin'></span> Redefinindo...
											</>
										) : (
											<>Redefinir senha</>
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

				{/* Etapa 4: Senha alterada com sucesso */}
				{step === 4 && (
					<>
						<div className='grid gap-5'>
							<div>
								<Button href='/admin/welcome' type='button' className='w-full'>
									Ir para o painel
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
