import { redirect, error, type RequestEvent } from '@sveltejs/kit'
import { createUserFromGoogleId, getUserFromGoogleId, google } from '$lib/server/oauth'
import * as auth from '$lib/server/auth'

import { decodeIdToken, OAuth2Tokens } from 'arctic'

// URL para validar o retorno de chamada do Google
// Verifica se o estado na URL corresponde ao estado armazenado
// Valida o código de autorização e o código verificador armazenado
// Se passou no escopo de autorização, decodifica o ID token e extrai os dados do usuário
// Verifica se o usuário já existe, caso contrário, cria um novo usuário com os dados do Google
// Por fim, cria uma nova sessão para o usuário e armazena o token de sessão no cookie
export async function GET(event: RequestEvent) {
	// 1. Recupera os cookies de segurança salvos no início do fluxo OAuth
	const cookieState = event.cookies.get('google_oauth_state')
	const cookieCodeVerifier = event.cookies.get('google_code_verifier')

	// 2. Recupera parâmetros de retorno da URL enviados pelo Google
	const urlCode = event.url.searchParams.get('code')
	const urlState = event.url.searchParams.get('state')

	// 3. Verifica se os parâmetros foram enviados
	if (!cookieState || !cookieCodeVerifier || !urlCode || !urlState) throw error(400, 'Parâmetros inválidos. Reinicie o login.')

	// 4. Proteção contra CSRF: compara o state original com o retornado
	if (cookieState !== urlState) throw error(400, 'State inválido. Reinicie o login.')

	// 5. Troca o código de autorização por tokens reais com o code_verifier
	let tokens: OAuth2Tokens
	try {
		// Obtém os tokens reais
		tokens = await google.validateAuthorizationCode(urlCode, cookieCodeVerifier)
	} catch {
		// Caso o código de autorização ou o código verificador seja inválido
		throw error(400, 'Código de autorização inválido. Reinicie o login.')
	}

	// 6. Decodifica o ID do token (JWT) e extrai os dados do usuário
	const claims = decodeIdToken(tokens.idToken()) as { sub: string; name: string; email: string; picture: string }
	const googleId = claims.sub
	const name = claims.name
	const email = claims.email
	const picture = claims.picture

	// 7. Verifica se o usuário já existe
	const existingUser = await getUserFromGoogleId(googleId)

	// 8. Verifica se o usuário existe, caso contrário, cria um usuário com os dados do usuário do Google
	const user = existingUser.user ?? (await createUserFromGoogleId(googleId, email, name, picture))

	// 9. Cria a sessão e o cookie de sessão
	const resultSession = await auth.createSessionToken(user?.id as string)
	if ('error' in resultSession) throw error(400, 'Ocorreu um erro ao criar a sessão.')
	auth.setCookieSessionToken(event, resultSession.token, resultSession.session.expiresAt)

	// 10. Redireciona o usuário para a página privada
	throw redirect(302, '/app/welcome')
}
