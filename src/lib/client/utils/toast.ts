import { writable } from 'svelte/store'

// Definindo os tipos possíveis para os diferentes tipos de toast (aviso)
export type ToastType = 'info' | 'success' | 'error' | 'warning'

// Definindo os tipos de posições possíveis para os toasts
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'

// Definindo a interface `ToastItem` para o objeto de toast. Ele inclui:
// - id: identificação única do toast (gerada localmente)
// - message: a mensagem a ser exibida no toast
// - icon: um ícone opcional que pode ser exibido junto à mensagem
// - type: o tipo de toast (success, error, info, warning)
// - duration: duração em milissegundos que o toast permanecerá visível (opcional, padrão 5000ms)
export interface ToastItem {
	id: string
	title: string
	description?: string
	icon?: string
	type: ToastType
	duration?: number
	position?: ToastPosition
}

// Criando uma store reativa chamada `toasts` que manterá uma lista de todos os toasts ativos
// Inicialmente, a lista começa vazia, mas será atualizada à medida que toasts forem criados
export const toasts = writable<ToastItem[]>([])

// Função `toast` que será usada para criar novos toasts.
// Ela recebe um objeto com as propriedades do toast:
// - message: mensagem que será exibida
// - icon (opcional): o ícone que aparecerá no toast
// - type (opcional): o tipo do toast (info, success, error, warning), com "info" sendo o padrão
// - duration (opcional): a duração que o toast ficará visível. O padrão é 5000ms (5 segundos)
export function toast({ title, description = '', icon = '', type = 'info', duration = 5000, position = 'bottom-right' }: Omit<ToastItem, 'id'>) {
	// Gerando um ID único para o toast usando `Date.now()` e um valor aleatório
	const id = `${Date.now()}-${Math.floor(Math.random() * 1000)}`

	// Atualizando a store `toasts` para adicionar o novo toast
	// A store `toasts` é uma lista de objetos `ToastItem`, então estamos adicionando o novo toast à lista
	toasts.update((all) => [
		...all, // Mantendo os toasts existentes
		{ id, title, description, icon, type, duration, position } // Adicionando o novo toast com o ID gerado
	])

	// Se uma duração for especificada (caso contrário, o valor padrão de 5000ms será usado),
	// configuramos um `setTimeout` para remover o toast da lista após o tempo determinado.
	if (duration) {
		setTimeout(() => {
			// Após o tempo da duração, a função é executada e o toast é removido da lista.
			// Atualizando a store para remover o toast com o ID correspondente.
			toasts.update((all) => all.filter((t) => t.id !== id))
		}, duration)
	}
}
