// Validação de entrada de dados do formulário de autenticação

// Valida o e-mail
export function isValidEmail(email: string): boolean {
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
export function isValidPassword(password: string): boolean {
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

// Valida o nome do usuário
export function isValidName(name: string): boolean {
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

// Valida o código OTP
export function isValidCode(code: string): boolean {
	// 1. Verifica se o valor é uma string
	if (typeof code !== 'string') return false

	// 2. Verifica se o código tem 5 caracteres
	if (code.length !== 5) return false

	// 3. Se passou por todas as verificações, o código é valido
	return true
}

// Valida se o e-mail pertence ao domínio @inpe.br
export function isValidDomain(email: string): boolean {
	// 1. Verifica se o valor é uma string
	if (typeof email !== 'string') return false

	// 2. Converte para lowercase para comparação case-insensitive
	const lowerEmail = email.toLowerCase().trim()

	// 3. Verifica se termina com @inpe.br
	return lowerEmail.endsWith('@inpe.br')
}
