import * as env from '$env/static/private'
import { Google } from 'arctic'
import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import * as table from '$lib/server/db/schema'
import { generateId } from './auth'
import { uploadProfileImage } from './upload-profile-image'

// Login com Google
// Para usar o Google como um provedor social, você precisa obter suas credenciais do Google.
// Você pode obtê-las criando um novo projeto no [Google Cloud Console](https://console.cloud.google.com/apis/dashboard).
// Para isso siga as seguintes etapas:
// 1. Dentro do [Google Cloud Console](https://console.cloud.google.com/apis/dashboard), clique no botão `Criar credenciais` e em seguida selecione `ID do cliente OAuth`.
// 2. Na tela a seguir, com o título `Criar ID do cliente do OAuth`, você deve selecionar o tipo de aplicativo. Selecione `Aplicativo da Web`. Depois dissom digite o nome como `Better Auth` (mas pode ser o nome que quiser, utilize um que identifique melhor o seu aplicativo).
// 3. Em URIs de redirecionamento autorizados, adicione a seguinte URL: `http://localhost:5173/sign-in/google/callback` (se estiver em ambiente de desenvolvimento).
// 4. Irá exibir um modal, com o título `Cliente OAuth criado`. Irá exibir o `ID do cliente` e a `Chave secreta do cliente`. Você irá precisar copiar ambos.
// 5. Retornando ao Visual Studio Code, no arquivo `.env`, você deverá colar o conteúdo do `ID do cliente` em `GOOGLE_CLIENT_ID`. E o conteúdo da `Chave secreta do cliente` em `GOOGLE_CLIENT_SECRET`.
// 6. Ao fechar o modal, você verá a credencial criada em `IDs do cliente OAuth 2.0`. Se quiser ver novamente o conteúdo do `ID do cliente` e da `Chave secreta do cliente`, clique no botão com o ícone `Editar cliente OAuth`.
// 7. Agora já pode utilizar no projeto.

// Inicializa o provedor do Google com o ID do cliente, o segredo do cliente e a URL de redirecionamento
export const google = new Google(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, 'http://localhost:5173/sign-in/google/callback')

// Obtém o usuário do banco de dados pelo ID do Google
export async function getUserFromGoogleId(googleId: string) {
	// Verifica se o usuário existe no banco de dados pelo ID do Google
	const selectUser = await db
		.select({
			user: table.authUser,
			googleId: table.authProvider.googleId
		})
		.from(table.authProvider)
		.innerJoin(table.authUser, eq(table.authProvider.userId, table.authUser.id))
		.where(eq(table.authProvider.googleId, googleId))
		.limit(1)
		.then((results) => results.at(0))

	// Se usuário não for encontrado
	if (!selectUser?.user.id) return { error: { code: 'USER_NOT_FOUND', message: 'Não existe um usuário com este ID do Google.' } }

	// Usuário encontrado com sucesso
	return { user: { id: selectUser.user.id, name: selectUser.user.name, email: selectUser.user.email, emailVerified: selectUser.user.emailVerified, googleId: selectUser.googleId } }
}

// Cria um novo usuário ou vincula um usuário existente baseado no Google ID e e-mail
export async function createUserFromGoogleId(googleId: string, email: string, name: string, picture: string) {
	// Formata os dados recebidos
	const formatName = name.trim()
	const formatEmail = email.trim().toLowerCase()

	// 1. Verifica se existe um usuário com o googleId recebido
	const selectProvider = await db
		.select()
		.from(table.authProvider)
		.where(eq(table.authProvider.googleId, googleId))
		.limit(1)
		.then((res) => res.at(0))

	// Se o usuário for encontrado
	if (selectProvider?.userId) {
		// Obtém os dados do usuário
		const selectUserByProvider = await db
			.select()
			.from(table.authUser)
			.where(eq(table.authUser.id, selectProvider.userId))
			.limit(1)
			.then((res) => res.at(0))

		// Se já houver um usuário com este googleId, retorna os dados do usuário
		if (selectUserByProvider?.id) {
			return { id: selectUserByProvider.id, name: selectUserByProvider.name, email: selectUserByProvider.email, emailVerified: selectUserByProvider.emailVerified, googleId }
		}
	}

	// 2. Verifica se já existe um usuário com o mesmo e-mail (sem googleId ainda vinculado)
	const selectUserByEmail = await db
		.select()
		.from(table.authUser)
		.where(eq(table.authUser.email, formatEmail))
		.limit(1)
		.then((res) => res.at(0))

	// Se houver um usuário com o mesmo e-mail, mas ainda não tem o googleId vinculado,
	// cria o vínculo adicionando um registro na tabela auth_provider com o googleId
	if (selectUserByEmail?.id) {
		// Insere um registro na tabela auth_provider
		await db.insert(table.authProvider).values({ id: crypto.randomUUID(), googleId, userId: selectUserByEmail.id })

		// Salva a imagem de perfil no Google
		await uploadProfileImage(picture, selectUserByEmail.id)

		// Retorna os dados do usuário
		return { id: selectUserByEmail.id, name: selectUserByEmail.name, email: selectUserByEmail.email, emailVerified: selectUserByEmail.emailVerified, googleId }
	}

	// 3. Se chegou até aqui, o usuário não existe ainda, então cria o usuário e vincula-o ao provedor com o googleId

	// Cria um novo usuário e
	const userId = generateId()
	await db.insert(table.authUser).values({ id: userId, name: formatName, email: formatEmail, emailVerified: 1, password: '' })

	// Vincula o usuário ao provedor com o googleId
	const providerId = generateId()
	await db.insert(table.authProvider).values({ id: providerId, googleId, userId })

	// Salva a imagem de perfil no Google
	await uploadProfileImage(picture, userId)

	// Retorna os dados do usuário
	return { id: userId, name: formatName, email: formatEmail, emailVerified: 1, googleId }
}
