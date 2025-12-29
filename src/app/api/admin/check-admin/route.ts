import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/token'
import { isUserAdmin } from '@/lib/auth/admin'

// GET - Verificar se o usuário atual é administrador
export async function GET() {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ success: false, isAdmin: false, error: 'Usuário não autenticado' }, { status: 401 })
		}

		// Verificar se o usuário é administrador
		const isAdmin = await isUserAdmin(user.id)

		return NextResponse.json({
			success: true,
			isAdmin,
		})
	} catch (error) {
		console.error('❌ [API_CHECK_ADMIN] Erro ao verificar status de administrador:', { error })
		return NextResponse.json(
			{
				success: false,
				isAdmin: false,
				error: 'Erro interno do servidor',
			},
			{ status: 500 },
		)
	}
}
