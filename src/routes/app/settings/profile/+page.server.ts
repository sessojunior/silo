import { fail } from '@sveltejs/kit'
import * as profile from '$lib/server/profile'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user ?? null

	// Dados do perfil do usuário
	let userProfile = {
		genre: '',
		phone: '',
		role: '',
		team: '',
		company: '',
		location: ''
	}

	// Obtém os dados do perfil do usuário
	if (user?.id) {
		const result = await profile.getUserProfile(user.id)
		if ('success' in result) {
			userProfile = result.userProfile
		}
	}

	return {
		// Dados do usuário
		id: user?.id ?? '',
		name: user?.name ?? '',
		email: user?.email ?? '',

		// Dados do perfil do usuário
		...userProfile
	}
}

export const actions: Actions = {
	// Alterar perfil
	'update-profile': async (event) => {
		const user = event.locals.user
		if (!user?.id) return fail(401, { field: null, message: 'Usuário não autenticado.' })

		const formData = await event.request.formData()

		const name = formData.get('name') as string
		const genre = formData.get('genre') as string
		const phone = formData.get('phone') as string
		const role = formData.get('role') as string
		const team = formData.get('team') as string
		const company = formData.get('company') as string
		const location = formData.get('location') as string

		// Atualiza ou cria perfil de usuário
		const userProfile = await profile.updateUserProfile(user.id, name, genre, phone, role, team, company, location)
		if ('error' in userProfile) {
			return fail(400, { field: userProfile.error.field, message: userProfile.error ? userProfile.error.message : 'Ocorreu um erro ao alterar o perfil.' })
		}

		// Retorna sucesso
		return { success: true, userProfile: userProfile.userProfile }
	}
}
