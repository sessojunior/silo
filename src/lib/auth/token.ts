import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { authSession, authUser } from '@/lib/db/schema'
import { and, eq, gt } from 'drizzle-orm'
import { generateHashToken } from '@/lib/auth/session'

// Recuperar usuário autenticado

export async function getAuthUser() {
	// Busca o token do cookie
	const cookieStore = await cookies()
	const token = cookieStore.get('session_token')?.value
	
	if (!token) return null

	// Gera o hash do token
	const hashToken = generateHashToken(token)

	// Busca a sessão válida com o token no banco de dados
	const session = await db.query.authSession.findFirst({
		where: and(eq(authSession.token, hashToken), gt(authSession.expiresAt, new Date())),
	})
	
	if (!session) return null

	// Busca o usuário relacionado
	const user = await db.query.authUser.findFirst({
		where: eq(authUser.id, session.userId),
	})

	if (!user || user.emailVerified !== true || !user.isActive) return null

	return user
}
