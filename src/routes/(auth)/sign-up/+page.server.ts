import { hash } from '@node-rs/argon2'
import { fail, redirect } from '@sveltejs/kit'
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
	// Cadastro de usuário
	register: async (event) => {
		const formData = await event.request.formData()
		const name = formData.get('name')
		const email = formData.get('email')
		const password = formData.get('password')

		// Valida o nome
		if (!auth.validateName(name)) {
			return fail(400, { field: 'name', message: 'Digite um nome válido.' })
		}

		// Valida o e-mail
		if (!auth.validateEmail(email)) {
			return fail(400, { field: 'email', message: 'Digite um e-mail válido.' })
		}

		// Valida a senha
		if (!auth.validatePassword(password)) {
			return fail(400, { field: 'password', message: 'Digite uma senha válida.' })
		}

		// Gera o ID do usuário
		const userId = auth.generateUserId()

		// Cria o hash da senha
		const passwordHash = await hash(password, {
			// Parâmetros mínimos recomendados
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		})

		// Formata os dados para inserir no banco de dados
		const format = {
			id: userId,
			// Formata o nome, tira espaços em branco
			name: name.trim(),
			// Formata o e-mail, converte tudo para minúsculo
			email: email.trim().toLowerCase(),
			// E-mail não está verificado ainda
			email_verified: 0, // false
			// Hash da senha
			password: passwordHash
		}

		try {
			// Insere o usuário no banco de dados
			await db.insert(table.user).values({ id: format.id, name: format.name, email: format.email, email_verified: format.email_verified, password: format.password })

			// Cria a sessão e o cookie de sessão
			const sessionToken = auth.generateSessionToken()
			const session = await auth.createSession(sessionToken, userId)
			auth.setSessionTokenCookie(event, sessionToken, session.expiresAt)
		} catch {
			console.error('Ocorreu um erro ao criar a sessão.')
			return fail(500, { field: null, message: 'Ocorreu um erro ao criar a sessão.' })
		}

		// Redireciona o usuário para a página privada
		return redirect(302, '/app')
	}
}
