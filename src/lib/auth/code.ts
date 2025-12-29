import { randomUUID } from 'crypto'
import { eq, and, gt, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { authCode, authUser } from '@/lib/db/schema'
import { isValidEmail } from '@/lib/auth/validate'
import { sendEmail } from '@/lib/sendEmail'
import { destroyAllSession } from '@/lib/auth/session'
import { isRateLimited, recordRateLimit } from '@/lib/rateLimit'

// Funções de geração de código OTP e envio de e-mail com o código OTP

// Gera o código de verificação OTP para enviá-lo por e-mail e salva-o no banco de dados
export async function generateCode(email: string): Promise<{ success: boolean; code: string } | { error: { code: string; message: string } }> {
	// Formata os dados recebidos
	const formatEmail = email.trim().toLowerCase()

	// Verifica se o e-mail é invalido
	if (!isValidEmail(formatEmail)) return { error: { code: 'INVALID_EMAIL', message: 'E-mail inválido.' } }

	// Verifica se o usuário existe no banco de dados pelo e-mail
	const user = await db
		.select()
		.from(authUser)
		.where(eq(authUser.email, formatEmail))
		.limit(1)
		.then((results) => results.at(0))

	// Se o usuário não for encontrado
	if (!user?.id) return { error: { code: 'NO_EMAIL_FOUND', message: 'Não existe um usuário com este e-mail.' } }

	// Gera um ID baseado em UUID v4 (128 bits, padrão universal)
	const codeId = randomUUID()

	// Função auxiliar que gera um código alfanumérico com caracteres legíveis para evitar ambiguidades (ex: '347AEFHJKMNPRTWY')
	// allowedCharacters: Caracteres permitidos e legíveis em todas as tipografias, para evitar ambiguidades (exemplo: '347AEFHJKMNPRTWY')
	// numberCharacters: Número de caracteres que serão gerados (exemplo: 5)
	const randomCode = ({ allowedCharacters, numberCharacters }: { allowedCharacters: string; numberCharacters: number }): string => {
		const chars = allowedCharacters
		const charsLen = chars.length

		// Gera bytes aleatórios usando a Web Crypto API
		const array = new Uint8Array(numberCharacters)
		const random = crypto.getRandomValues(array)

		let code = ''

		for (let i = 0; i < numberCharacters; i++) {
			const index = random[i] % charsLen
			code += chars[index]
		}

		return code
	}

	// Gera um código aleatório utilizando caracteres legíveis em todas as tipografias, para evitar ambiguidades e número de caracteres que serão gerados
	// A probabilidade de acertar aleatoriamente este código é de 1 em 1.048.576 (cerca de 1 em 1 milhão)
	const code = randomCode({ allowedCharacters: '347AEFHJKMNPRTWY', numberCharacters: 5 })

	// Remove códigos anteriores do mesmo usuário
	await db.delete(authCode).where(eq(authCode.userId, user.id))

	// Um minuto em milissegundos
	const MINUTE_IN_MS = 60 * 1000 // 60000 ms (1 minuto)

	// Tempo de expiração do código, expira em 10 minutos
	const expiresAt = new Date(Date.now() + MINUTE_IN_MS * 10)

	// Insere o novo código no banco de dados
	const [insertCode] = await db
		.insert(authCode)
		.values({
			id: codeId,
			code,
			email,
			userId: user.id,
			expiresAt,
		})
		.returning()
	if (!insertCode) return { error: { code: 'INSERT_CODE_ERROR', message: 'Erro ao salvar a código no banco de dados.' } }

	// Retorna o código OTP
	return { success: true, code }
}

// Verifica se o código de verificação OTP enviado para o usuário é válido e se não expirou
// 1. Se o código for válido, define o e-mail do usuário como verificado (1) na tabela 'auth_user' do banco de dados
// 2. Apaga do banco de dados todos os códigos expirados
export async function validateCode({ email, code }: { email: string; code: string }): Promise<{ success: boolean } | { error: { code: string; message: string } }> {
	// Formata os dados recebidos
	const formatEmail = email.trim().toLowerCase()

	// Verifica se o e-mail é invalido
	if (!isValidEmail(formatEmail)) return { error: { code: 'INVALID_EMAIL', message: 'E-mail inválido.' } }

	// Procura o código OTP válido no banco
	const otpCode = await db.query.authCode.findFirst({
		where: and(eq(authCode.email, email), eq(authCode.code, code), gt(authCode.expiresAt, new Date())),
	})

	// Apaga do banco de dados todos os códigos expirados
	await db.delete(authCode).where(lt(authCode.expiresAt, new Date()))

	// Se não encontrou o código ou ele expirou
	if (!otpCode) {
		return { error: { code: 'WRONG_OR_EXPIRED_CODE', message: 'O código é inválido ou expirou.' } }
	}

	// Se encontrou o código, e ele não está expirado, apaga todos os códigos do usuário (limpeza)
	// Apagar os códigos evita que sejam utilizado novamente após o e-mail ser verificado
	await db.delete(authCode).where(eq(authCode.email, formatEmail))

	// Define o e-mail do usuário como verificado (1) na tabela 'authUser' do banco de dados
	await db.update(authUser).set({ emailVerified: true }).where(eq(authUser.email, formatEmail))

	// Por seguranca, todas as sessões devem ser invalidadas após o e-mail ser verificado
	// Será criado depois uma nova sessão para o usuário
	await destroyAllSession(otpCode.userId)

	// Código válido
	return { success: true }
}

// Gera código OTP para alteração de email (não verifica se usuário existe)
export async function generateEmailChangeCode(email: string, userId: string): Promise<{ success: boolean; code: string; requestId: string } | { error: { code: string; message: string } }> {
	// Formata os dados recebidos
	const formatEmail = email.trim().toLowerCase()

	// Verifica se o e-mail é inválido
	if (!isValidEmail(formatEmail)) return { error: { code: 'INVALID_EMAIL', message: 'E-mail inválido.' } }

	// Gera um ID baseado em UUID v4 (128 bits, padrão universal)
	const codeId = randomUUID()

	// Função auxiliar que gera um código alfanumérico com caracteres legíveis para evitar ambiguidades
	const randomCode = ({ allowedCharacters, numberCharacters }: { allowedCharacters: string; numberCharacters: number }): string => {
		const chars = allowedCharacters
		const charsLen = chars.length

		// Gera bytes aleatórios usando a Web Crypto API
		const array = new Uint8Array(numberCharacters)
		const random = crypto.getRandomValues(array)

		let code = ''

		for (let i = 0; i < numberCharacters; i++) {
			const index = random[i] % charsLen
			code += chars[index]
		}

		return code
	}

	// Gera um código aleatório utilizando caracteres legíveis em todas as tipografias
	const code = randomCode({ allowedCharacters: '347AEFHJKMNPRTWY', numberCharacters: 5 })

	// Remove códigos anteriores do mesmo usuário para alteração de email
	await db.delete(authCode).where(eq(authCode.userId, userId))

	// Um minuto em milissegundos
	const MINUTE_IN_MS = 60 * 1000 // 60000 ms (1 minuto)

	// Tempo de expiração do código, expira em 10 minutos
	const expiresAt = new Date(Date.now() + MINUTE_IN_MS * 10)

	// Insere o novo código no banco de dados
	const [insertCode] = await db
		.insert(authCode)
		.values({
			id: codeId,
			code,
			email,
			userId,
			expiresAt,
		})
		.returning()
	if (!insertCode) return { error: { code: 'INSERT_CODE_ERROR', message: 'Erro ao salvar o código no banco de dados.' } }

	// Retorna o código OTP e o ID da requisição
	return { success: true, code, requestId: codeId }
}

// Gera código OTP para definição inicial de senha (não verifica se usuário existe)
export async function generatePasswordSetupCode(
	email: string,
	userId: string,
): Promise<{ success: boolean; code: string; requestId: string } | { error: { code: string; message: string } }> {
	// Formata os dados recebidos
	const formatEmail = email.trim().toLowerCase()

	// Verifica se o e-mail é inválido
	if (!isValidEmail(formatEmail)) return { error: { code: 'INVALID_EMAIL', message: 'E-mail inválido.' } }

	// Gera um ID baseado em UUID v4 (128 bits, padrão universal)
	const codeId = randomUUID()

	// Função auxiliar que gera um código alfanumérico com caracteres legíveis para evitar ambiguidades
	const randomCode = ({ allowedCharacters, numberCharacters }: { allowedCharacters: string; numberCharacters: number }): string => {
		const chars = allowedCharacters
		const charsLen = chars.length

		// Gera bytes aleatórios usando a Web Crypto API
		const array = new Uint8Array(numberCharacters)
		const random = crypto.getRandomValues(array)

		let code = ''

		for (let i = 0; i < numberCharacters; i++) {
			const index = random[i] % charsLen
			code += chars[index]
		}

		return code
	}

	// Gera um código aleatório utilizando caracteres legíveis em todas as tipografias
	const code = randomCode({ allowedCharacters: '347AEFHJKMNPRTWY', numberCharacters: 5 })

	// Remove códigos anteriores de setup de senha para este usuário
	await db.delete(authCode).where(eq(authCode.userId, userId))

	// Um minuto em milissegundos
	const MINUTE_IN_MS = 60 * 1000 // 60000 ms (1 minuto)

	// Tempo de expiração do código: 30 minutos (mais tempo para setup de senha)
	const expiresAt = new Date(Date.now() + MINUTE_IN_MS * 30)

	// Insere o novo código no banco de dados
	const [insertCode] = await db
		.insert(authCode)
		.values({
			id: codeId,
			code,
			email: formatEmail,
			userId,
			expiresAt,
		})
		.returning()
	if (!insertCode) return { error: { code: 'INSERT_CODE_ERROR', message: 'Erro ao salvar o código no banco de dados.' } }

	// Retorna o código OTP e o ID da requisição
	return { success: true, code, requestId: codeId }
}

// Envia o código de verificação OTP para o e-mail do usuário
export async function sendEmailCode({ email, type, code, ip }: { email: string; type: string; code: string; ip: string }): Promise<{ success: boolean } | { error: { code: string; message: string } }> {
	// Formata os dados recebidos
	const formatEmail = email.trim().toLowerCase()

	// Verifica se o e-mail é invalido
	if (!isValidEmail(formatEmail)) return { error: { code: 'INVALID_EMAIL', message: 'E-mail inválido.' } }

	// Limitação de taxa de envio de e-mail

	// Aplica limitação: no máximo 3 envios por minuto por IP + email + tipo
	const blocked = await isRateLimited({ email: formatEmail, ip, route: type })
	if (blocked) return { error: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente em instantes.' } }

	// Registra esta tentativa no banco
	await recordRateLimit({ email: formatEmail, ip, route: type })

	// Envia o e-mail

	// Envia o e-mail com o código OTP usando template moderno
	// Retorna um objeto: { success: boolean, error?: { code, message } }
	return await sendEmail({
		to: email,
		subject: `Código de verificação: ${code}`,
		template: 'otpCode',
		data: {
			code,
			type: type as 'sign-in' | 'email-verification' | 'forget-password' | 'email-change' | 'setup-password',
		},
		text: `Utilize o seguinte código de verificação ${
			type === 'sign-in'
				? 'para fazer login'
				: type === 'email-verification'
					? 'para verificar seu e-mail'
					: type === 'forget-password'
						? 'para recuperar sua senha'
						: type === 'setup-password'
							? 'para definir sua senha inicial'
							: type === 'email-change'
								? 'para alterar seu e-mail'
								: 'a seguir'
		}: ${code}`, // Fallback
	})
}
