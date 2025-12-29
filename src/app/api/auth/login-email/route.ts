import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { authUser } from '@/lib/db/schema'
import { generateCode, sendEmailCode } from '@/lib/auth/code'
import { isValidEmail, isValidDomain } from '@/lib/auth/validate'

// Faz login do usuário apenas com e-mail e código OTP
export async function POST(req: NextRequest) {
	try {
		const body = await req.json()
		const email = (body.email as string).trim().toLowerCase()

		if (!email) {
			return NextResponse.json({ field: null, message: 'O e-mail é obrigatório.' }, { status: 400 })
		}

		if (!isValidEmail(email)) {
			return NextResponse.json({ field: 'email', message: 'O e-mail é inválido.' }, { status: 400 })
		}

		if (!isValidDomain(email)) {
			return NextResponse.json({ field: 'email', message: 'Apenas e-mails do domínio @inpe.br são permitidos.' }, { status: 400 })
		}

		// Verifica se o usuário existe
		const user = await db.query.authUser.findFirst({ where: eq(authUser.email, email) })
		if (!user) {
			return NextResponse.json({ field: 'email', message: 'Não existe um usuário com este e-mail.' }, { status: 400 })
		}

		// Verifica se o usuário está ativo (ativado por administrador)
		if (!user.isActive) {
			return NextResponse.json({ field: 'email', message: 'Sua conta ainda não foi ativada por um administrador. Entre em contato com o suporte.' }, { status: 403 })
		}

		// Obtém um código OTP e salva-o no banco de dados
		const otp = await generateCode(email)
		if ('error' in otp) return NextResponse.json({ field: 'email', message: otp.error.message ?? 'Erro ao gerar o código de verificação para enviar por e-mail.' }, { status: 400 })

		// Código OTP
		const code = otp.code

		// Extrai IP do cabeçalho
		const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'

		// Envia o código OTP por e-mail
		const sendEmailOtp = await sendEmailCode({ email, type: 'sign-in', code, ip })
		if ('error' in sendEmailOtp) return NextResponse.json({ field: 'email', message: sendEmailOtp.error.message ?? 'Erro ao enviar o código de verificação por e-mail.' }, { status: 400 })

		// Retorna para a página o próximo passo
		return NextResponse.json({ step: 2, email })
	} catch (error) {
		console.error('❌ [API_AUTH_LOGIN_EMAIL] Erro ao fazer login com e-mail:', { error })
		return NextResponse.json({ field: null, message: 'Erro inesperado. Tente novamente.' }, { status: 500 })
	}
}
