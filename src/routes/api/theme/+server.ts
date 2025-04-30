import { json } from '@sveltejs/kit'
import * as profile from '$lib/server/profile'

export async function POST({ request, locals }) {
	// Verifica se o usuário está autenticado
	if (!locals.user) {
		return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
	}

	// Obtém o tema enviado
	const formData = new URLSearchParams(await request.text())
	const theme = formData.get('theme')

	if (!theme) {
		return new Response(JSON.stringify({ error: 'Tema inválido' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
	}

	// Atualiza o tema no banco de dados
	const result = await profile.updateUserTheme(locals.user.id, theme)
	if ('error' in result) {
		return json({ type: 'success', theme })
	}

	return new Response(JSON.stringify({ error: 'Erro ao salvar o tema' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
}
