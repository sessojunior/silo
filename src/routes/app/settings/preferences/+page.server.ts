import { fail } from '@sveltejs/kit'
import * as auth from '$lib/server/auth'
import type { Actions } from './$types'

export const actions: Actions = {
	// Alterar preferências
	'update-preferences': async (event) => {
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
		const otp = await auth.generateCode(formatEmail)
		if ('error' in otp) return fail(400, { field: null, message: otp.error.message ?? 'Erro ao gerar o código para enviar por e-mail.' })

		// Código OTP
		const code = otp.code

		// Envia o código OTP por e-mail
		await auth.sendEmailCode({ email: formatEmail, type: 'email-verification', code })

		// console.log('code', code)

		// Retorna para a página o próximo passo
		return { step: 2, email: formatEmail }
	}
}
