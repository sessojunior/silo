import { fail, redirect } from '@sveltejs/kit'
import * as auth from '$lib/server/auth'
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
	// Recebe o e-mail para enviar para o usuário o código OTP
	'send-email': async (event) => {
		const formData = await event.request.formData()
		const email = formData.get('email') as string

		// Valida o e-mail
		if (!auth.validateEmail(email)) {
			return fail(400, { field: 'email', message: 'Digite um e-mail válido.' })
		}

		// Formata os dados para buscar no banco de dados
		const formatEmail = email.trim().toLowerCase()

		// Verifica se o e-mail existe no banco de dados
		const verifyUserEmail = await auth.validateUserEmail(formatEmail)
		if (!verifyUserEmail.success) return fail(400, { field: 'email', message: verifyUserEmail.error?.message ?? 'Digite um e-mail válido.' })

		// Obtém um código OTP e salva-o no banco de dados
		const verificationCode = await auth.generateEmailVerificationCode(formatEmail)
		if (verificationCode === null) return fail(400, { field: 'email', message: 'Ocorreu um erro ao gerar o código para enviar por e-mail.' })

		// Tipo de verificação
		// const type = 'forget-password'

		// Envia o código OTP por e-mail
		// await auth.sendEmailVerificationCode({ email: formatEmail, type, code: verificationCode })

		console.log('code', verificationCode)

		// Retorna para a página o step 2
		return { step: 2, email: formatEmail }
	},
	// Recebe o código OTP e o e-mail para verificação para enviar o token
	'send-code': async (event) => {
		const formData = await event.request.formData()
		const email = formData.get('email') as string
		const codeParts = formData.getAll('code') // Retorna o array de 'code'
		const code = codeParts.join('').toUpperCase() as string // Junta os valores de 'code' como string e converte para maiúscula

		// Valida o e-mail
		if (!auth.validateEmail(email)) {
			return fail(400, { field: 'email', message: 'Digite um e-mail válido.' })
		}

		// Formata os dados para buscar no banco de dados
		const formatEmail = email.trim().toLowerCase()

		// Verifica se o e-mail existe no banco de dados
		const verifyUserEmail = await auth.validateUserEmail(formatEmail)
		if (!verifyUserEmail.success) return fail(400, { field: 'email', message: verifyUserEmail.error?.message ?? 'Digite um e-mail válido.' })

		// Obtém os dados do usuário
		const user = verifyUserEmail.user

		// Verifica se o código OTP enviado pelo usuário é válido e se não expirou
		const verifyCode = await auth.validateVerificationCode({ email: formatEmail, code: typeof code === 'string' ? code : '' })
		if (verifyCode.error) {
			return fail(400, { field: 'code', message: verifyCode.error ? verifyCode.error.message : 'O código é inválido ou expirou.' })
		}

		// Cria a sessão e o cookie de sessão
		const sessionToken = auth.generateSessionToken()
		const session = await auth.createSession(sessionToken, user?.id as string)
		auth.setSessionTokenCookie(event, sessionToken, session.expiresAt)

		// Retorna sucesso
		return { step: 3, token: sessionToken }
	},
	// Recebe o token e a senha alterada
	'send-password': async (event) => {
		const formData = await event.request.formData()
		const token = formData.get('token') as string
		const password = formData.get('password') as string

		// Valida o token de sessão e obtém a sessão e o usuário
		const { session, user } = await auth.validateSessionToken(token as string)

		// Se a sessão for inválida
		if (!session) {
			console.log('Sessão inválida!')
			// Redireciona o usuário para a etapa 1 de esqueceu a senha
			return redirect(302, '/forget-password')
		}

		// Altera a senha
		const userPassword = await auth.changeUserPassword({ userId: user.id, password })
		if (userPassword.error) {
			return fail(400, { field: 'code', message: userPassword.error ? userPassword.error.message : 'Ocorreu um erro ao alterar a senha.' })
		}

		// Retorna sucesso
		return { step: 4, user }
	}
}
