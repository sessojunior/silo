'use client'

import { useSearchParams } from 'next/navigation'
import Button from '@/components/ui/Button'

export default function ErrorPage() {
	const searchParams = useSearchParams()
	const error = searchParams.get('error')
	const status = searchParams.get('status') || '403'

	let title = 'Erro de Acesso'
	let description = 'Ocorreu um erro ao processar sua solicitação.'
	let icon = 'icon-[lucide--shield-x]'
	let buttonText = 'Voltar para a página inicial'
	let buttonHref = '/'

	switch (error) {
		case 'account_not_activated':
			title = 'Conta não ativada'
			description = 'Sua conta ainda não foi ativada por um administrador. Entre em contato com o suporte para solicitar a ativação.'
			icon = 'icon-[lucide--user-x]'
			buttonText = 'Voltar para o login'
			buttonHref = '/login'
			break
		case 'session_error':
			title = 'Erro ao criar sessão'
			description = 'Ocorreu um erro ao criar sua sessão. Tente fazer login novamente ou entre em contato com o suporte.'
			icon = 'icon-[lucide--key]'
			buttonText = 'Tentar novamente'
			buttonHref = '/login'
			break
		case 'unauthorized':
			title = 'Domínio não autorizado'
			description = 'Apenas contas Google com e-mail @inpe.br são permitidas para acesso. Entre em contato com o suporte para solicitar acesso.'
			icon = 'icon-[lucide--mail-x]'
			buttonText = 'Voltar para o login'
			buttonHref = '/login'
			break
		case 'invalid_params':
			title = 'Parâmetros inválidos'
			description = 'Os parâmetros de autenticação estão ausentes ou expirados. Reinicie o processo de login.'
			icon = 'icon-[lucide--alert-triangle]'
			buttonText = 'Tentar novamente'
			buttonHref = '/login'
			break
		case 'invalid_state':
			title = 'Estado de segurança inválido'
			description = 'O estado de segurança da autenticação é inválido. Reinicie o processo de login.'
			icon = 'icon-[lucide--shield-x]'
			buttonText = 'Tentar novamente'
			buttonHref = '/login'
			break
		case 'invalid_code':
			title = 'Código de autorização inválido'
			description = 'O código de autorização é inválido ou expirou. Reinicie o processo de login.'
			icon = 'icon-[lucide--key]'
			buttonText = 'Tentar novamente'
			buttonHref = '/login'
			break
		default:
			title = 'Erro inesperado'
			description = 'Ocorreu um erro inesperado. Tente novamente ou entre em contato com o suporte.'
			icon = 'icon-[lucide--alert-triangle]'
			buttonText = 'Voltar para a página inicial'
			buttonHref = '/'
	}

	return (
		<div className='flex min-h-screen flex-col items-center justify-center bg-white p-6 dark:bg-zinc-900 max-w-2xl mx-auto'>
			{/* Ícone animado */}
			<div className='relative'>
				<span className={`${icon} animate-pulse text-6xl text-red-600 dark:text-red-400`}></span>
			</div>

			{/* Título */}
			<h1 className='mt-4 text-center text-3xl font-extrabold tracking-tight text-zinc-800 dark:text-zinc-100'>{title}</h1>

			{/* Descrição */}
			<p className='mt-4 text-lg text-zinc-700 dark:text-zinc-300 text-center'>{description}</p>

			{/* Botão de ação */}
			<Button type='button' href={buttonHref} className='mt-4'>
				{buttonText}
			</Button>

			{/* Informações adicionais */}
			<div className='mt-4 text-center'>
				<p className='text-sm text-zinc-500 dark:text-zinc-500'>Código de erro: {status}</p>
				<p className='text-sm text-zinc-500 dark:text-zinc-500 mt-1'>Se o problema persistir, entre em contato com o suporte técnico.</p>
			</div>
		</div>
	)
}
