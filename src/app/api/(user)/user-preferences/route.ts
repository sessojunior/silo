import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { userPreferences } from '@/lib/db/schema'
import { getAuthUser } from '@/lib/auth/token'
import { randomUUID } from 'crypto'

// Obtém os dados de preferências do usuário logado
export async function GET() {
	try {
		// Verifica se o usuário está logado e obtém os dados do usuário
		const user = await getAuthUser()
		if (!user) return NextResponse.json({ field: null, message: 'Usuário não logado.' }, { status: 400 })

		// Busca as preferências do usuário no banco de dados
		const findUserPreferences = await db.query.userPreferences.findFirst({
			where: eq(userPreferences.userId, user.id),
		})

		// Retorna as preferências do usuário
		return NextResponse.json({ userPreferences: findUserPreferences ?? {} }, { status: 200 })
	} catch (error) {
		console.error('❌ [API_USER_PREFERENCES] Erro ao obter as preferências do usuário:', { error })
		return NextResponse.json({ field: null, message: 'Erro inesperado. Tente novamente.' }, { status: 500 })
	}
}

// Altera as preferências do usuário logado
export async function PUT(req: NextRequest) {
	try {
		// Verifica se o usuário está logado e obtém os dados do usuário
		const user = await getAuthUser()
		if (!user) return NextResponse.json({ field: null, message: 'Usuário não logado.' }, { status: 400 })

		// Obtem os dados recebidos
		const body = await req.json()
		const chatEnabled = body.chatEnabled

		// Verifica se as preferências do usuário já existem no banco de dados pelo ID do usuário
		const findUserPreferences = await db.query.userPreferences.findFirst({
			where: eq(userPreferences.userId, user.id),
		})

		// Se as preferências do usuário ainda não existirem, cadastra as preferências do usuário
		if (!findUserPreferences) {
			// Insere as preferências do usuário no banco de dados
			const [insertUserPreferences] = await db
				.insert(userPreferences)
				.values({
					id: randomUUID(),
					userId: user.id,
					chatEnabled,
				})
				.returning()
			if (!insertUserPreferences)
				return NextResponse.json(
					{
						field: null,
						message: 'Ocorreu um erro ao salvar as preferências do usuário no banco de dados.',
					},
					{ status: 500 },
				)

			// Retorna a resposta com sucesso
			return NextResponse.json({ message: 'Preferências atualizadas com sucesso!' }, { status: 200 })
		}

		// Se as preferências do usuário já existirem, atualiza os dados
		const [updateUserPreferences] = await db.update(userPreferences).set({ chatEnabled }).where(eq(userPreferences.userId, user.id)).returning()
		if (!updateUserPreferences) {
			return NextResponse.json(
				{
					field: null,
					message: 'Ocorreu um erro ao alterar as preferências do usuário.',
				},
				{ status: 500 },
			)
		}

		// Retorna a resposta com sucesso
		return NextResponse.json({ message: 'Preferências atualizadas com sucesso!' }, { status: 200 })
	} catch (error) {
		console.error('❌ [API_USER_PREFERENCES] Erro ao alterar as preferências do usuário:', { error })
		return NextResponse.json({ message: 'Erro inesperado. Tente novamente.' }, { status: 500 })
	}
}
