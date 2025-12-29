import { NextRequest, NextResponse } from 'next/server'
import { eq, and, gt, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { authUser, authCode } from '@/lib/db/schema'
import { hashPassword } from '@/lib/auth/hash'
import { isValidPassword, isValidEmail, isValidCode } from '@/lib/auth/validate'

// Define a senha inicial do usuário usando código OTP
export async function POST(req: NextRequest) {
	try {
		const body = await req.json()
		const email = (body.email as string)?.trim().toLowerCase()
		const code = (body.code as string)?.trim().toUpperCase() // Normalizar para maiúsculas
		const password = body.password as string

		// Validação básica dos campos
		if (!email || !code || !password) {
			return NextResponse.json(
				{ field: null, message: 'E-mail, código e senha são obrigatórios.' },
				{ status: 400 },
			)
		}

		if (!isValidEmail(email)) {
			return NextResponse.json({ field: 'email', message: 'O e-mail é inválido.' }, { status: 400 })
		}

		if (!isValidCode(code)) {
			return NextResponse.json({ field: 'code', message: 'O código é inválido.' }, { status: 400 })
		}

		if (!isValidPassword(password)) {
			return NextResponse.json({ field: 'password', message: 'A senha é inválida.' }, { status: 400 })
		}

		// Verifica se o usuário existe
		const user = await db.query.authUser.findFirst({ where: eq(authUser.email, email) })
		if (!user) {
			return NextResponse.json(
				{ field: 'email', message: 'Não existe um usuário com este e-mail.' },
				{ status: 400 },
			)
		}

		// Verifica se o código OTP é válido e não expirou
		// Primeiro busca todos os códigos do usuário para debug
		const allCodes = await db.query.authCode.findMany({
			where: and(eq(authCode.email, email), eq(authCode.userId, user.id)),
		})
		
		console.log('🔍 [API_AUTH_SETUP_PASSWORD] Códigos encontrados para o usuário:', {
			email,
			userId: user.id,
			codes: allCodes.map((c) => ({
				id: c.id,
				code: c.code,
				expiresAt: c.expiresAt,
				isExpired: c.expiresAt < new Date(),
			})),
			codeProcurado: code,
		})

		const otpCode = await db.query.authCode.findFirst({
			where: and(
				eq(authCode.email, email),
				eq(authCode.code, code.trim().toUpperCase()), // Garantir maiúsculas e sem espaços
				eq(authCode.userId, user.id), // Garantir que o código pertence ao usuário
				gt(authCode.expiresAt, new Date()),
			),
		})

		if (!otpCode) {
			// Limpa códigos expirados deste usuário (menores que a data atual = expirados)
			await db.delete(authCode).where(and(eq(authCode.email, email), lt(authCode.expiresAt, new Date())))

			// Verifica se existe algum código com esse valor mas expirado
			const expiredCode = await db.query.authCode.findFirst({
				where: and(
					eq(authCode.email, email),
					eq(authCode.code, code.trim().toUpperCase()),
					eq(authCode.userId, user.id),
					lt(authCode.expiresAt, new Date()),
				),
			})

			if (expiredCode) {
				console.log('⚠️ [API_AUTH_SETUP_PASSWORD] Código encontrado mas expirado:', {
					code: expiredCode.code,
					expiresAt: expiredCode.expiresAt,
					now: new Date(),
				})
				return NextResponse.json(
					{ field: 'code', message: 'O código expirou. Solicite um novo código.' },
					{ status: 400 },
				)
			}

			return NextResponse.json(
				{ field: 'code', message: 'O código é inválido ou expirou.' },
				{ status: 400 },
			)
		}

		// Remove o código usado (segurança)
		await db.delete(authCode).where(eq(authCode.id, otpCode.id))

		// Criptografa a nova senha
		const hashedPassword = await hashPassword(password)

		// 🆕 Atualiza a senha do usuário e marca email como verificado
		// O usuário provou ter acesso ao email ao usar o código OTP
		await db.update(authUser).set({ password: hashedPassword, emailVerified: true }).where(eq(authUser.id, user.id))

		console.log('✅ [API_AUTH_SETUP_PASSWORD] Senha definida com sucesso para:', email)

		// Retorna sucesso
		return NextResponse.json({
			success: true,
			message: 'Senha definida com sucesso. Você já pode fazer login.',
		})
	} catch (error) {
		console.error('❌ [API_AUTH_SETUP_PASSWORD] Erro ao definir senha:', { error })
		return NextResponse.json(
			{ field: null, message: 'Erro inesperado. Tente novamente.' },
			{ status: 500 },
		)
	}
}

