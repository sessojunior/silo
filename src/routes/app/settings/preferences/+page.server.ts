import { fail } from '@sveltejs/kit'
import * as profile from '$lib/server/profile'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user ?? null

	// Dados das preferências do usuário
	let userPreferences = {
		theme: 'light',
		notifyUpdates: false,
		sendNewsletters: false
	}

	// Se o usuário existe
	if (user?.id) {
		// Dados das preferências do usuário
		const result = await profile.getUserPreferences(user.id)
		if ('success' in result) {
			userPreferences = {
				...userPreferences,
				...result.userPreferences
			}
		}
	}

	return {
		// Dados das preferências do usuário
		...userPreferences
	}
}

export const actions: Actions = {
	// Alterar preferências
	'update-preferences': async (event) => {
		const user = event.locals.user
		if (!user?.id) return fail(401, { field: null, message: 'Usuário não autenticado.' })

		const formData = await event.request.formData()

		const theme = formData.get('theme') as string
		const notifyUpdates = formData.get('notifyUpdates') === 'on'
		const sendNewsletters = formData.get('sendNewsletters') === 'on'

		// Atualiza ou cria perfil de usuário
		const userPreferences = await profile.updateUserPreferences(user.id, theme, notifyUpdates, sendNewsletters)
		if ('error' in userPreferences) {
			return fail(400, { field: userPreferences.error.field, message: userPreferences.error ? userPreferences.error.message : 'Ocorreu um erro ao alterar as preferências.' })
		}

		// Retorna sucesso
		return { success: true, userPreferences: userPreferences.userPreferences }
	}
}
