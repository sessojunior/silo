import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { OAuth2Tokens, decodeIdToken } from 'arctic'
import { createUserFromGoogleId, getUserFromGoogleId, google } from '@/lib/auth/oauth'
import { createSessionCookie } from '@/lib/auth/session'
import { isValidDomain } from '@/lib/auth/validate'
import { db } from '@/lib/db'
import { authUser } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { updateUserLastLogin } from '@/lib/auth/user-groups'
import { requestUtils } from '@/lib/config'

// Valida o retorno de chamada do Google pelo código de autorização
// - Verifica se o estado na URL corresponde ao estado armazenado
// - 2Valida o código de autorização e o código verificador armazenado
// - Se passou no escopo de autorização, decodifica o ID token e extrai os dados do usuário
// - Verifica se o usuário já existe, caso contrário, cria um novo usuário com os dados do Google
// - Por fim, cria uma nova sessão para o usuário e armazena o token de sessão no cookie
export async function GET(req: NextRequest) {
	// 1. Recupera os cookies de segurança salvos no início do fluxo OAuth
	const cookieStore = await cookies()
	const stateCookie = cookieStore.get('google_oauth_state')?.value
	const verifierCookie = cookieStore.get('google_code_verifier')?.value

	// 2. Recupera parâmetros de retorno da URL enviados pelo Google
	const code = req.nextUrl.searchParams.get('code')
	const state = req.nextUrl.searchParams.get('state')

	// 3. Verifica se os parâmetros foram enviados
	if (!state || !code || !stateCookie || !verifierCookie) {
		const baseUrl = requestUtils.getHostFromRequest(req)
		return NextResponse.redirect(new URL('/error?error=invalid_params&status=400', baseUrl))
	}

	// 4. Proteção contra CSRF: compara o state original com o retornado
	if (state !== stateCookie) {
		const baseUrl = requestUtils.getHostFromRequest(req)
		return NextResponse.redirect(new URL('/error?error=invalid_state&status=400', baseUrl))
	}

	// 5. Troca o código de autorização por tokens reais com o 'code_verifier'
	let tokens: OAuth2Tokens
	try {
		// Obtém os tokens reais
		tokens = await google.validateAuthorizationCode(code, verifierCookie)
	} catch {
		// Caso o código de autorização ou o código verificador seja inválido
		const baseUrl = requestUtils.getHostFromRequest(req)
		return NextResponse.redirect(new URL('/error?error=invalid_code&status=400', baseUrl))
	}

	// 6. Decodifica o ID token do Google (JWT fornecido pelo Google OAuth) e extrai os dados do usuário
	const claims = decodeIdToken(tokens.idToken()) as {
		sub: string
		name: string
		email: string
		picture: string
	}
	const googleId = claims.sub
	const name = claims.name
	const email = claims.email
	const picture = claims.picture

	// 7. Verifica se o e-mail pertence ao domínio @inpe.br
	if (!isValidDomain(email)) {
		const baseUrl = requestUtils.getHostFromRequest(req)
		return NextResponse.redirect(new URL('/error?error=unauthorized&status=403', baseUrl))
	}

	// 8. Verifica se o usuário já existe
	const existingUser = await getUserFromGoogleId(googleId)

	// 9. Se o usuário não existir, cria um novo usuário com os dados do Google
	const user = existingUser.user ?? (await createUserFromGoogleId(googleId, email, name, picture))

	// 10. Verifica se o usuário está ativo (ativado por administrador)
	// Busca os dados completos do usuário no banco para verificar status
	const userWithStatus = await db.query.authUser.findFirst({
		where: eq(authUser.id, user.id),
	})

	if (!userWithStatus?.isActive) {
		const baseUrl = requestUtils.getHostFromRequest(req)
		return NextResponse.redirect(new URL('/error?error=account_not_activated&status=403', baseUrl))
	}

	// Remove todas as sessões antigas do usuário antes de criar uma nova
	// Isso garante que apenas uma sessão válida exista por vez
	const { destroyAllSession } = await import('@/lib/auth/session')
	await destroyAllSession(user.id)
	console.log('🗑️ [API_AUTH_GOOGLE] Sessões antigas removidas antes de criar nova sessão:', { userId: user.id })

	// 11. Cria a sessão e o cookie de sessão
	const sessionToken = await createSessionCookie(user.id)
	if ('error' in sessionToken) {
		const baseUrl = requestUtils.getHostFromRequest(req)
		return NextResponse.redirect(new URL('/error?error=session_error&status=500', baseUrl))
	}

	// Atualiza o último acesso do usuário
	await updateUserLastLogin(user.id)

	// Redireciona o usuário para a página privada
	return NextResponse.redirect(new URL('/admin/welcome', req.url))
}
