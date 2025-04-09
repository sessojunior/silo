import type { Handle } from '@sveltejs/kit'
import * as auth from '$lib/server/auth.js'

// Middleware para validar o token de sessão
const handleAuth: Handle = async ({ event, resolve }) => {
	// Verifica se o cookie de sessão existe
	const sessionToken = event.cookies.get(auth.sessionCookieName)

	// Se o cookie de sessão não existir
	if (!sessionToken) {
		// Limpa o usuário e a sessão no event.locals
		// Para saber mais sobre event.locals:
		// https://khromov.se/the-comprehensive-guide-to-locals-in-sveltekit/
		event.locals.user = null
		event.locals.session = null
		return resolve(event)
	}

	// Valida o token de sessão e obtém a sessão e o usuário
	const userSession = await auth.validateSessionToken(sessionToken as string)

	// Se a sessão for inválida
	if ('error' in userSession) {
		// Exclui o cookie de sessão
		auth.deleteCookieSessionToken(event)
	} else {
		// Cria o cookie de sessão
		auth.setCookieSessionToken(event, sessionToken, userSession.session.expiresAt)

		// Define o usuário e a sessão no locals
		event.locals.user = userSession.user
		event.locals.session = userSession.session
	}

	return resolve(event)
}

export const handle: Handle = handleAuth
