import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import * as table from '$lib/server/db/schema'
import * as utils from '$lib/server/utils'

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
	if (!userProfile?.id) return { error: { field: null, code: 'NO_USER_PROFILE', message: 'O perfil do usuário nao foi encontrado.' } }

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
