import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { authUser } from '@/lib/db/schema'
import { getAuthUser } from '@/lib/auth/token'
import { hashPassword } from '@/lib/auth/hash'
import { isValidPassword } from '@/lib/auth/validate'
import { sendEmail } from '@/lib/sendEmail'

// Altera os dados do perfil do usuário logado
export async function PUT(req: NextRequest) {
	try {
		// Verifica se o usuário está logado e obtém os dados do usuário
		const user = await getAuthUser()
		if (!user) return NextResponse.json({ field: null, message: 'Usuário não logado.' }, { status: 400 })

		// Obtem os dados recebidos
		const body = await req.json()
		const password = body.password as string

		if (!isValidPassword(password)) {
			return NextResponse.json({ field: 'email', message: 'A senha é inválida.' }, { status: 400 })
		}

		// Criptografa a senha
		const hashedPassword = await hashPassword(password)

		// Altera a senha do usuário no banco de dados
		const updatePassword = await db.update(authUser).set({ password: hashedPassword }).where(eq(authUser.email, user.email))
		if ('error' in updatePassword) return NextResponse.json({ field: 'password', message: 'Ocorreu um erro ao alterar a senha.' }, { status: 400 })

		// Envia um e-mail avisando que a senha foi alterada
		// Usando template moderno com fallback para texto simples
		await sendEmail({
			to: user.email,
			subject: `Senha alterada`,
			template: 'passwordChanged',
			data: { email: user.email },
			text: `Sua senha no Silo foi alterada com sucesso.`, // Fallback
		})

		// Retorna a resposta com sucesso
		return NextResponse.json({ message: 'Senha alterada com sucesso!' })
	} catch (error) {
		console.error('❌ [API_USER_PASSWORD] Erro ao alterar a senha do usuário:', { error })
		return NextResponse.json({ message: 'Erro inesperado. Tente novamente.' }, { status: 500 })
	}
}
