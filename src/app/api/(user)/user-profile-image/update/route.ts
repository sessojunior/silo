import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/token'
import { db } from '@/lib/db'
import { authUser } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// Atualiza a URL da imagem de perfil do usuário (vinda do servidor local)
export async function POST(req: NextRequest) {
	try {
		// Verifica se o usuário está logado e obtém os dados do usuário
		const user = await getAuthUser()
		if (!user) return NextResponse.json({ field: null, message: 'Usuário não logado.' }, { status: 400 })

		const { imageUrl } = await req.json()

		if (!imageUrl || typeof imageUrl !== 'string') {
			return NextResponse.json({ field: null, message: 'URL da imagem não fornecida.' }, { status: 400 })
		}

		// Atualiza a URL da imagem no banco de dados
		await db.update(authUser).set({ image: imageUrl }).where(eq(authUser.id, user.id))

		console.log('ℹ️ [API_USER_PROFILE_IMAGE_UPDATE] URL da imagem de perfil atualizada com sucesso:', { imageUrl })

		// Retorna a resposta com sucesso
		return NextResponse.json({ message: 'URL da imagem atualizada com sucesso!', imageUrl })
	} catch (error) {
		console.error('❌ [API_USER_PROFILE_IMAGE_UPDATE] Erro ao atualizar URL da imagem de perfil:', { error })
		return NextResponse.json({ message: 'Erro inesperado. Tente novamente.' }, { status: 500 })
	}
}
