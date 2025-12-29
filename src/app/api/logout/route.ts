import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { destroySessionCookie } from '@/lib/auth/session'

// Faz logout do usuário

export async function GET(req: NextRequest) {
	try {
		const cookieStore = await cookies()
		const token = cookieStore.get('session_token')?.value

		// Remove a sessão do banco de dados e do cookie
		if (token) {
			await destroySessionCookie(token)
		}

		// Redireciona para a página de login
		return NextResponse.redirect(new URL('/login', req.url))
	} catch (error) {
		console.error('❌ [API_LOGOUT] Erro ao fazer logout:', { error })
		return NextResponse.redirect(new URL('/login', req.url))
	}
}
