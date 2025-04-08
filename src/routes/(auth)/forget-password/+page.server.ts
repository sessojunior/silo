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
	// Esqueceu a senha
	'send-email': async (event) => {
		const formData = await event.request.formData()
		const email = formData.get('email')

		// Valida o e-mail
		if (!auth.validateEmail(email)) {
			return fail(400, { field: 'email', message: 'Digite um e-mail válido.' })
		}

		// Formata os dados para buscar no banco de dados
		const format = {
			// Formata o e-mail, converte tudo para minúsculo
			email: email.trim().toLowerCase()
		}

		// Busca o usuário no banco de dados pelo e-mail
		const user = await db
			.select({ id: table.user.id }) // Só busca o campo necessário
			.from(table.user)
			.where(eq(table.user.email, format.email))
			.then((results) => results.at(0))

		// Se usuário não for encontrado
		if (!user?.id) return fail(400, { field: 'email', message: 'Não existe um usuário com este e-mail.' })

		// Tipo de verificação
		const type = 'forget-password'

		// Obtém um código OTP e salva-o no banco de dados
		const verificationCode = await auth.generateEmailVerificationCode(format.email)
		if (verificationCode === null) return fail(400, { field: 'email', message: 'Ocorreu um erro ao gerar o código para enviar por e-mail.' })

		// Envia o código OTP por e-mail
		await auth.sendEmailVerificationCode({ email: format.email, type, code: verificationCode })

		// Retorna para a página o step 2
		return { step: 2 }
	},
	// Resetar a senha
	'send-code': async (event) => {
		const formData = await event.request.formData()
		const email = formData.get('email')
		const code = formData.get('code')

		console.log('reset password')

		// Valida o e-mail
		if (!auth.validateEmail(email)) {
			console.log('e-mail inválido')
			return fail(400, { field: 'email', message: 'Digite um e-mail válido.' })
		}

		// Formata os dados para buscar no banco de dados
		const format = {
			// Formata o e-mail, converte tudo para minúsculo
			email: email.trim().toLowerCase()
		}

		// Busca o usuário no banco de dados pelo e-mail
		const user = await db
			.select({ id: table.user.id }) // Só busca o campo necessário
			.from(table.user)
			.where(eq(table.user.email, format.email))
			.then((results) => results.at(0))

		// Se usuário não for encontrado
		if (!user?.id) {
			console.log('usuário inexistente')
			return fail(400, { field: 'email', message: 'Não existe um usuário com este e-mail.' })
		}

		// Retorna o ID do usuário
		const userId = user.id

		// -------- DEBUG - CODE --------
		console.log('code', code)
		// -------- DEBUG - CODE --------

		// Verifica se o código OTP enviado pelo usuário é válido e se não expirou
		const verifyCode = await auth.verifyVerificationCode({ email: format.email, code: typeof code === 'string' ? code : '' })
		if (verifyCode.error) {
			console.log('código inválido')
			return fail(400, { field: 'code', message: verifyCode.error ? verifyCode.error.message : 'O código é inválido ou expirou.' })
		}

		// Cria a sessão e o cookie de sessão
		const sessionToken = auth.generateSessionToken()
		const session = await auth.createSession(sessionToken, userId)
		auth.setSessionTokenCookie(event, sessionToken, session.expiresAt)

		// Retorna sucesso
		return { success: true }
	}
}
