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
	// Login
	login: async (event) => {
		const formData = await event.request.formData()
		const email = formData.get('email') as string
		const password = formData.get('password') as string

		// Formata os dados para buscar no banco de dados
		const formatEmail = email.trim().toLowerCase()

		// Verifica se o usuário existe e se a senha está correta
		// Caso o usuário não exista, será exibido um erro.
		const resultUser = await auth.signIn(formatEmail, password)
		if ('error' in resultUser) return fail(400, { field: resultUser.error.field, message: resultUser.error.message ?? 'Ocorreu um erro ao fazer o login.' })

		// Se o e-mail do usuário ainda não tiver sido verificado
		if (!resultUser.user.emailVerified) {
			// Obtém um código OTP e salva-o no banco de dados
			const otp = await auth.generateCode(formatEmail)
			if ('error' in otp) return fail(400, { field: 'email', message: otp.error.message ?? 'Erro ao gerar o código para enviar por e-mail.' })

			// Código OTP
			const code = otp.code

			// Envia o código OTP por e-mail
			await auth.sendEmailCode({ email: formatEmail, type: 'sign-in', code })

			// console.log('code', code)

			// Retorna para a página o próximo passo
			return { step: 2, email: formatEmail }
		}

		// Cria a sessão e o cookie de sessão
		const resultSession = await auth.createSession(resultUser.user?.id as string)
		if ('error' in resultSession) return fail(400, { field: 'code', message: resultSession.error.message ?? 'Ocorreu um erro ao criar a sessão.' })
		auth.setCookieSessionToken(event, resultSession.token, resultSession.session.expiresAt)

		// Redireciona o usuário para a página privada
		return redirect(302, '/app')
	},
	// Recebe o código OTP e o e-mail para verificação para enviar o token
	'send-code': async (event) => {
		const formData = await event.request.formData()
		const email = formData.get('email') as string
		const codeParts = formData.getAll('code') // Retorna o array de 'code'
		const code = codeParts.join('').toUpperCase() as string // Junta os valores de 'code' como string e converte para maiúscula

		// Formata os dados para buscar no banco de dados
		const formatEmail = email.trim().toLowerCase()

		// Verifica se o e-mail existe no banco de dados
		const resultUser = await auth.validateUserEmail(formatEmail)
		if ('error' in resultUser) return fail(400, { field: null, message: resultUser.error.message ?? 'Não existe um usuário com este e-mail.' })

		// Obtém os dados do usuário
		const user = resultUser.user

		// Verifica se o código OTP enviado pelo usuário é válido e se não está expirado
		// Se o código for válido e não estiver expirado, define o e-mail do usuário como verificado (1) na tabela 'user' do banco de dados
		// Se for inválido, retorna um erro
		const resultCode = await auth.validateCode({ email: formatEmail, code: typeof code === 'string' ? code : '' })
		if ('error' in resultCode) return fail(400, { field: 'code', message: resultCode.error ? resultCode.error.message : 'O código é inválido ou expirou.' })

		// Cria a sessão e o cookie de sessão
		const resultSession = await auth.createSession(user?.id as string)
		if ('error' in resultSession) return fail(400, { field: 'code', message: resultSession.error.message ?? 'Ocorreu um erro ao criar a sessão.' })
		auth.setCookieSessionToken(event, resultSession.token, resultSession.session.expiresAt)

		// Redireciona o usuário para a página de boas vindas
		return redirect(302, '/app/welcome')
	}
}
