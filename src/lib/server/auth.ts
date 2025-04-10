import type { RequestEvent } from '@sveltejs/kit'
import { eq, and, lt } from 'drizzle-orm'
import { verify, hash } from '@node-rs/argon2'
import { sha256 } from '@oslojs/crypto/sha2'
import { encodeBase64url, encodeHexLowerCase, encodeBase32LowerCase } from '@oslojs/encoding'
import { type RandomReader, generateRandomString } from '@oslojs/crypto/random'
import { db } from '$lib/server/db'
import * as table from '$lib/server/db/schema'
import { sendEmail } from './email'

// Gera um ID
export function generateId(): string {
	// ID com 120 bits, ou aproximadamente o mesmo que o UUID v4.
	const bytes = crypto.getRandomValues(new Uint8Array(15))
	const id = encodeBase32LowerCase(bytes)
	return id
}

// Gera um hash da senha
export async function generateHashPassword(password: string): Promise<string> {
	// Cria o hash da senha com os parâmetros mínimos recomendados
	const passwordHash = await hash(password, {
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1
	})
	return passwordHash
}

// Verifica se a senha corresponde ao hash da senha
export async function verifyPassword({ password, hashPassword }: { password: string; hashPassword: string }): Promise<boolean> {
	// Verifica se a senha corresponde ao hash da senha
	const validPassword = await verify(hashPassword, password, {
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1
	})
	return validPassword
}

// Gera um token
export function generateToken(): string {
	// Gera o token com 20 bytes
	const bytes = crypto.getRandomValues(new Uint8Array(20))
	const token = encodeBase64url(bytes)
	return token
}

// Gera um hash do token
export function generateHashToken(token: string): string {
	// Gera o hash SHA-256 do token
	const hashToken = encodeHexLowerCase(sha256(new TextEncoder().encode(token)))
	return hashToken
}

// Gera um código OTP
// - alphabet: Caracteres permitidos e legíveis em todas as tipografias, para evitar ambiguidades (exemplo: '347AEFHJKMNPRTWY')
// - numberCharacters: Número de caracteres que serão gerados (exemplo: 5)
export function generateOtp({ allowedCharacters, numberCharacters }: { allowedCharacters: string; numberCharacters: number }): string {
	// Gera um código aleatório utilizando caracteres permitidos e comprimento fixo de caracteres
	// A probabilidade de acertar aleatoriamente este código é de 1 em 1.048.576 (cerca de 1 em 1 milhão)
	const code = generateRandomString(
		{
			read(bytes) {
				crypto.getRandomValues(bytes)
			}
		} as RandomReader, // Sequência aleatória de bytes
		allowedCharacters, // Caracteres permitidos
		numberCharacters // Número de caracteres que serão gerados
	)
	return code
}

// Valida o e-mail
export function validateEmail(email: string): boolean {
	// 1. Verifica se o valor é uma string
	if (typeof email !== 'string') return false

	// 2. E-mail não pode exceder 255 caracteres (limite comum baseado no RFC 5321)
	if (email.length > 255) return false

	// 3. E-mail não pode começar nem terminar com espaços
	if (email.trim() !== email) return false

	// 4. Divide o e-mail pela "@" e verifica se há exatamente uma ocorrência
	const atParts = email.split('@')
	if (atParts.length !== 2) return false

	// 5. Separa a parte local (antes do @) e o domínio (depois do @)
	const [localPart, domainPart] = atParts

	// 6. A parte local (antes do @) deve existir
	if (!localPart) return false

	// 7. A parte do domínio (após o @) deve existir e não conter dois pontos consecutivos
	if (!domainPart || domainPart.includes('..')) return false

	// 8. O domínio deve conter pelo menos um ponto (.)
	const domainSegments = domainPart.split('.')
	if (domainSegments.length < 2) return false

	// 9. Nenhum segmento do domínio (antes ou depois do ponto) pode ser vazio
	// Isso evita casos como "user@.com" ou "user@domain."
	if (domainSegments.some((part) => part.length === 0)) return false

	// 10. Regex para validar caracteres permitidos na parte local
	// Aceita letras, números e os caracteres especiais mais comuns permitidos por RFCs
	const validLocal = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/
	if (!validLocal.test(localPart)) return false

	// 11. Regex para validar o domínio (letras, números, hífen e ponto)
	// Não permite caracteres especiais nem espaços
	const validDomain = /^[a-zA-Z0-9.-]+$/
	if (!validDomain.test(domainPart)) return false

	// 12. Se passou por todas as verificações, é um e-mail válido
	return true
}

// Valida a senha
export function validatePassword(password: string): boolean {
	// 1. Verifica se é uma string
	if (typeof password !== 'string') return false

	// 2. Verifica o comprimento (mínimo 8, máximo 120)
	if (password.length < 8 || password.length > 120) return false

	// 3. Verifica presença de pelo menos uma letra minúscula
	if (!/[a-z]/.test(password)) return false

	// 4. Verifica presença de pelo menos uma letra maiúscula
	if (!/[A-Z]/.test(password)) return false

	// 5. Verifica presença de pelo menos um número
	if (!/[0-9]/.test(password)) return false

	// 6. Verifica presença de pelo menos um caractere especial
	const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>_+=\-[\]/~]/
	if (!hasSpecialChar.test(password)) return false

	// 7. Se passou por todas as verificações, é uma senha válida
	return true
}

// Valida o nome
export function validateName(name: string): boolean {
	// 1. Verifica se o valor é uma string
	if (typeof name !== 'string') return false

	// Remove espaços do início e fim da string
	const trimmed = name.trim()

	// 2. Verifica se o nome tem pelo menos 2 caracteres visíveis
	if (trimmed.length < 2) return false

	// 3. Verifica se o nome contém apenas caracteres permitidos:
	// Letras latinas (com ou sem acento), ç, espaços, hífens e apóstrofos
	const validNameRegex = /^[\p{L}\p{M}'\- ]+$/u
	if (!validNameRegex.test(trimmed)) return false

	// Se passou por todas as verificações, o nome é válido
	return true
}

// Sessões
// Os usuários usarão um token de sessão vinculado a uma sessão em vez do ID diretamente.
// O ID da sessão será o hash SHA-256 do token.
// O SHA-256 é uma função de hash unidirecional.
// Isso garante que, mesmo que o conteúdo do banco de dados tenha vazado,
// o invasor não conseguirá recuperar tokens válidos.

// Cria uma sessão para o usuário
// O token da sessão será um hash SHA-256 do token
// A sessão expira em 30 dias
export async function createSessionToken(
	userId: string
): Promise<{ session: { token: string; userId: string; expiresAt: Date }; token: string } | { error: { code: string; message: string } }> {
	// Gera um token aleatório
	const token = generateToken()

	// Gera o hash do token
	const hashToken = generateHashToken(token)

	// Um dia em milissegundos
	const DAY_IN_MS = 24 * 60 * 60 * 1000 // 86400000 ms (1 dia)

	// Sessão expira em 30 dias
	const expiresAt = new Date(Date.now() + DAY_IN_MS * 30)

	// ID da sessão
	const sessionId = generateId()

	// Dados da sessão
	const session: table.AuthSession = { id: sessionId, token: hashToken, userId, expiresAt }

	// Insere a sessão no banco de dados
	const [insertSession] = await db.insert(table.authSession).values(session).returning()
	if (!insertSession) return { error: { code: 'INSERT_SESSION_ERROR', message: 'Erro ao salvar a sessão.' } }

	// Retorna a sessão
	return { session, token }
}

// Valida um token de sessão
// 1. Verifica se a sessão existe no banco de dados
// 2. Verifica se a sessão expirou
// 3. Se a sessão não expirou, verifica se ela precisa ser estendida
// 4. Apaga do banco de dados todos os tokens expirados
export async function validateSessionToken(
	token: string
): Promise<
	{ session: { id: string; token: string; userId: string; expiresAt: Date }; user: { id: string; name: string; email: string } } | { error: { code: string; message: string } }
> {
	// Gera o hash do token
	const hashToken = generateHashToken(token)

	// 1. Verifica se a sessão existe no banco de dados
	const [selectSession] = await db
		.select({
			user: { id: table.authUser.id, name: table.authUser.name, email: table.authUser.email },
			session: { id: table.authSession.id, token: table.authSession.token, userId: table.authSession.userId, expiresAt: table.authSession.expiresAt }
		})
		.from(table.authSession)
		.innerJoin(table.authUser, eq(table.authSession.userId, table.authUser.id))
		.where(eq(table.authSession.token, hashToken))

	// Se a sessão não existe
	if (!selectSession) return { error: { code: 'SESSION_NOT_EXISTS', message: 'A sessão não existe.' } }

	// Obtém a sessão e o usuário
	const { session, user } = selectSession

	// 2. Verifica se a sessão expirou
	const sessionExpired = Date.now() >= session.expiresAt.getTime()

	// Se a sessão expirou
	if (sessionExpired) {
		// Exclui a sessão do banco de dados
		await db.delete(table.authSession).where(eq(table.authSession.id, session.id))
		return { error: { code: 'SESSION_EXPIRED', message: 'A sessão expirou.' } }
	}

	// Um dia em milissegundos
	const DAY_IN_MS = 24 * 60 * 60 * 1000 // 86400000 ms (1 dia)

	// 3. Se a sessão não expirou, verifica se ela precisa ser estendida
	// Isso garante que as sessões ativas sejam persistidas, enquanto as inativas eventualmente expirarão.
	// Verifica se há menos de 15 dias (metade da expiração de 30 dias) antes da expiração.
	const renewSession = Date.now() >= session.expiresAt.getTime() - DAY_IN_MS * 15

	// Se a sessão precisa ser estendida, atualiza a data de expiração
	if (renewSession) {
		session.expiresAt = new Date(Date.now() + DAY_IN_MS * 30)
		await db.update(table.authSession).set({ expiresAt: session.expiresAt }).where(eq(table.authSession.id, session.id))
	}

	// 4. Apaga do banco de dados todos os tokens expirados
	await db.delete(table.authSession).where(lt(table.authSession.expiresAt, new Date()))

	// Retorna a sessão e o usuário
	return { session, user }
}
export type SessionValidationResult = Awaited<ReturnType<typeof validateSessionToken>>

// Invalida uma sessão pelo token excluindo-a do banco de dados
export async function invalidateSessionToken(sessionToken: string): Promise<void> {
	await db.delete(table.authSession).where(eq(table.authSession.token, sessionToken))
}

// Invalida todas as sessões de um usuário excluindo-as do banco de dados
export async function invalidateAllUserSessionTokens(userId: string): Promise<void> {
	await db.delete(table.authSession).where(eq(table.authSession.userId, userId))
}

// Cookies
// A proteção CSRF é essencial ao usar cookies.
// O SvelteKit tem proteção CSRF básica usando o header Origin que é habilitado por padrão.
// Os cookies de sessão devem ter os seguintes atributos:

// - HttpOnly: Os cookies são acessíveis apenas no lado do servidor
// - SameSite=Lax: Use Strict para sites críticos
// - Secure: Os cookies só podem ser enviados por HTTPS (deve ser omitido ao testar no localhost)
// - Max-Age ou Expires: Deve ser definido para persistir cookies
// - Path=/: Os cookies podem ser acessados de todas as rotas

// O SvelteKit define automaticamente a flag Secure quando implantado na produção.

// Nome do cookie de sessão
export const sessionCookieName = 'auth-session'

// Cria o cookie de sessão com o token e a data de expiração
export function setCookieSessionToken(event: RequestEvent, token: string, expiresAt: Date): void {
	event.cookies.set(sessionCookieName, token, { expires: expiresAt, path: '/' })
}

// Exclui o cookie de sessão
export function deleteCookieSessionToken(event: RequestEvent): void {
	event.cookies.delete(sessionCookieName, { maxAge: 0, path: '/' })
}

// Gera o código de verificação OTP para enviá-lo por e-mail e salva-o no banco de dados
export async function generateCode(email: string): Promise<{ success: boolean; code: string } | { error: { code: string; message: string } }> {
	// Formata os dados recebidos
	const formatEmail = email.trim().toLowerCase()

	// Se o e-mail for inválido retorna null
	if (!validateEmail(formatEmail)) return { error: { code: 'INVALID_EMAIL', message: 'E-mail inválido.' } }

	// Verifica se o usuário existe no banco de dados pelo e-mail
	const selectUser = await db
		.select()
		.from(table.authUser)
		.where(eq(table.authUser.email, formatEmail))
		.limit(1)
		.then((results) => results.at(0))

	// Se o usuário não for encontrado
	if (!selectUser?.id) return { error: { code: 'NO_EMAIL_FOUND', message: 'Não existe um usuário com este e-mail.' } }

	// ID do código
	const codeId = generateId()

	// Gera um código aleatório utilizando caracteres legíveis em todas as tipografias, para evitar ambiguidades e número de caracteres que serão gerados
	// A probabilidade de acertar aleatoriamente este código é de 1 em 1.048.576 (cerca de 1 em 1 milhão)
	const code = generateOtp({ allowedCharacters: '347AEFHJKMNPRTWY', numberCharacters: 5 })

	// Remove códigos anteriores do mesmo usuário
	await db.delete(table.authCode).where(eq(table.authCode.userId, selectUser.id))

	// Um minuto em milissegundos
	const MINUTE_IN_MS = 60 * 1000 // 60000 ms (1 minuto)

	// Tempo de expiração do código, expira em 10 minutos
	const expiresAt = new Date(Date.now() + MINUTE_IN_MS * 10)

	// Insere o novo código no banco de dados
	const [insertCode] = await db
		.insert(table.authCode)
		.values({
			id: codeId,
			code,
			email,
			userId: selectUser.id,
			expiresAt
		})
		.returning()
	if (!insertCode) return { error: { code: 'INSERT_CODE_ERROR', message: 'Erro ao salvar a código no banco de dados.' } }

	// Retorna o código OTP
	return { success: true, code }
}

// Envia o código de verificação OTP para o e-mail do usuário
export async function sendEmailCode({
	email,
	type,
	code
}: {
	email: string
	type: string
	code: string
}): Promise<{ success: boolean } | { error: { code: string; message: string } }> {
	// Formata os dados recebidos
	const formatEmail = email.trim().toLowerCase()

	// Se o e-mail for inválido retorna null
	if (!validateEmail(formatEmail)) return { error: { code: 'INVALID_EMAIL', message: 'E-mail inválido.' } }

	// Envia o e-mail com o código OTP
	// Retorna um objeto: { success: boolean, error?: { code, message } }
	return await sendEmail({
		to: email,
		subject: 'Código de verificação',
		text: `Utilize o seguinte código de verificação ${type === 'sign-in' ? 'para fazer login' : type === 'email-verification' ? 'para verificar seu e-mail' : type === 'forget-password' ? 'para recuperar sua senha' : 'a seguir'}: ${code}`
	})
}

// Verifica se o código de verificação OTP enviado para o usuário é válido e se não expirou
// 1. Se o código for válido, define o e-mail do usuário como verificado (1) na tabela 'user' do banco de dados
// 2. Apaga do banco de dados todos os códigos expirados
export async function validateCode({ email, code }: { email: string; code: string }): Promise<{ success: boolean } | { error: { code: string; message: string } }> {
	// Formata os dados recebidos
	const formatEmail = email.trim().toLowerCase()

	// Verifica se o e-mail é válido
	if (!validateEmail(formatEmail)) return { error: { code: 'INVALID_EMAIL', message: 'O e-mail é inválido.' } }

	// Apaga do banco de dados todos os códigos expirados
	await db.delete(table.authCode).where(lt(table.authCode.expiresAt, new Date()))

	// Busca o código informado, que ainda esteja ativo, para o e-mail fornecido
	const selectCode = await db
		.select({
			code: table.authCode.code,
			expiresAt: table.authCode.expiresAt
		})
		.from(table.authCode)
		.where(and(eq(table.authCode.email, formatEmail), eq(table.authCode.code, code)))
		.limit(1)
		.then((res) => res[0])

	// Se não encontrou o código (porque não existe ou expirou e foi deletado)
	if (!selectCode) return { error: { code: 'WRONG_OR_EXPIRED_CODE', message: 'O código é inválido ou expirou.' } }

	// Define o e-mail do usuário como verificado (1) na tabela 'user' do banco de dados
	await db.update(table.authUser).set({ emailVerified: 1 }).where(eq(table.authUser.email, formatEmail))

	// Código válido
	return { success: true }
}

// Verifica se o e-mail do usuário é válido e existe e obtém os dados do usuário
export async function validateUserEmail(
	email: string
): Promise<{ success: boolean; user: { id: string; name: string; email: string } } | { error: { code: string; message: string } }> {
	// Formata os dados recebidos
	const formatEmail = email.trim().toLowerCase()

	// Verifica se o e-mail é válido
	if (!validateEmail(formatEmail)) return { error: { code: 'INVALID_EMAIL', message: 'O e-mail é inválido.' } }

	// Verifica se o usuário existe no banco de dados pelo e-mail
	const selectUser = await db
		.select()
		.from(table.authUser)
		.where(eq(table.authUser.email, formatEmail))
		.limit(1)
		.then((results) => results.at(0))

	// Se usuário não for encontrado
	if (!selectUser?.id) return { error: { code: 'NO_EMAIL_FOUND', message: 'Não existe um usuário com este e-mail.' } }

	// Retorna os dados do usuário
	return { success: true, user: { id: selectUser.id, name: selectUser.name, email: selectUser.email } }
}

// Altera a senha do usuário
export async function changeUserPassword({
	userId,
	password
}: {
	userId: string
	password: string
}): Promise<{ success: boolean; user: { id: string; name: string; email: string } } | { error: { code: string; message: string } }> {
	// Verifica se o usuário existe no banco de dados pelo ID do usuário (userId)
	const selectUser = await db
		.select()
		.from(table.authUser)
		.where(eq(table.authUser.id, userId))
		.limit(1)
		.then((results) => results.at(0))

	// Se usuário não for encontrado
	if (!selectUser?.id) return { error: { code: 'NO_USER_FOUND', message: 'O usuário não existe.' } }

	// Verifica se a senha é válida
	if (!validatePassword(password)) return { error: { code: 'INVALID_PASSWORD', message: 'A senha é inválida.' } }

	// Cria o hash da senha
	const passwordHash = await generateHashPassword(password)

	// Altera a senha do usuário
	const updateUser = await db.update(table.authUser).set({ password: passwordHash }).where(eq(table.authUser.id, selectUser.id)).returning({ id: table.authUser.id })
	if (!updateUser) return { error: { code: 'UPDATE_PASSWORD_ERROR', message: 'Ocorreu um erro ao alterar a senha.' } }

	// Retorna os dados do usuário
	return { success: true, user: { id: selectUser.id, name: selectUser.name, email: selectUser.email } }
}

// Cria um usuário
export async function signUp(
	name: string,
	email: string,
	password: string
): Promise<{ success: boolean; user: { id: string; name: string; email: string; emailVerified: number } } | { error: { field: string | null; code: string; message: string } }> {
	// Formata os dados recebidos
	const formatName = name.trim()
	const formatEmail = email.trim().toLowerCase()

	// Verifica se o nome é válido
	if (!validateName(formatName)) return { error: { field: 'name', code: 'INVALID_NAME', message: 'O nome é inválido.' } }

	// Verifica se o e-mail é válido
	if (!validateEmail(formatEmail)) return { error: { field: 'email', code: 'INVALID_EMAIL', message: 'O e-mail é inválido.' } }

	// Verifica se o usuário já existe no banco de dados pelo e-mail
	const selectUser = await db
		.select()
		.from(table.authUser)
		.where(eq(table.authUser.email, formatEmail))
		.limit(1)
		.then((results) => results.at(0))

	// Se usuário for encontrado
	if (selectUser?.id) return { error: { field: 'email', code: 'USER_ALREADY_EXISTS', message: 'Já existe um usuário com este e-mail.' } }

	// Verifica se a senha é válida
	if (!validatePassword(password)) return { error: { field: 'password', code: 'INVALID_PASSWORD', message: 'A senha é inválida.' } }

	// ID do usuário
	const userId = generateId()

	// E-mail não está verificado ainda
	const emailVerified = 0 // Deixar como o (não verificado). 0 é false (não verificado) e 1 é true (verificado)

	// Cria o hash da senha
	const passwordHash = await generateHashPassword(password)

	// Insere o usuário no banco de dados
	const [insertUser] = await db
		.insert(table.authUser)
		.values({
			id: userId,
			name: formatName,
			email: formatEmail,
			emailVerified,
			password: passwordHash
		})
		.returning()
	if (!insertUser) return { error: { field: null, code: 'INSERT_USER_ERROR', message: 'Erro ao salvar o usuário no banco de dados.' } }

	// Retorna os dados do usuário criado
	return { success: true, user: { id: insertUser.id, name: insertUser.name, email: insertUser.email, emailVerified: insertUser.emailVerified } }
}

// Login do usuário
export async function signIn(
	email: string,
	password: string
): Promise<{ success: boolean; user: { id: string; name: string; email: string; emailVerified: number } } | { error: { field: string | null; code: string; message: string } }> {
	// Formata os dados recebidos
	const formatEmail = email.trim().toLowerCase()

	// Verifica se o e-mail é válido
	if (!validateEmail(formatEmail)) return { error: { field: 'email', code: 'INVALID_EMAIL', message: 'O e-mail é inválido.' } }

	// Verifica se o usuário não existe no banco de dados pelo e-mail
	const selectUser = await db
		.select()
		.from(table.authUser)
		.where(eq(table.authUser.email, formatEmail))
		.limit(1)
		.then((results) => results.at(0))

	// Se usuário for encontrado
	if (!selectUser?.id) return { error: { field: 'email', code: 'USER_NOT_FOUND', message: 'Não existe um usuário com este e-mail.' } }

	// Verifica se a senha é válida
	if (!validatePassword(password)) return { error: { field: 'password', code: 'INVALID_PASSWORD', message: 'A senha é inválida.' } }

	// Verifica se a senha corresponde ao hash armazenado no banco de dados
	const validPassword = verifyPassword({ hashPassword: selectUser.password, password })
	if (!validPassword) return { error: { field: 'password', code: 'INCORRECT_PASSWORD', message: 'A senha está incorreta.' } }

	// Retorna os dados do usuário
	return { success: true, user: { id: selectUser.id, name: selectUser.name, email: selectUser.email, emailVerified: selectUser.emailVerified } }
}
