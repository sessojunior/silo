// Função para alternar entre tema claro e escuro manualmente ou forçar um tema
export function toggleTheme(theme?: 'light' | 'dark') {
	if (typeof window === 'undefined') return

	const root = document.documentElement

	let newTheme: 'light' | 'dark'
	const currentTheme = root.classList.contains('dark') ? 'dark' : 'light'

	if (theme === 'light' || theme === 'dark') {
		newTheme = theme
	} else {
		newTheme = currentTheme === 'dark' ? 'light' : 'dark'
	}

	if (newTheme === 'dark') {
		root.classList.add('dark')
		localStorage.setItem('theme', 'dark')
	} else {
		root.classList.remove('dark')
		localStorage.setItem('theme', 'light')
	}
}

// Função opcional para aplicar o tema salvo (chamada uma vez no carregamento)
export function applySavedTheme() {
	if (typeof window === 'undefined') return

	const savedTheme = localStorage.getItem('theme')
	const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

	if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
		document.documentElement.classList.add('dark')
	} else {
		document.documentElement.classList.remove('dark')
	}
}
