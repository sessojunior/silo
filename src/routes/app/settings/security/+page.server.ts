import { fail } from '@sveltejs/kit'
import * as auth from '$lib/server/auth'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user ?? null
	return {
		// Dados do usuário
		id: user?.id ?? '',
		name: user?.name ?? '',
		email: user?.email ?? ''
	}
}

export const actions: Actions = {
	// Alterar e-mail
	'update-email': async (event) => {
		const formData = await event.request.formData()
		const email = formData.get('email') as string

		// Dados do usuário autenticado
		const user = event.locals.user ?? null

		// Altera e e-mail do usuário
		const userEmail = await auth.changeUserEmail({ userId: user.id, email })
		if ('error' in userEmail) return fail(400, { field: 'email', message: userEmail.error ? userEmail.error.message : 'Ocorreu um erro ao alterar o e-mail.' })

		// Retorna para a página o sucesso
		return { success: true }
	},

	// Alterar senha
	'update-password': async (event) => {
		const formData = await event.request.formData()
		const password = formData.get('password') as string

		// Dados do usuário autenticado
		const user = event.locals.user ?? null

		// Altera a senha do usuário
		const userPassword = await auth.changeUserPassword({ userId: user.id, password })
		if ('error' in userPassword) return fail(400, { field: 'password', message: userPassword.error ? userPassword.error.message : 'Ocorreu um erro ao alterar a senha.' })

		// Retorna para a página o sucesso
		return { success: true }
	}
}
