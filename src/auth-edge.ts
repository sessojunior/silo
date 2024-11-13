import { getToken } from "next-auth/jwt"
import type { NextRequest } from "next/server"

// Função de autenticação mínima para validar tokens no Edge Runtime
export async function auth(req: NextRequest) {
	// O getToken é compatível com o Edge Runtime e permite verificar tokens de sessão armazenados como cookies.
	const token = await getToken({
		req,
		secret: process.env.NEXTAUTH_SECRET, // O segredo para JWT
	})

	return token // Retorna o token decodificado ou null se inválido
}
