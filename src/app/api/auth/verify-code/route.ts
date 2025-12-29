import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { authUser } from '@/lib/db/schema'
import { createSessionCookie } from '@/lib/auth/session'
import { validateCode } from '@/lib/auth/code'
import { isValidCode, isValidEmail } from '@/lib/auth/validate'
import { updateUserLastLogin } from '@/lib/auth/user-groups'

// Verifica o código OTP enviado por e-mail
export async function POST(req: NextRequest) {
	try {
		const body = await req.json()
		const email = (body.email as string)?.trim().toLowerCase()
		const code = (body.code as string).trim()

		// Validação básica dos campos
		if (!email || !code) {
			return NextResponse.json({ field: null, message: 'E-mail e código são obrigatórios.' }, { status: 400 })
		}

		if (!isValidEmail(email)) {
			return NextResponse.json({ field: 'email', message: 'O e-mail é inválido.' }, { status: 400 })
		}

		if (!isValidCode(code)) {
			return NextResponse.json({ field: 'code', message: 'O código é inválido.' }, { status: 400 })
		}

		// Verifica se o usuário existe
		const user = await db.query.authUser.findFirst({ where: eq(authUser.email, email) })
		if (!user) {
			return NextResponse.json({ field: 'email', message: 'Não existe um usuário com este e-mail.' }, { status: 400 })
		}

		// Verifica se o código OTP enviado pelo usuário é válido e se não está expirado
		// Se o código for válido e não estiver expirado, define o e-mail do usuário como verificado (1) na tabela 'auth_user' do banco de dados
		const isValidateCode = await validateCode({ email, code })
		if ('error' in isValidateCode) {
			return NextResponse.json({ field: 'code', message: isValidateCode.error?.message ?? 'O código é inválido ou expirou.' }, { status: 400 })
		}

		// Atualiza o último acesso do usuário
		await updateUserLastLogin(user.id)

		// Remove todas as sessões antigas do usuário antes de criar uma nova
		// Isso garante que apenas uma sessão válida exista por vez
		// Nota: validateCode já remove todas as sessões por segurança após verificar email
		// Mas vamos garantir aqui também para casos onde validateCode não foi chamado
		const { destroyAllSession } = await import('@/lib/auth/session')
		await destroyAllSession(user.id)
		console.log('🗑️ [API_AUTH_VERIFY_CODE] Sessões antigas removidas antes de criar nova sessão:', { userId: user.id })

		// Cria a sessão e o cookie do usuário
		const sessionToken = await createSessionCookie(user.id)
		if ('error' in sessionToken) {
			return NextResponse.json({ field: 'code', message: 'Ocorreu um erro ao criar a sessão.' }, { status: 400 })
		}

		// O cookie já foi definido via cookies().set() no createSessionCookie
		// Apenas retornamos o response - Next.js incluirá o cookie automaticamente
		const response = NextResponse.json({ success: true, token: sessionToken.token }, { status: 200 })
		console.log('✅ [API_AUTH_VERIFY_CODE] Código verificado, sessão criada, cookie incluído:', { userId: user.id })
		return response
	} catch (error) {
		console.error('❌ [API_AUTH_VERIFY_CODE] Erro ao verificar o código:', { error })
		return NextResponse.json({ field: null, message: 'Erro inesperado. Tente novamente.' }, { status: 500 })
	}
}
