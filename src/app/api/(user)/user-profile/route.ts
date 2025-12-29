import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { authUser, userProfile } from '@/lib/db/schema'
import { getAuthUser } from '@/lib/auth/token'
import { isValidName } from '@/lib/auth/validate'
import { randomUUID } from 'crypto'
import { getGoogleIdFromUserId } from '@/lib/auth/oauth'

// Obtém os dados do perfil do usuário logado
export async function GET() {
	try {
		// Verifica se o usuário está logado e obtém os dados do usuário
		const user = await getAuthUser()
		if (!user) return NextResponse.json({ field: null, message: 'Usuário não logado.' }, { status: 400 })

		// Busca os dados do perfil do usuário no banco de dados
		const findUserProfile = await db.query.userProfile.findFirst({ where: eq(userProfile.userId, user.id) })

		// Busca a imagem do usuário diretamente do banco de dados
		const userData = await db.select({ image: authUser.image }).from(authUser).where(eq(authUser.id, user.id)).limit(1)
		const image = userData[0]?.image || null

		// ID do usuário no Google
		const { googleId } = await getGoogleIdFromUserId(user.id)

		// Retorna os dados do perfil do usuário
		return NextResponse.json({ user: { ...user, image }, userProfile: findUserProfile ?? {}, googleId }, { status: 200 })
	} catch (error) {
		console.error('❌ [API_USER_PROFILE] Erro ao obter os dados do perfil do usuário:', { error })
		return NextResponse.json({ field: null, message: 'Erro inesperado. Tente novamente.' }, { status: 500 })
	}
}

// Altera os dados do perfil do usuário logado
export async function PUT(req: NextRequest) {
	try {
		// Verifica se o usuário está logado e obtém os dados do usuário
		const user = await getAuthUser()
		if (!user) return NextResponse.json({ field: null, message: 'Usuário não logado.' }, { status: 400 })

		// Obtem os dados recebidos
		const body = await req.json()
		const name = (body.name as string)?.trim()
		const phone = (body.phone as string)?.trim()
		const company = (body.company as string)?.trim()
		const genre = body.genre as string
		const role = body.role as string
		const location = body.location as string
		const team = body.team as string

		// Validação básica dos campos
		if (!name) {
			return NextResponse.json({ field: null, message: 'O nome é obrigatório.' }, { status: 400 })
		}

		if (!isValidName(name)) {
			return NextResponse.json({ field: 'name', message: 'O nome precisa ser completo e conter apenas letras.' }, { status: 400 })
		}

		// Atualiza o nome do usuário no banco de dados
		const [updateUser] = await db.update(authUser).set({ name }).where(eq(authUser.id, user.id)).returning()
		if (!updateUser) {
			return NextResponse.json({ field: null, message: 'Ocorreu um erro ao alterar o nome do usuário.' }, { status: 500 })
		}

		// Verifica se o perfil do usuário já existe no banco de dados pelo ID do usuário
		const findUserProfile = await db.query.userProfile.findFirst({ where: eq(userProfile.userId, user.id) })

		// Se o perfil do usuário ainda não existir, cadastra os dados de perfil do usuário
		if (!findUserProfile) {
			// Insere o perfil do usuário no banco de dados
			const [insertUserProfile] = await db.insert(userProfile).values({ id: randomUUID(), userId: user.id, genre, phone, role, team, company, location }).returning()
			if (!insertUserProfile) return NextResponse.json({ field: null, message: 'Ocorreu um erro ao salvar os dados de perfil do usuário no banco de dados.' }, { status: 500 })

			// Retorna a resposta com sucesso
			return NextResponse.json({ message: 'Dados atualizados com sucesso!' }, { status: 200 })
		}

		// Se o perfil do usuário existir, atualiza os dados de perfil do usuário
		const [updateUserProfile] = await db.update(userProfile).set({ phone, company, genre, role, location, team }).where(eq(userProfile.userId, user.id)).returning()
		if (!updateUserProfile) {
			return NextResponse.json({ field: null, message: 'Ocorreu um erro ao alterar os dados de perfil do usuário.' }, { status: 500 })
		}

		// Retorna a resposta com sucesso
		return NextResponse.json({ message: 'Dados atualizados com sucesso!' }, { status: 200 })
	} catch (error) {
		console.error('❌ [API_USER_PROFILE] Erro ao alterar dados do perfil do usuário:', { error })
		return NextResponse.json({ message: 'Erro inesperado. Tente novamente.' }, { status: 500 })
	}
}
