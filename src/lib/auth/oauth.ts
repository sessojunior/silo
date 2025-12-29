import { randomUUID } from 'crypto'
import { Google } from 'arctic'
import { config } from '@/lib/config'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { authUser, authProvider } from '@/lib/db/schema'
import { uploadProfileImageFromUrl } from '@/lib/profileImage'
import { addUserToDefaultGroup } from '@/lib/auth/user-groups'

// Login com o Google

// Para usar o Google como um provedor social, você precisa obter suas credenciais do Google.
// Você pode obtê-las criando um novo projeto no Google Cloud Console: https://console.cloud.google.com/apis/dashboard.
// Estamos utilizando a biblioteca Arctic (https://arcticjs.dev/providers/google) para simplificar o processo.
// Para isso siga as seguintes etapas:
// 1. Dentro do Google Cloud Console (https://console.cloud.google.com/apis/dashboard), clique no botão 'Criar credenciais' e em seguida selecione 'ID do cliente OAuth'.
// 2. Na tela a seguir, com o título 'Criar ID do cliente do OAuth', você deve selecionar o tipo de aplicativo. Selecione 'Aplicativo da Web'. Depois dissom digite o nome como 'Silo Auth' (mas pode ser o nome que quiser, utilize um que identifique melhor o seu aplicativo).
// 3. Em URIs de redirecionamento autorizados, adicione a seguinte URL: '{APP_URL}/api/auth/callback/google' (onde {APP_URL} é a URL de produção configurada na variável APP_URL).
// 4. Irá exibir um modal, com o título 'Cliente OAuth criado'. Irá exibir o 'ID do cliente' e a 'Chave secreta do cliente'. Você irá precisar copiar ambos.
// 5. Retornando ao Visual Studio Code, no arquivo '.env', você deverá colar o conteúdo do 'ID do cliente' em 'GOOGLE_CLIENT_ID'. E o conteúdo da 'Chave secreta do cliente' em 'GOOGLE_CLIENT_SECRET'.
// 6. Ao fechar o modal, você verá a credencial criada em 'IDs do cliente OAuth 2.0'. Se quiser ver novamente o conteúdo do 'ID do cliente' e da 'Chave secreta do cliente', clique no botão com o ícone 'Editar cliente OAuth'.
// 7. Agora já pode utilizar no projeto.

// Inicializa o provedor social do Google com o ID do cliente, o segredo do cliente e a URL de redirecionamento
export const google = new Google(config.googleClientId, config.googleClientSecret, config.googleCallbackUrl)

// Obtém o usuário do banco de dados pelo Google ID
export async function getUserFromGoogleId(googleId: string) {
	// Verifica se o usuário existe no banco de dados pelo ID do Google
	const userGoogle = await db
		.select({
			user: authUser,
			googleId: authProvider.googleId,
		})
		.from(authProvider)
		.innerJoin(authUser, eq(authProvider.userId, authUser.id))
		.where(eq(authProvider.googleId, googleId))
		.limit(1)
		.then((rows) => rows.at(0))

	// Se usuário não for encontrado
	if (!userGoogle?.user?.id) return { error: { code: 'USER_NOT_FOUND', message: 'Não existe um usuário com este ID do Google.' } }

	// Usuário encontrado com sucesso
	return { user: { id: userGoogle.user.id, name: userGoogle.user.name, email: userGoogle.user.email, emailVerified: userGoogle.user.emailVerified, googleId: userGoogle.googleId } }
}

// Cria um novo usuário ou vincula um usuário existente baseado no Google ID e e-mail
export async function createUserFromGoogleId(googleId: string, email: string, name: string, picture: string) {
	// Formata os dados recebidos
	const formatName = name.trim()
	const formatEmail = email.trim().toLowerCase()

	// 1. Verifica se existe um usuário com o 'googleId' recebido
	const userGoogle = await db.query.authProvider.findFirst({ where: eq(authProvider.googleId, googleId) })

	// Se existir um usuário com o googleId, retorna os dados do usuário
	if (userGoogle?.id) {
		// Obtém os dados do usuário
		const user = await db
			.select()
			.from(authUser)
			.where(eq(authUser.id, userGoogle.userId))
			.limit(1)
			.then((rows) => rows.at(0))

		// Retorna os dados do usuário
		if (user?.id) return { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified, googleId }
	}

	// 2. Verifica se já existe um usuário com o mesmo e-mail (sem 'googleId' ainda vinculado)
	const userEmail = await db.query.authUser.findFirst({ where: eq(authUser.email, formatEmail) })

	// Se houver um usuário com o mesmo e-mail, mas ainda não tem o googleId vinculado,
	// cria o vínculo adicionando um registro na tabela 'auth_provider' com o 'googleId'
	if (userEmail?.id) {
		// Insere um registro na tabela auth_provider
		await db.insert(authProvider).values({ id: randomUUID(), googleId, userId: userEmail.id })

		// Salva a imagem de perfil no Google
		await uploadProfileImageFromUrl(picture, userEmail.id)

		// Retorna os dados do usuário
		return { id: userEmail.id, name: userEmail.name, email: userEmail.email, emailVerified: userEmail.emailVerified, googleId }
	}

	// 3. Se chegou até aqui, o usuário ainda não existe, então cria o usuário e vincula-o ao provedor com o 'googleId'

	// Cria um novo usuário
	const userId = randomUUID()
	await db.insert(authUser).values({
		id: userId,
		name: formatName,
		email: formatEmail,
		emailVerified: true,
		password: '',
		isActive: false, // usuários criados via Google também precisam de ativação por administrador
	})

	// Vincula o usuário ao provedor com o googleId
	const providerId = randomUUID()
	await db.insert(authProvider).values({ id: providerId, userId, googleId })

	// Salva a imagem de perfil no Google
	await uploadProfileImageFromUrl(picture, userId)

	// Adiciona automaticamente o usuário ao grupo padrão
	await addUserToDefaultGroup(userId)

	// Retorna os dados do usuário
	return { id: userId, name: formatName, email: formatEmail, emailVerified: true, googleId }
}

// Obtém o Google ID vinculado ao ID do usuário
export async function getGoogleIdFromUserId(userId: string): Promise<{ googleId: string | null }> {
	// Verifica se existe um 'googleId' vinculado ao 'userId' fornecido
	const userGoogleId = await db
		.select({
			googleId: authProvider.googleId,
		})
		.from(authProvider)
		.where(eq(authProvider.userId, userId))
		.limit(1)
		.then((rows) => rows.at(0))

	// Obtém o 'googleId' do usuário ou retorna null
	const googleId = userGoogleId?.googleId ?? null

	// Retorna o valor do 'googleId' ou null
	return { googleId }
}
