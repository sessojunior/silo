import type { Handle } from '@sveltejs/kit'
import * as auth from '$lib/server/auth.js'

// Middleware para validar o token de sessão
const handleAuth: Handle = async ({ event, resolve }) => {
	// Verifica se o cookie de sessão existe
	const sessionToken = event.cookies.get(auth.sessionCookieName)

	// Se o cookie de sessão não existir, limpa o usuário e a sessão no event.locals
	// Para saber mais sobre event.locals:
	// https://khromov.se/the-comprehensive-guide-to-locals-in-sveltekit/
	if (!sessionToken) {
		event.locals.user = null
		event.locals.session = null
		return resolve(event)
	}

	// Valida o token de sessão e obtém a sessão e o usuário
	const { session, user } = await auth.validateSessionToken(sessionToken)

	// Se a sessão for válida, cria o cookie de sessão
	// Caso contrário, exclui o cookie de sessão
	if (session) {
		auth.setSessionTokenCookie(event, sessionToken, session.expiresAt)
	} else {
		auth.deleteSessionTokenCookie(event)
	}

	// Define o usuário e a sessão no locals
	event.locals.user = user
	event.locals.session = session
	return resolve(event)
}

export const handle: Handle = handleAuth
