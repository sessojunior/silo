import { themeStore } from '$lib/client/stores/theme'

// Função para alterar o tema com a API
export async function changeTheme(newTheme: string) {
	// Tema inicial
	let theme = 'light'

	try {
		// Envia o novo tema para a API
		const response = await fetch('/api/theme', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({ theme: newTheme })
		})

		// Verifica se a resposta foi bem-sucedida
		if (!response.ok) {
			throw new Error('Falha ao alterar o tema do usuário no servidor.')
		}

		// Obtém o resultado da API
		const result = await response.json()

		// console.log('Resposta do servidor:', result)

		// Verifica se a resposta contém o sucesso
		if (result.type === 'success') {
			// Atualiza o tema com a resposta
			theme = result.theme

			// Atualiza o tema no store para refletir a mudança no estado do cliente
			themeStore.set(theme)
		} else {
			console.error('Erro no servidor:', result.error)
		}
	} catch (error) {
		console.error('Erro ao enviar a solicitação:', error)
	}

	// Retorna o tema alterado ou o tema padrão
	return theme
}
