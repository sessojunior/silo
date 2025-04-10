import type { RequestEvent } from '@sveltejs/kit'
import { eq, and, lt } from 'drizzle-orm'
import { verify } from '@node-rs/argon2'
import { hash } from '@node-rs/argon2'
import { sha256 } from '@oslojs/crypto/sha2'
import { encodeBase64url, encodeHexLowerCase, encodeBase32LowerCase } from '@oslojs/encoding'
import { type RandomReader, generateRandomString } from '@oslojs/crypto/random'
import { db } from '$lib/server/db'
import * as table from '$lib/server/db/schema'
import { sendEmail } from './email'

// Sessões
// Os usuários usarão um token de sessão vinculado a uma sessão em vez do ID diretamente.
// O ID da sessão será o hash SHA-256 do token.
// O SHA-256 é uma função de hash unidirecional.
// Isso garante que, mesmo que o conteúdo do banco de dados tenha vazado,
// o invasor não conseguirá recuperar tokens válidos.

// Um dia em milissegundos
const DAY_IN_MS = 24 * 60 * 60 * 1000 // 86400000 ms (1 dia)

// Um minuto em milissegundos
const MINUTE_IN_MS = 60 * 1000 // 60000 ms (1 minuto)

// Nome do cookie de sessão
export const sessionCookieName = 'auth-session'

// Gera o token de sessão
export function generateSessionToken(): string {
	// Gera um token aleatório com pelo menos 20 bytes
	const bytes = crypto.getRandomValues(new Uint8Array(20))
	const token = encodeBase64url(bytes)

	// Retorna o token
	return token
}

// Cria uma sessão para o usuário
// O ID da sessão será um hash SHA-256 do token
// A sessão expira em 30 dias
export async function createSession(
	token: string,
	userId: string
): Promise<{ session: { id: string; userId: string; expiresAt: Date } } | { error: { code: string; message: string } }> {
	// Gera o hash SHA-256 do token
	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)))

	// Sessão expira em 30 dias
	const expiresAt = new Date(Date.now() + DAY_IN_MS * 30)

	// Dados da sessão
	const session: table.Session = { id: sessionId, userId, expiresAt }

	// Insere a sessão no banco de dados
	const [newSession] = await db.insert(table.session).values(session).returning()
	if (!newSession) return { error: { code: 'SESSION_INTERNAL_ERROR', message: 'Erro ao salvar a sessão no banco de dados.' } }

	// Retorna a sessão
	return { session }
}

// Valida um token de sessão
// As sessões são validadas em 2 etapas:
// 1. Verifica se a sessão existe no banco de dados
// 2. Verifica se a sessão expirou
export async function validateSessionToken(
	token: string
): Promise<{ session: { id: string; userId: string; expiresAt: Date }; user: { id: string; name: string; email: string } } | { error: { code: string; message: string } }> {
	// Gera o hash SHA-256 do token
	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)))

	// 1. Verifica se a sessão existe no banco de dados
	const [resultSession] = await db
		.select({
			user: { id: table.user.id, name: table.user.name, email: table.user.email },
			session: { id: table.session.id, userId: table.session.userId, expiresAt: table.session.expiresAt }
		})
		.from(table.session)
		.innerJoin(table.user, eq(table.session.userId, table.user.id))
		.where(eq(table.session.id, sessionId))

	// Se a sessão não existe
	if (!resultSession) return { error: { code: 'SESSION_NOT_EXISTS', message: 'A sessão não existe.' } }

	// Obtém a sessão e o usuário
	const { session, user } = resultSession

	// 2. Verifica se a sessão expirou
	const sessionExpired = Date.now() >= session.expiresAt.getTime()

	// Se a sessão expirou
	if (sessionExpired) {
		// Exclui a sessão do banco de dados
		await db.delete(table.session).where(eq(table.session.id, session.id))
		return { error: { code: 'SESSION_EXPIRED', message: 'A sessão expirou.' } }
	}

	// Se a sessão não expirou, verifica se ela precisa ser estendida
	// Isso garante que as sessões ativas sejam persistidas, enquanto as inativas eventualmente expirarão.
	// Verifica se há menos de 15 dias (metade da expiração de 30 dias) antes da expiração.
	const renewSession = Date.now() >= session.expiresAt.getTime() - DAY_IN_MS * 15

	// Se a sessão precisa ser estendida, atualiza a data de expiração
	if (renewSession) {
		session.expiresAt = new Date(Date.now() + DAY_IN_MS * 30)
		await db.update(table.session).set({ expiresAt: session.expiresAt }).where(eq(table.session.id, session.id))
	}

	// Retorna a sessão e o usuário
	return { session, user }
}

// Tipo de retorno da função validateSessionToken
export type SessionValidationResult = Awaited<ReturnType<typeof validateSessionToken>>

// Invalida uma sessão pelo ID excluindo-a do banco de dados
export async function invalidateSessionId(sessionId: string): Promise<void> {
	await db.delete(table.session).where(eq(table.session.id, sessionId))
}

// Invalida todas as sessões de um usuário excluindo-as do banco de dados
export async function invalidateAllSessions(userId: string): Promise<void> {
	await db.delete(table.session).where(eq(table.session.userId, userId))
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

// Cria o cookie de sessão com o token e a data de expiração
export function setCookieSessionToken(event: RequestEvent, token: string, expiresAt: Date): void {
	event.cookies.set(sessionCookieName, token, { expires: expiresAt, path: '/' })
}

// Exclui o cookie de sessão
export function deleteCookieSessionToken(event: RequestEvent): void {
	event.cookies.delete(sessionCookieName, { maxAge: 0, path: '/' })
}

// Gera um ID para o usuário
export function generateUserId(): string {
	// ID com 120 bits, ou aproximadamente o mesmo que o UUID v4.
	const bytes = crypto.getRandomValues(new Uint8Array(15))
	const id = encodeBase32LowerCase(bytes)
	return id
}

// Gera uma senha para o usuário
export async function generateUserPassword(password: string): Promise<string> {
	// Cria o hash da senha com os parâmetros mínimos recomendados
	const passwordHash = await hash(password, {
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1
	})
	return passwordHash
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

// Gera o código de verificação OTP para enviá-lo por e-mail e salva-o no banco de dados
export async function generateOtp(email: string): Promise<{ success: boolean; code: string } | { error: { code: string; message: string } }> {
	// Formata os dados para buscar o e-mail no banco de dados
	const formatEmail = email.trim().toLowerCase()

	// Se o e-mail for inválido retorna null
	if (!validateEmail(formatEmail)) return { error: { code: 'INVALID_EMAIL', message: 'E-mail inválido.' } }

	// Verifica se o usuário existe no banco de dados pelo e-mail
	const resultUser = await db
		.select()
		.from(table.user)
		.where(eq(table.user.email, formatEmail))
		.limit(1)
		.then((results) => results.at(0))

	// Se usuário não for encontrado
	if (!resultUser?.id) return { error: { code: 'NO_EMAIL_FOUND', message: 'Não existe um usuário com este e-mail.' } }

	// ID com 120 bits, ou aproximadamente o mesmo que o UUID v4.
	const id = encodeBase32LowerCase(crypto.getRandomValues(new Uint8Array(15)))

	// Sequência aletória
	const random: RandomReader = {
		read(bytes) {
			crypto.getRandomValues(bytes)
		}
	}

	// Caracteres permitidos e legíveis em todas as tipografias, para evitar ambiguidades
	const alphabet = '347AEFHJKMNPRTWY'

	// Número de caracteres que serão gerados
	const numberCharacters = 5

	// Gera um código aleatório utilizando caracteres permitidos e comprimento fixo de caracteres
	// A probabilidade de acertar aleatoriamente este código é de 1 em 1.048.576 (cerca de 1 em 1 milhão)
	const code = generateRandomString(random, alphabet, numberCharacters)

	// Remove códigos anteriores do mesmo usuário
	await db.delete(table.emailVerificationCode).where(eq(table.emailVerificationCode.userId, resultUser.id))

	// Insere o novo código no banco de dados, que expira em 10 minutos
	const [newCode] = await db
		.insert(table.emailVerificationCode)
		.values({
			id,
			code,
			email,
			userId: resultUser.id,
			expiresAt: new Date(Date.now() + MINUTE_IN_MS * 10)
		})
		.returning()
	if (!newCode) return { error: { code: 'OTP_INTERNAL_ERROR', message: 'Erro ao salvar a código no banco de dados.' } }

	// Retorna o código OTP
	return { success: true, code }
}

// Envia o código de verificação OTP para o e-mail do usuário
export async function sendEmailOtp({
	email,
	type,
	code
}: {
	email: string
	type: string
	code: string
}): Promise<{ success: boolean } | { error: { code: string; message: string } }> {
	// Formata os dados para buscar o e-mail no banco de dados
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
// Se o código for válido, define o e-mail do usuário como verificado (1) na tabela 'user' do banco de dados
export async function validateOtp({ email, code }: { email: string; code: string }): Promise<{ success: boolean } | { error: { code: string; message: string } }> {
	// Formata os dados para buscar o e-mail no banco de dados
	const formatEmail = email.trim().toLowerCase()

	// Verifica se o e-mail é válido
	if (!validateEmail(formatEmail)) return { error: { code: 'INVALID_EMAIL', message: 'O e-mail é inválido.' } }

	// Apaga do banco de dados todos os códigos expirados
	await db.delete(table.emailVerificationCode).where(lt(table.emailVerificationCode.expiresAt, new Date()))

	// Busca o código informado, que ainda esteja ativo, para o e-mail fornecido
	const resultCode = await db
		.select({
			code: table.emailVerificationCode.code,
			expiresAt: table.emailVerificationCode.expiresAt
		})
		.from(table.emailVerificationCode)
		.where(and(eq(table.emailVerificationCode.email, formatEmail), eq(table.emailVerificationCode.code, code)))
		.limit(1)
		.then((res) => res[0])

	// Se não encontrou o código (porque não existe ou expirou e foi deletado)
	if (!resultCode) return { error: { code: 'WRONG_OR_EXPIRED_CODE', message: 'O código é inválido ou expirou.' } }

	// Define o e-mail do usuário como verificado (1) na tabela 'user' do banco de dados
	await db.update(table.user).set({ emailVerified: 1 }).where(eq(table.user.email, formatEmail))

	// Código válido
	return { success: true }
}

// Verifica se o e-mail do usuário é válido e existe e obtém o ID do usuário
export async function validateUserEmail(
	email: string
): Promise<{ success: boolean; user: { id: string; name: string; email: string } } | { error: { code: string; message: string } }> {
	// Formata os dados para buscar o e-mail no banco de dados
	const formatEmail = email.trim().toLowerCase()

	// Verifica se o e-mail é válido
	if (!validateEmail(formatEmail)) return { error: { code: 'INVALID_EMAIL', message: 'O e-mail é inválido.' } }

	// Verifica se o usuário existe no banco de dados pelo e-mail
	const resultUser = await db
		.select()
		.from(table.user)
		.where(eq(table.user.email, formatEmail))
		.limit(1)
		.then((results) => results.at(0))

	// Se usuário não for encontrado
	if (!resultUser?.id) return { error: { code: 'NO_EMAIL_FOUND', message: 'Não existe um usuário com este e-mail.' } }

	// Retorna os dados do usuário
	return { success: true, user: { id: resultUser.id, name: resultUser.name, email: resultUser.email } }
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
	const resultUser = await db
		.select()
		.from(table.user)
		.where(eq(table.user.id, userId))
		.limit(1)
		.then((results) => results.at(0))

	// Se usuário não for encontrado
	if (!resultUser?.id) return { error: { code: 'NO_USER_FOUND', message: 'O usuário não existe.' } }

	// Verifica se a senha é válida
	if (!validatePassword(password)) return { error: { code: 'INVALID_PASSWORD', message: 'A senha é inválida.' } }

	// Cria o hash da senha
	const passwordHash = await generateUserPassword(password)

	// Altera a senha do usuário
	const updatePassword = await db.update(table.user).set({ password: passwordHash }).where(eq(table.user.id, resultUser.id)).returning({ id: table.user.id })
	if (!updatePassword) return { error: { code: 'INTERNAL_ERROR', message: 'Ocorreu um erro ao alterar a senha.' } }

	// Retorna os dados do usuário
	return { success: true, user: { id: resultUser.id, name: resultUser.name, email: resultUser.email } }
}

// Cria um usuário
export async function signUp(
	name: string,
	email: string,
	password: string
): Promise<{ success: boolean; user: { id: string; name: string; email: string; emailVerified: number } } | { error: { field: string | null; code: string; message: string } }> {
	// Formata os dados para buscar o e-mail no banco de dados
	const formatEmail = email.trim().toLowerCase()

	// Verifica se o nome é válido
	if (!validateName(name)) return { error: { field: 'name', code: 'INVALID_NAME', message: 'O nome é inválido.' } }

	// Verifica se o e-mail é válido
	if (!validateEmail(formatEmail)) return { error: { field: 'email', code: 'INVALID_EMAIL', message: 'O e-mail é inválido.' } }

	// Verifica se o usuário já existe no banco de dados pelo e-mail
	const resultUser = await db
		.select()
		.from(table.user)
		.where(eq(table.user.email, formatEmail))
		.limit(1)
		.then((results) => results.at(0))

	// Se usuário for encontrado
	if (resultUser?.id) return { error: { field: 'email', code: 'USER_ALREADY_EXISTS', message: 'Já existe um usuário com este e-mail.' } }

	// Verifica se a senha é válida
	if (!validatePassword(password)) return { error: { field: 'password', code: 'INVALID_PASSWORD', message: 'A senha é inválida.' } }

	// Gera o ID do usuário
	const userId = generateUserId()

	// Cria o hash da senha
	const passwordHash = await generateUserPassword(password)

	// Insere o usuário no banco de dados
	const [newUser] = await db
		.insert(table.user)
		.values({
			id: userId,
			// Formata o nome, tira espaços em branco
			name: name.trim(),
			// Formata o e-mail, converte tudo para minúsculo
			email: email.trim().toLowerCase(),
			// E-mail não está verificado ainda
			emailVerified: 0, // 0 é false
			// Hash da senha
			password: passwordHash
		})
		.returning()
	if (!newUser) return { error: { field: null, code: 'USER_INTERNAL_ERROR', message: 'Erro ao salvar o usuário no banco de dados.' } }

	// Retorna os dados do usuário criado
	return { success: true, user: { id: newUser.id, name: newUser.name, email: newUser.email, emailVerified: newUser.emailVerified } }
}

// Login do usuário
export async function signIn(
	email: string,
	password: string
): Promise<{ success: boolean; user: { id: string; name: string; email: string; emailVerified: number } } | { error: { field: string | null; code: string; message: string } }> {
	// Formata os dados para buscar o e-mail no banco de dados
	const formatEmail = email.trim().toLowerCase()

	// Verifica se o e-mail é válido
	if (!validateEmail(formatEmail)) return { error: { field: 'email', code: 'INVALID_EMAIL', message: 'O e-mail é inválido.' } }

	// Verifica se o usuário já existe no banco de dados pelo e-mail
	const resultUser = await db
		.select()
		.from(table.user)
		.where(eq(table.user.email, formatEmail))
		.limit(1)
		.then((results) => results.at(0))

	// Se usuário for encontrado
	if (!resultUser?.id) return { error: { field: 'email', code: 'USER_NOT_FOUND', message: 'Não existe um usuário com este e-mail.' } }

	// Verifica se a senha é válida
	if (!validatePassword(password)) return { error: { field: 'password', code: 'INVALID_PASSWORD', message: 'A senha é inválida.' } }

	// Verifica se a senha corresponde ao hash armazenado no banco de dados
	// Se a senha for inválida, retorna um erro
	const validPassword = await verify(resultUser.password, password, {
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1
	})
	if (!validPassword) return { error: { field: 'password', code: 'INCORRECT_PASSWORD', message: 'A senha está incorreta.' } }

	// Retorna os dados do usuário
	return { success: true, user: { id: resultUser.id, name: resultUser.name, email: resultUser.email, emailVerified: resultUser.emailVerified } }
}
