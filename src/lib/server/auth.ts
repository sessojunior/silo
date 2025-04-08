import type { RequestEvent } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
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
export function generateSessionToken() {
	// Gera um token aleatório com pelo menos 20 bytes
	const bytes = crypto.getRandomValues(new Uint8Array(20))
	const token = encodeBase64url(bytes)

	// Retorna o token
	return token
}

// Cria uma sessão para o usuário
// O ID da sessão será um hash SHA-256 do token
// A sessão expira em 30 dias
export async function createSession(token: string, userId: string) {
	// Gera o hash SHA-256 do token
	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)))

	// Insere a sessão no banco de dados
	const session: table.Session = {
		id: sessionId,
		userId,
		// Sessão expira em 30 dias
		expiresAt: new Date(Date.now() + DAY_IN_MS * 30)
	}
	await db.insert(table.session).values(session)

	// Retorna a sessão
	return session
}

// Valida um token de sessão
// As sessões são validadas em 2 etapas:
// 1. Verifica se a sessão existe no banco de dados
// 2. Verifica se a sessão expirou
export async function validateSessionToken(token: string) {
	// Gera o hash SHA-256 do token
	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)))

	// 1. Verifica se a sessão existe no banco de dados
	const [result] = await db
		.select({
			// Dados retornados da tabela user
			user: { id: table.user.id, email: table.user.email },
			session: table.session
		})
		.from(table.session)
		.innerJoin(table.user, eq(table.session.userId, table.user.id))
		.where(eq(table.session.id, sessionId))

	// Se a sessão não existir, retorna null
	// Caso contrário, retorna a sessão e o usuário
	if (!result) {
		return { session: null, user: null }
	}
	const { session, user } = result

	// 2. Verifica se a sessão expirou
	const sessionExpired = Date.now() >= session.expiresAt.getTime()

	// Se a sessão expirou, exclui a sessão do banco de dados
	if (sessionExpired) {
		await db.delete(table.session).where(eq(table.session.id, session.id))
		return { session: null, user: null }
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
export async function invalidateSession(sessionId: string) {
	await db.delete(table.session).where(eq(table.session.id, sessionId))
}

// Invalida todas as sessões de um usuário excluindo-as do banco de dados
export async function invalidateAllSessions(userId: string) {
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
export function setSessionTokenCookie(event: RequestEvent, token: string, expiresAt: Date) {
	event.cookies.set(sessionCookieName, token, {
		// httpOnly: true,
		// sameSite: 'lax',
		expires: expiresAt,
		path: '/'
	})
}

// Exclui o cookie de sessão
export function deleteSessionTokenCookie(event: RequestEvent) {
	event.cookies.delete(sessionCookieName, {
		// httpOnly: true,
		// sameSite: 'lax',
		maxAge: 0,
		path: '/'
	})
}

// Gera um ID para o usuário
export function generateUserId() {
	// ID com 120 bits, ou aproximadamente o mesmo que o UUID v4.
	const bytes = crypto.getRandomValues(new Uint8Array(15))
	const id = encodeBase32LowerCase(bytes)
	return id
}

// Valida o e-mail
export function validateEmail(email: unknown): email is string {
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
export function validatePassword(password: unknown): password is string {
	// 1. Verifica se é uma string
	if (typeof password !== 'string') return false

	// 2. Verifica o comprimento (mínimo 6, máximo 120)
	if (password.length < 6 || password.length > 120) return false

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
export function validateName(name: unknown): name is string {
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

// Gera o código de verificação OTP para enviar por e-mail e salva-o no banco de dados
export async function generateEmailVerificationCode(email: string): Promise<string | null> {
	// Se o e-mail for inválido retorna null
	if (!validateEmail(email)) return null

	// Busca o usuário no banco de dados pelo e-mail
	const user = await db
		.select({ id: table.user.id }) // Só busca o campo necessário
		.from(table.user)
		.where(eq(table.user.email, email.toLowerCase().trim()))
		.then((results) => results.at(0))

	// Se usuário não for encontrado retorna null
	if (!user?.id) return null

	// Retorna o ID do usuário
	const userId = user.id

	// ID com 120 bits, ou aproximadamente o mesmo que o UUID v4.
	const id = encodeBase32LowerCase(crypto.getRandomValues(new Uint8Array(15)))

	// Sequência aletória
	const random: RandomReader = {
		read(bytes) {
			crypto.getRandomValues(bytes)
		}
	}

	// Caracteres permitidos
	const alphabet = '0123456789'

	// Número de caracteres
	const numberCharacters = 8

	// Gera um código aleatório utilizando caracteres permitidos e comprimento fixo de 8 caracteres
	const code = generateRandomString(random, alphabet, numberCharacters)

	// Remove códigos anteriores do mesmo usuário
	await db.delete(table.emailVerificationCode).where(eq(table.emailVerificationCode.userId, userId))

	// Insere o novo código no banco de dados, que expira em 10 minutos
	await db.insert(table.emailVerificationCode).values({
		id,
		code,
		email,
		userId,
		expiresAt: new Date(Date.now() + MINUTE_IN_MS * 10)
	})

	// Retorna o código OTP
	return code
}

// Envia o código de verificação OTP para o e-mail do usuário
export async function sendEmailVerificationCode({ email, type, code }: { email: string; type: string; code: string }): Promise<{
	success?: boolean
	error?: { code: string; message: string }
}> {
	// Se o e-mail for inválido retorna null
	if (!validateEmail(email)) return { error: { code: 'INVALID_EMAIL', message: 'E-mail inválido' } }

	// Enviar e-mail com o código OTP
	// Retorna um objeto: { success: boolean, error?: { code, message } }
	return await sendEmail({
		to: email,
		subject: 'Código de verificação',
		text: `Utilize o seguinte código de verificação ${type === 'sign-in' ? 'para fazer login' : type === 'email-verification' ? 'para verificar seu e-mail' : type === 'forget-password' ? 'para recuperar sua senha' : 'a seguir'}: ${code}`
	})
}

// Verifica se o código de verificação OTP enviado para o usuário é válido e se não expirou
export async function verifyVerificationCode({ email, code }: { email: string; code: string }): Promise<{
	success?: boolean
	error?: { code: string; message: string }
}> {
	// Verifica se o e-mail é válido
	if (!validateEmail(email)) return { error: { code: 'INVALID_EMAIL', message: 'E-mail inválido' } }

	// Busca todos os códigos associados ao e-mail
	const codes = await db
		.select({
			code: table.emailVerificationCode.code,
			expiresAt: table.emailVerificationCode.expiresAt
		})
		.from(table.emailVerificationCode)
		.where(eq(table.emailVerificationCode.email, email))

	// Se não houver nenhum código para o e-mail
	if (!codes || codes.length === 0) {
		return { error: { code: 'NO_CODES_FOUND', message: 'Nenhum código de verificação encontrado para este e-mail.' } }
	}

	// Procura o código específico informado
	const foundCode = codes.find((entry) => entry.code === code)
	if (!foundCode) {
		return { error: { code: 'CODE_NOT_FOUND', message: 'Código de verificação inválido ou incorreto.' } }
	}

	// Verifica se o código está expirado
	const now = new Date()
	if (foundCode.expiresAt && new Date(foundCode.expiresAt) < now) {
		return { error: { code: 'CODE_EXPIRED', message: 'O código de verificação expirou.' } }
	}

	// Código válido
	return { success: true }
}
