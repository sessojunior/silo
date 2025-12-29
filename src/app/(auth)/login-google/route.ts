import { NextResponse } from 'next/server'
import { generateState, generateCodeVerifier } from 'arctic'
import { google } from '@/lib/auth/oauth'

// Faz login com o Google OAuth 2.0
// 1. Gera os parâmetros de segurança ('state', 'code_verifier') e armazena-os em cookies seguros e temporários
// 2. Redireciona o usuário para login com o Google
export async function GET() {
	// 1. Gera um valor aleatório para 'state' (proteção contra CSRF)
	// Este valor será enviado para o Google e verificado no callback
	const state = generateState()

	// 2. Gera um 'code_verifier', parte do mecanismo PKCE (Proof Key for Code Exchange)
	// Isso previne ataques de interceptação e reforça a segurança da troca de tokens
	const codeVerifier = generateCodeVerifier()

	// 3. Especifica os escopos solicitados ao Google
	const scopes = [
		'openid', // Para login em um site/app usando a conta do Google
		'profile', // Para obter nome e foto
		'email', // Para obter o e-mail principal da conta Google
	]

	// 4. Cria a URL de autorização do Google OAuth 2.0 com os parâmetros apropriados
	const url = google.createAuthorizationURL(state, codeVerifier, scopes)

	// 5. Redireciona depois o usuário para a URL de autorização
	const res = NextResponse.redirect(url.toString(), 302)

	// 6. Armazena o 'state' gerado como cookie seguro e HTTP-only (não acessível via JS no navegador)
	// Este valor será verificado no callback para evitar requisições forjadas
	// Utilize sempre sameSite = 'lax', pois o 'strict' nunca envia o cookie em requisições vindas de outros domínios
	res.cookies.set('google_oauth_state', state, {
		httpOnly: true, // Impede acesso via JS (protege contra XSS)
		path: '/', // Cookie válido em todo o site
		maxAge: 60 * 10, // Expira em 10 minutos
		sameSite: 'lax', // Evita o envio automático em requisições cross-site não essenciais
	})

	// 7. Armazena o 'code_verifier' também como cookie seguro
	// Isso será usado no callback para trocar o código por um token de acesso
	// Utilize sempre sameSite = 'lax', pois o 'strict' nunca envia o cookie em requisições vindas de outros domínios
	res.cookies.set('google_code_verifier', codeVerifier, {
		httpOnly: true,
		path: '/',
		maxAge: 60 * 10,
		sameSite: 'lax',
	})

	// Redireciona o usuário para a URL de autenticação do Google
	// Isso iniciara o fluxo de autenticação OAuth 2.0 com o Google
	return res
}
