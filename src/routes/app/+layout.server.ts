import { redirect } from '@sveltejs/kit'
import type { LayoutServerLoad } from './$types'
import fs from 'fs'
import path from 'path'

// Verifica se o usuário está logado
// Garante que qualquer rota dentro de /app/* tenha acesso ao usuário autenticado e redirecione se não estiver logado.
export const load: LayoutServerLoad = async (event) => {
	// Verifica se o usuário está logado
	if (!event.locals.user) {
		// Se não estiver logado, redireciona para a página de login
		throw redirect(302, '/sign-in')
	}

	// Dados do usuário
	const user = event.locals.user

	// Caminho absoluto do avatar do usuário
	const avatar = fs.existsSync(path.resolve('static/uploads/avatar', `${user.id}.webp`)) ? `${user.id}.webp` : ''

	// Retorna os dados do usuário
	return { user: { ...user, avatar } }
}
