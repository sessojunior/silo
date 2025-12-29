import { compare, hash } from 'bcryptjs'

// Hash e verificação de senha

// Usado para criar hashes (ex: no cadastro)
export async function hashPassword(password: string) {
	return await hash(password, 10)
}

// Verifica se a senha está correta (login)
export async function verifyPassword(password: string, hashed: string) {
	return await compare(password, hashed)
}
