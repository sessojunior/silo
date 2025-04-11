import { redirect, fail } from '@sveltejs/kit'
import * as auth from '$lib/server/auth'

// Faz logout do usuário
export async function GET(event): Promise<Response> {
	const session = event.locals.session

	// Retorna erro 401 se não houver sessão ativa
	if (!session) throw fail(401, { message: 'Sessão não encontrada' })

	// Invalida a sessão
	await auth.invalidateSessionToken(session.id)

	// Remove o cookie
	auth.deleteCookieSessionToken(event)

	// Redireciona o usuário para a tela de login
	throw redirect(302, '/sign-in')
}
