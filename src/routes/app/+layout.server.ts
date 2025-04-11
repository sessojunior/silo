import { redirect } from '@sveltejs/kit'
import type { LayoutServerLoad } from './$types'

// Verifica se o usuário está logado
// Garante que qualquer rota dentro de /app/* tenha acesso ao usuário autenticado
// e redirecione se não estiver logado.
export const load: LayoutServerLoad = async (event) => {
	if (!event.locals.user) {
		throw redirect(302, '/sign-in')
	}
	return { user: event.locals.user }
}
