import { fail, redirect } from '@sveltejs/kit'
import * as auth from '$lib/server/auth'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async (event) => {
	// Verifica se o usuário já está logado
	if (event.locals.user) {
		// Redireciona o usuário para a página privada
		return redirect(302, '/app/dashboard')
	}
	return {}
}

export const actions: Actions = {
	// Cadastro de usuário
	register: async (event) => {
		const formData = await event.request.formData()
		const name = formData.get('name') as string
		const email = formData.get('email') as string
		const password = formData.get('password') as string

		// Formata os dados para buscar no banco de dados
		const formatEmail = email.trim().toLowerCase()

		// Cria a conta do usuário
		// Caso o usuário já exista, será exibido um erro que já existe. O usuário precisará fazer login.
		const resultUser = await auth.signUp(name, formatEmail, password)
		if ('error' in resultUser) return fail(400, { field: resultUser.error.field, message: resultUser.error.message ?? 'Ocorreu um erro ao criar o usuário.' })

		// Obtém um código OTP e salva-o no banco de dados
		const otp = await auth.generateOtp(formatEmail)
		if ('error' in otp) return fail(400, { field: null, message: otp.error.message ?? 'Erro ao gerar o código para enviar por e-mail.' })

		// Código OTP
		const code = otp.code

		// Envia o código OTP por e-mail
		await auth.sendEmailOtp({ email: formatEmail, type: 'email-verification', code })

		// console.log('code', code)

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

		// Verifica se o e-mail existe no banco de dados
		const resultUser = await auth.validateUserEmail(formatEmail)
		if ('error' in resultUser) return fail(400, { field: null, message: resultUser.error.message ?? 'Não existe um usuário com este e-mail.' })

		// Obtém os dados do usuário
		const user = resultUser.user

		// Verifica se o código OTP enviado pelo usuário é válido e se não está expirado
		// Se o código for válido e não estiver expirado, define o e-mail do usuário como verificado (1) na tabela 'user' do banco de dados
		// Se for inválido, retorna um erro
		const resultCode = await auth.validateOtp({ email: formatEmail, code: typeof code === 'string' ? code : '' })
		if ('error' in resultCode) return fail(400, { field: 'code', message: resultCode.error ? resultCode.error.message : 'O código é inválido ou expirou.' })

		// Cria a sessão e o cookie de sessão
		const sessionToken = auth.generateSessionToken()
		const resultSession = await auth.createSession(sessionToken, user?.id as string)
		if ('error' in resultSession) return fail(400, { field: null, message: resultSession.error.message ?? 'Ocorreu um erro ao criar a sessão.' })
		auth.setCookieSessionToken(event, sessionToken, resultSession.session.expiresAt)

		// Redireciona o usuário para a página de boas vindas
		return redirect(302, '/app/welcome')
	}
}
