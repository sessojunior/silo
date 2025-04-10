import { fail } from '@sveltejs/kit'
import * as auth from '$lib/server/auth'
import type { Actions } from './$types'

export const actions: Actions = {
	// Recebe o e-mail para enviar para o usuário o código OTP
	'send-email': async (event) => {
		const formData = await event.request.formData()
		const email = formData.get('email') as string

		// Formata os dados para buscar no banco de dados
		const formatEmail = email.trim().toLowerCase()

		// Valida o e-mail
		if (!auth.validateEmail(formatEmail)) return fail(400, { field: 'email', message: 'Digite um e-mail válido.' })

		// Verifica se o e-mail existe no banco de dados
		const resultUser = await auth.validateUserEmail(formatEmail)
		if ('error' in resultUser) return fail(400, { field: 'email', message: resultUser.error.message ?? 'Não existe um usuário com este e-mail.' })

		// Obtém um código OTP e salva-o no banco de dados
		const otp = await auth.generateCode(formatEmail)
		if ('error' in otp) return fail(400, { field: 'email', message: otp.error.message ?? 'Erro ao gerar o código para enviar por e-mail.' })

		// Código OTP
		const code = otp.code

		// Envia o código OTP por e-mail
		// await auth.sendEmailOtp({ email: formatEmail, type: 'forget-password', code })

		console.log('code', code)

		// Retorna para a página o próximo passo
		return { step: 2, email: formatEmail }
	},
	// Recebe o código OTP e o e-mail para verificação para enviar o token
	'send-code': async (event) => {
		const formData = await event.request.formData()
		const email = formData.get('email') as string
		const codeParts = formData.getAll('code') // Retorna o array de 'code'
		const code = codeParts.join('').toUpperCase() as string // Junta os valores de 'code' como string e converte para maiúscula

		// Formata os dados para buscar no banco de dados
		const formatEmail = email.trim().toLowerCase()

		// Valida o e-mail
		if (!auth.validateEmail(formatEmail)) return fail(400, { field: 'email', message: 'Digite um e-mail válido.' })

		// Verifica se o e-mail existe no banco de dados
		const resultUser = await auth.validateUserEmail(formatEmail)
		if ('error' in resultUser) return fail(400, { field: 'email', message: resultUser.error.message ?? 'Não existe um usuário com este e-mail.' })

		// Obtém os dados do usuário
		const user = resultUser.user

		// Verifica se o código OTP enviado pelo usuário é válido e se não expirou
		// Se o código for válido e não estiver expirado, define o e-mail do usuário como verificado (1) na tabela 'user' do banco de dados
		// Se for inválido, retorna um erro
		const resultCode = await auth.validateCode({ email: formatEmail, code: typeof code === 'string' ? code : '' })
		if ('error' in resultCode) return fail(400, { field: 'code', message: resultCode.error ? resultCode.error.message : 'O código é inválido ou expirou.' })

		// Cria a sessão e o cookie de sessão
		const resultSession = await auth.createSessionToken(user?.id as string)
		if ('error' in resultSession) return fail(400, { field: 'code', message: resultSession.error.message ?? 'Ocorreu um erro ao criar a sessão.' })
		auth.setCookieSessionToken(event, resultSession.token, resultSession.session.expiresAt)

		// Retorna para a página o próximo passo
		return { step: 3, token: resultSession.token }
	},
	// Recebe o token e a senha alterada
	'send-password': async (event) => {
		const formData = await event.request.formData()
		const token = formData.get('token') as string
		const password = formData.get('password') as string

		// Valida o token de sessão e obtém a sessão e o usuário
		// Se a sessão for inválida, redireciona o usuário para a etapa 1
		const resultSession = await auth.validateSessionToken(token as string)
		if ('error' in resultSession) return fail(400, { step: 1 })

		// Obtém os dados do usuário
		const user = resultSession.user

		// Altera a senha
		const userPassword = await auth.changeUserPassword({ userId: resultSession.user.id, password })
		if ('error' in userPassword) return fail(400, { field: 'password', message: userPassword.error ? userPassword.error.message : 'Ocorreu um erro ao alterar a senha.' })

		// Retorna para a página o próximo passo
		return { step: 4, user }
	}
}
