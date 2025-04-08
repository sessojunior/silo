import { verify } from '@node-rs/argon2'
import { fail, redirect } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import * as auth from '$lib/server/auth'
import { db } from '$lib/server/db'
import * as table from '$lib/server/db/schema'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async (event) => {
	// Verifica se o usuário já está logado
	if (event.locals.user) {
		// Redireciona o usuário para a página privada
		return redirect(302, '/app')
	}
	return {}
}

export const actions: Actions = {
	// Login
	login: async (event) => {
		const formData = await event.request.formData()
		const email = formData.get('email') as string
		const password = formData.get('password') as string

		// Valida o e-mail
		if (!auth.validateEmail(email)) {
			return fail(400, { field: 'email', message: 'Digite um e-mail válido.' })
		}

		// Valida a senha
		if (!auth.validatePassword(password)) {
			return fail(400, { field: 'password', message: 'Digite uma senha válida.' })
		}

		// Formata os dados para buscar no banco de dados
		const format = {
			// Formata o e-mail, converte tudo para minúsculo
			email: email.trim().toLowerCase()
		}

		// Busca o usuário no banco de dados pelo e-mail
		const results = await db.select().from(table.user).where(eq(table.user.email, format.email))

		// Se o usuário não existir, retorna um erro
		const existingUser = results.at(0)
		if (!existingUser) {
			return fail(400, { field: 'email', message: 'Não tem nenhum usuário com este e-mail.' })
		}

		// Verifica se a senha corresponde ao hash armazenado no banco de dados
		// Se a senha for inválida, retorna um erro
		const validPassword = await verify(existingUser.password, password, {
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		})
		if (!validPassword) {
			return fail(400, { field: 'password', message: 'A senha está incorreta.' })
		}

		// Cria a sessão e o cookie de sessão
		const sessionToken = auth.generateSessionToken()
		const session = await auth.createSession(sessionToken, existingUser.id)
		auth.setSessionTokenCookie(event, sessionToken, session.expiresAt)

		// Redireciona o usuário para a página privada
		return redirect(302, '/app')
	}
}
