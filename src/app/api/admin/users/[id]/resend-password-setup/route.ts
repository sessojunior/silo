import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authUser } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAuthUser } from '@/lib/auth/token'
import { requireAdmin } from '@/lib/auth/admin'
import { generatePasswordSetupCode, sendEmailCode } from '@/lib/auth/code'

// Reenvia o email de setup de senha para um usuário que ainda não definiu senha
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ field: null, message: 'Usuário não autenticado.' }, { status: 401 })
		}

		// Verificar se o usuário é administrador
		const adminCheck = await requireAdmin(user.id)
		if (!adminCheck.success) {
			return NextResponse.json({ field: null, message: adminCheck.error }, { status: 403 })
		}

		const { id } = await params

		if (!id) {
			return NextResponse.json(
				{
					success: false,
					field: 'id',
					message: 'ID do usuário é obrigatório.',
				},
				{ status: 400 },
			)
		}

		// Buscar usuário
		const targetUser = await db.query.authUser.findFirst({
			where: eq(authUser.id, id),
		})

		if (!targetUser) {
			return NextResponse.json(
				{
					success: false,
					field: 'id',
					message: 'Usuário não encontrado.',
				},
				{ status: 404 },
			)
		}

		// Verificar se o usuário já tem senha definida
		if (targetUser.password) {
			return NextResponse.json(
				{
					success: false,
					field: null,
					message: 'Este usuário já possui senha definida. Não é necessário reenviar o código de setup.',
				},
				{ status: 400 },
			)
		}

		// Gerar novo código OTP
		const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
		const otpResult = await generatePasswordSetupCode(targetUser.email, targetUser.id)

		if ('error' in otpResult) {
			console.error('❌ [API_RESEND_PASSWORD] Erro ao gerar código OTP:', otpResult.error)
			return NextResponse.json(
				{
					success: false,
					field: null,
					message: 'Erro ao gerar código OTP. Tente novamente.',
				},
				{ status: 500 },
			)
		}

		// Enviar código por email
		const emailResult = await sendEmailCode({
			email: targetUser.email,
			type: 'setup-password',
			code: otpResult.code,
			ip,
		})

		if ('error' in emailResult) {
			console.error('❌ [API_RESEND_PASSWORD] Erro ao enviar código por email:', emailResult.error)
			return NextResponse.json(
				{
					success: false,
					field: null,
					message: 'Erro ao enviar email. Tente novamente.',
				},
				{ status: 500 },
			)
		}

		console.log('✅ [API_RESEND_PASSWORD] Código OTP de setup de senha reenviado para:', targetUser.email)

		return NextResponse.json({
			success: true,
			message: 'Código OTP para definição de senha foi reenviado por email com sucesso.',
		})
	} catch (error) {
		console.error('❌ [API_RESEND_PASSWORD] Erro ao reenviar código:', { error })
		return NextResponse.json(
			{
				success: false,
				error: 'Erro interno do servidor',
			},
			{ status: 500 },
		)
	}
}

