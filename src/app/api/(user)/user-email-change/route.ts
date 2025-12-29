import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { authUser, authCode } from '@/lib/db/schema'
import { getAuthUser } from '@/lib/auth/token'
import { isValidEmail, isValidDomain } from '@/lib/auth/validate'
import { generateEmailChangeCode, sendEmailCode } from '@/lib/auth/code'

// Solicita alteração de email - envia código OTP para o novo email
export async function POST(req: NextRequest) {
	try {
		// Verifica se o usuário está logado
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ field: null, message: 'Usuário não logado.' }, { status: 401 })
		}

		// Obtém os dados recebidos
		const body = await req.json()
		const newEmail = (body.email as string)?.trim().toLowerCase()

		if (!isValidEmail(newEmail)) {
			return NextResponse.json({ field: 'email', message: 'O e-mail é inválido.' }, { status: 400 })
		}

		if (!isValidDomain(newEmail)) {
			return NextResponse.json({ field: 'email', message: 'Apenas e-mails do domínio @inpe.br são permitidos.' }, { status: 400 })
		}

		// Verifica se o e-mail informado é o mesmo que o atual
		if (newEmail === user.email) {
			return NextResponse.json({ 
				field: 'email', 
				message: 'O e-mail informado é o mesmo que o atual. Escolha um e-mail diferente.' 
			}, { status: 400 })
		}

		// Verifica se já existe um usuário com este email
		const existingUser = await db.query.authUser.findFirst({ where: eq(authUser.email, newEmail) })
		if (existingUser) {
			return NextResponse.json({ 
				field: 'email', 
				message: 'Este e-mail já está sendo usado por outro usuário. Digite um e-mail diferente.' 
			}, { status: 400 })
		}

		// Gera código OTP para o novo email (não verifica se usuário existe)
		const codeResult = await generateEmailChangeCode(newEmail, user.id)
		if ('error' in codeResult) {
			return NextResponse.json({ field: 'email', message: codeResult.error.message }, { status: 400 })
		}

		// Envia código OTP para o novo email
		const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
		const emailResult = await sendEmailCode({
			email: newEmail,
			type: 'email-change',
			code: codeResult.code,
			ip,
		})

		if ('error' in emailResult) {
			return NextResponse.json({ field: 'email', message: emailResult.error.message }, { status: 400 })
		}

		// Retorna sucesso
		return NextResponse.json({ 
			success: true, 
			message: 'Código de verificação enviado para o novo e-mail.',
			requestId: codeResult.requestId
		})

	} catch (error) {
		console.error('❌ [API_USER_EMAIL_CHANGE] Erro ao solicitar alteração de e-mail:', { error })
		return NextResponse.json({ message: 'Erro inesperado. Tente novamente.' }, { status: 500 })
	}
}

// Confirma alteração de email com código OTP
export async function PUT(req: NextRequest) {
	try {
		// Verifica se o usuário está logado
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ field: null, message: 'Usuário não logado.' }, { status: 401 })
		}

		// Obtém os dados recebidos
		const body = await req.json()
		const { requestId, code, newEmail } = body

		if (!requestId || !code || !newEmail) {
			return NextResponse.json({ field: null, message: 'Dados incompletos.' }, { status: 400 })
		}

		// Verifica se o código OTP é válido
		const otpCode = await db.query.authCode.findFirst({
			where: eq(authCode.id, requestId),
		})

		if (!otpCode || otpCode.code !== code || otpCode.email !== newEmail || otpCode.userId !== user.id) {
			return NextResponse.json({ field: 'code', message: 'Código inválido ou expirado.' }, { status: 400 })
		}

		if (otpCode.expiresAt < new Date()) {
			return NextResponse.json({ field: 'code', message: 'Código expirado.' }, { status: 400 })
		}

		// Atualiza o email do usuário
		const [updateUser] = await db
			.update(authUser)
			.set({ 
				email: newEmail,
				emailVerified: true // Marca como verificado já que confirmou o código
			})
			.where(eq(authUser.id, user.id))
			.returning()

		if (!updateUser) {
			return NextResponse.json({ field: null, message: 'Erro ao alterar o e-mail.' }, { status: 500 })
		}

		// Remove o código usado
		await db.delete(authCode).where(eq(authCode.id, requestId))

		// Envia email de confirmação para o email antigo usando template moderno
		const { sendEmail } = await import('@/lib/sendEmail')
		await sendEmail({
			to: user.email,
			subject: 'E-mail alterado com sucesso',
			template: 'emailChanged',
			data: { oldEmail: user.email, newEmail },
			text: `Seu e-mail foi alterado de ${user.email} para ${newEmail}. Se você não fez esta alteração, entre em contato conosco imediatamente.`, // Fallback
		})

		// Envia email de confirmação para o novo email usando template moderno
		await sendEmail({
			to: newEmail,
			subject: 'E-mail alterado com sucesso',
			template: 'emailChanged',
			data: { oldEmail: user.email, newEmail },
			text: `Seu e-mail foi alterado com sucesso para ${newEmail}. Agora você pode usar este e-mail para fazer login no sistema.`, // Fallback
		})

		// Retorna sucesso
		return NextResponse.json({ 
			success: true, 
			message: 'E-mail alterado com sucesso!' 
		})

	} catch (error) {
		console.error('❌ [API_USER_EMAIL_CHANGE] Erro ao confirmar alteração de e-mail:', { error })
		return NextResponse.json({ message: 'Erro inesperado. Tente novamente.' }, { status: 500 })
	}
}
