import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import * as table from '$lib/server/db/schema'
import * as utils from '$lib/server/utils'
import { uploadProfileImageFromInput } from '$lib/server/upload-profile-image'
import { existsSync, unlinkSync } from 'fs'
import path from 'path'

// Obtém os dados do perfil do usuário
export async function getUserProfile(
	userId: string
): Promise<
	| { success: boolean; userProfile: { id: string; userId: string; genre: string; phone: string; role: string; team: string; company: string; location: string } }
	| { error: { field: string | null; code: string; message: string } }
> {
	// Verifica se enviou o ID do usuário
	if (!userId) return { error: { field: null, code: 'NO_USER_ID', message: 'O ID do usuário é obrigatório.' } }

	// Busca o perfil do usuário
	const userProfile = await db
		.select()
		.from(table.userProfile)
		.where(eq(table.userProfile.userId, userId))
		.limit(1)
		.then((results) => results.at(0))

	// Se perfil do usuário não for encontrado
	if (!userProfile?.id) return { error: { field: null, code: 'NO_USER_PROFILE', message: 'O perfil do usuário não foi encontrado.' } }

	// Retorna sucesso
	return { success: true, userProfile: userProfile }
}

// Altera ou cria um perfil do usuário, se não existir
export async function updateUserProfile(
	userId: string,
	name: string,
	genre: string,
	phone: string,
	role: string,
	team: string,
	company: string,
	location: string
): Promise<
	| { success: boolean; userProfile: { id: string; userId: string; genre: string; phone: string; role: string; team: string; company: string; location: string } }
	| { error: { field: string | null; code: string; message: string } }
> {
	// Verifica se enviou o ID do usuário
	if (!userId) return { error: { field: null, code: 'NO_USER_ID', message: 'O ID do usuário é obrigatório.' } }

	// Formata os dados recebidos
	const format = {
		name: name.trim(),
		genre: genre.trim().toLowerCase(),
		phone: phone.trim(),
		role: role.trim().toLowerCase(),
		team: team.trim(),
		company: company.trim(),
		location: location.trim()
	}

	// Verifica se o nome é válido
	if (!utils.validateName(format.name)) return { error: { field: 'name', code: 'INVALID_NAME', message: 'O nome é inválido.' } }

	// Verifica se o sexo é válido
	if (format.genre !== 'male' && format.genre !== 'female') return { error: { field: 'genre', code: 'INVALID_GENRE', message: 'O sexo é inválido.' } }

	// Verifica se o perfil do usuário já existe no banco de dados pelo ID do usuário
	const selectUserProfile = await db
		.select()
		.from(table.userProfile)
		.where(eq(table.userProfile.userId, userId))
		.limit(1)
		.then((results) => results.at(0))

	// Se o perfil do usuário não existir
	if (!selectUserProfile?.id) {
		// ID do perfil do usuário
		const userProfileId = utils.generateId()

		// Insere o perfil do usuário no banco de dados
		const [insertUserProfile] = await db
			.insert(table.userProfile)
			.values({
				id: userProfileId,
				userId,
				genre: format.genre,
				phone: format.phone,
				role: format.role,
				team: format.team,
				company: format.company,
				location: format.location
			})
			.returning()
		if (!insertUserProfile) return { error: { field: null, code: 'INSERT_USER_ERROR', message: 'Erro ao salvar o usuário no banco de dados.' } }

		// Retorna os dados do usuário criado
		return {
			success: true,
			userProfile: {
				id: insertUserProfile.id,
				userId: insertUserProfile.userId,
				genre: insertUserProfile.genre,
				phone: insertUserProfile.phone,
				role: insertUserProfile.role,
				team: insertUserProfile.team,
				company: insertUserProfile.company,
				location: insertUserProfile.location
			}
		}
	}

	// Atualiza o nome do usuário
	const [updateUser] = await db.update(table.authUser).set({ name: format.name }).where(eq(table.authUser.id, userId)).returning()
	if (!updateUser) return { error: { field: null, code: 'UPDATE_USER_NAME_ERROR', message: 'Erro ao atualizar o nome do usuário no banco de dados.' } }

	// Se o perfil do usuário existir, atualiza os dados do perfil do usuário
	const [updateUserProfile] = await db
		.update(table.userProfile)
		.set({
			genre: format.genre,
			phone: format.phone,
			role: format.role,
			team: format.team,
			company: format.company,
			location: format.location
		})
		.where(eq(table.userProfile.userId, userId))
		.returning()
	if (!updateUserProfile) return { error: { field: null, code: 'UPDATE_USER_PROFILE_ERROR', message: 'Erro ao atualizar o perfil do usuário no banco de dados.' } }

	// Retorna os dados do usuário alterado
	return {
		success: true,
		userProfile: {
			id: updateUserProfile.id,
			userId: updateUserProfile.userId,
			genre: updateUserProfile.genre,
			phone: updateUserProfile.phone,
			role: updateUserProfile.role,
			team: updateUserProfile.team,
			company: updateUserProfile.company,
			location: updateUserProfile.location
		}
	}
}

// Upload de foto de perfil
export async function uploadUserProfileImage(userId: string, file: File): Promise<{ success: boolean } | { error: { code: string; message: string } }> {
	if (!file) return { error: { code: 'NO_FILE', message: 'O arquivo é obrigatório.' } }

	// Faz o upload da imagem de perfil
	const uploadResult = await uploadProfileImageFromInput(file, userId)
	if (!uploadResult) return { error: { code: 'UPLOAD_ERROR', message: 'Erro ao fazer o upload da imagem de perfil.' } }

	// Retorna se fez ou não o upload
	return uploadResult
}

// Apaga a imagem de perfil
export function deleteUserProfileImage(userId: string): { success: boolean } | { error: { code: string; message: string } } {
	const imagePath = path.resolve('static/uploads/avatar', `${userId}.webp`)

	if (!existsSync(imagePath)) {
		return { error: { code: 'IMAGE_NOT_FOUND', message: 'Imagem de perfil não encontrada.' } }
	}

	try {
		unlinkSync(imagePath)
	} catch (error) {
		console.error(error)
		return { error: { code: 'DELETE_ERROR', message: 'Erro ao deletar a imagem de perfil.' } }
	}

	return { success: true }
}

// Obtém as preferências do usuário
export async function getUserPreferences(
	userId: string
): Promise<
	| { success: boolean; userPreferences: { id: string; userId: string; theme: string; notifyUpdates: boolean; sendNewsletters: boolean } }
	| { error: { field: string | null; code: string; message: string } }
> {
	// Verifica se enviou o ID do usuário
	if (!userId) return { error: { field: null, code: 'NO_USER_ID', message: 'O ID do usuário é obrigatório.' } }

	// Busca o perfil do usuário
	const userPreferences = await db
		.select()
		.from(table.userPreferences)
		.where(eq(table.userPreferences.userId, userId))
		.limit(1)
		.then((results) => results.at(0))

	// Se perfil do usuário não for encontrado
	if (!userPreferences?.id) return { error: { field: null, code: 'NO_USER_PREFERENCES', message: 'As preferências do usuário não foram encontradas.' } }

	// Retorna sucesso
	return { success: true, userPreferences: userPreferences }
}

// Altera ou cria as preferências do usuário, se não existir
export async function updateUserPreferences(
	userId: string,
	theme: string,
	notifyUpdates: boolean,
	sendNewsletters: boolean
): Promise<
	| { success: boolean; userPreferences: { id: string; userId: string; theme: string; notifyUpdates: boolean; sendNewsletters: boolean } }
	| { error: { field: string | null; code: string; message: string } }
> {
	// Verifica se enviou o ID do usuário
	if (!userId) return { error: { field: null, code: 'NO_USER_ID', message: 'O ID do usuário é obrigatório.' } }

	// Verifica se as preferências do usuário já existe no banco de dados pelo ID do usuário
	const selectUserPreferences = await db
		.select()
		.from(table.userPreferences)
		.where(eq(table.userPreferences.userId, userId))
		.limit(1)
		.then((results) => results.at(0))

	// Se as preferências do usuário não existir
	if (!selectUserPreferences?.id) {
		// ID do perfil do usuário
		const userPreferencesId = utils.generateId()

		// Insere as preferências do usuário no banco de dados
		const [insertUserPreferences] = await db
			.insert(table.userPreferences)
			.values({
				id: userPreferencesId,
				userId,
				theme: theme,
				notifyUpdates: notifyUpdates,
				sendNewsletters: sendNewsletters
			})
			.returning()
		if (!insertUserPreferences) return { error: { field: null, code: 'INSERT_USER_ERROR', message: 'Erro ao salvar o usuário no banco de dados.' } }

		// Retorna os dados do usuário criado
		return {
			success: true,
			userPreferences: {
				id: insertUserPreferences.id,
				userId: insertUserPreferences.userId,
				theme: insertUserPreferences.theme,
				notifyUpdates: insertUserPreferences.notifyUpdates,
				sendNewsletters: insertUserPreferences.sendNewsletters
			}
		}
	}

	// Se as preferências do usuário existir, atualiza as preferências do usuário
	const [updateUserPreferences] = await db
		.update(table.userPreferences)
		.set({
			theme: theme,
			notifyUpdates: notifyUpdates,
			sendNewsletters: sendNewsletters
		})
		.where(eq(table.userPreferences.userId, userId))
		.returning()
	if (!updateUserPreferences) return { error: { field: null, code: 'UPDATE_USER_PROFILE_ERROR', message: 'Erro ao atualizar o perfil do usuário no banco de dados.' } }

	// Retorna os dados do usuário alterado
	return {
		success: true,
		userPreferences: {
			id: updateUserPreferences.id,
			userId: updateUserPreferences.userId,
			theme: updateUserPreferences.theme,
			notifyUpdates: updateUserPreferences.notifyUpdates,
			sendNewsletters: updateUserPreferences.sendNewsletters
		}
	}
}

// Altera o tema das preferências do usuário
export async function updateUserTheme(
	userId: string,
	theme: string
): Promise<{ success: boolean; theme: string } | { error: { field: string | null; code: string; message: string } }> {
	if (!userId) {
		return { error: { field: null, code: 'NO_USER_ID', message: 'O ID do usuário é obrigatório.' } }
	}

	try {
		const [updated] = await db.update(table.userPreferences).set({ theme }).where(eq(table.userPreferences.userId, userId)).returning({ theme: table.userPreferences.theme })

		if (!updated?.theme) {
			return { error: { field: null, code: 'UPDATE_THEME_FAILED', message: 'Erro ao atualizar o tema do usuário.' } }
		}

		return { success: true, theme: updated.theme }
	} catch (err) {
		console.error('Erro ao atualizar tema:', err)
		return { error: { field: null, code: 'DB_ERROR', message: 'Erro interno ao atualizar o tema.' } }
	}
}
