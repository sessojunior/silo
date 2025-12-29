import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { authUser } from '@/lib/db/schema'
import { hashPassword } from '@/lib/auth/hash'
import { validateSession } from '@/lib/auth/session'
import { isValidPassword } from '@/lib/auth/validate'

export async function POST(req: NextRequest) {
	try {
		const body = await req.json()
		const token = body.token as string
		const password = body.password as string

		if (!token || !password) {
			return NextResponse.json({ field: null, message: 'Todos os campos são obrigatórios.' }, { status: 400 })
		}

		if (!isValidPassword(password)) {
			return NextResponse.json({ field: 'password', message: 'A senha é inválida.' }, { status: 400 })
		}

		// Valida o token de sessão e obtém a sessão e o usuário
		const sessionUser = await validateSession(token)
		if ('error' in sessionUser) {
			// Token inválido
			return NextResponse.json({ step: 1 }, { status: 400 })
		}

		// Obtém o usuário
		const { user } = sessionUser

		// Criptografa a senha
		const hashedPassword = await hashPassword(password)

		// Altera a senha do usuário no banco de dados
		const updatePassword = await db.update(authUser).set({ password: hashedPassword }).where(eq(authUser.email, user.email))
		if ('error' in updatePassword) return NextResponse.json({ field: 'password', message: 'Ocorreu um erro ao alterar a senha.' }, { status: 400 })

		// Senha redefinida com sucesso
		// Retorna para a página o próximo passo
		return NextResponse.json({ step: 4 })
	} catch (err) {
		console.error('❌ [API_AUTH_SEND_PASSWORD] Erro ao enviar a senha:', { error: err })
		return NextResponse.json({ field: null, message: 'Erro inesperado. Tente novamente.' }, { status: 500 })
	}
}
