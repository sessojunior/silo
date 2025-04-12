import { redirect, type RequestEvent } from '@sveltejs/kit'
import { google } from '$lib/server/oauth'
import * as arctic from 'arctic'

// Cria a URL de autorização do Google
// Inicia o fluxo de autenticação OAuth 2.0 com PKCE usando o Google como provedor.
// - Gera os parâmetros de segurança (state, code_verifier) e armazena-os em cookies seguros e temporários
// - Redireciona o usuário para login com o Google
export async function GET(event: RequestEvent): Promise<Response> {
	// 1. Gera um valor aleatório para "state" (proteção contra CSRF)
	// Este valor será enviado para o Google e verificado no callback
	const state = arctic.generateState()

	// 2. Gera um "code_verifier", parte do mecanismo PKCE (Proof Key for Code Exchange)
	// Isso previne ataques de interceptação e reforça a segurança da troca de tokens
	const codeVerifier = arctic.generateCodeVerifier()

	// 3. Especifica os escopos solicitados ao Google
	const scopes = [
		'openid', // Para login em um site/app usando a conta do Google
		'profile', // Para obter nome e foto
		'email' // Para obter o e-mail principal da conta Google
	]

	// 4. Cria a URL de autorização do Google OAuth 2.0 com os parâmetros apropriados
	const url = google.createAuthorizationURL(state, codeVerifier, scopes)

	// 5. Armazena o 'state' gerado como cookie seguro e HTTP-only (não acessível via JS no navegador)
	// Este valor será verificado no callback para evitar requisições forjadas
	// Utilize sempre sameSite = 'lax', pois o 'strict' nunca envia o cookie em requisições vindas de outros domínios
	event.cookies.set('google_oauth_state', state, {
		path: '/', // Cookie válido em todo o site
		httpOnly: true, // Impede acesso via JS (protege contra XSS)
		maxAge: 60 * 10, // Expira em 10 minutos
		sameSite: 'lax' // Evita o envio automático em requisições cross-site não essenciais
	})

	// 6. Armazena o 'code_verifier' também como cookie seguro
	// Isso será usado no callback para trocar o código por um token de acesso
	// Utilize sempre sameSite = 'lax', pois o 'strict' nunca envia o cookie em requisições vindas de outros domínios
	event.cookies.set('google_code_verifier', codeVerifier, {
		path: '/',
		httpOnly: true,
		maxAge: 60 * 10,
		sameSite: 'lax'
	})

	// 7. Redireciona o usuário para a URL de autenticação do Google
	// Esse redirecionamento inicia efetivamente o login com OAuth
	throw redirect(302, url.toString())
}
