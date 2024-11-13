import { auth } from "@/auth-edge" // Configuração mínima para Edge Runtime
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Middleware para proteger rotas específicas.
 */
export async function middleware(req: NextRequest) {
	console.log("Middleware executado para:", req.nextUrl.pathname)

	// Exibe os cookies disponíveis
	const cookies = req.cookies
	console.log("Cookies recebidos:", cookies)

	const token = await auth(req) // Valida o token de sessão no Edge Runtime

	if (!token) {
		// Redireciona para a página de login se a sessão for inválida
		console.log("Token inválido ou ausente. Redirecionando para /login")
		return NextResponse.redirect(new URL("/login", req.url))
	}

	console.log("Token válido. Acesso permitido.")
	return NextResponse.next() // Permite o acesso se a sessão for válida
}

export const config = {
	matcher: ["/admin/:path*"], // Protege todas as rotas em /admin
}
