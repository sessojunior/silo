'use client'

import { useEffect, useState } from 'react'
import MDEditor, { commands } from '@uiw/react-md-editor'

interface MarkdownProps {
	value: string
	onChange: (value: string) => void
	preview?: 'edit' | 'live' | 'preview'
	className?: string
	'data-color-mode'?: 'light' | 'dark'
	height?: string | number // Nova prop para controlar altura
	compact?: boolean // Nova prop para barra de ferramentas compacta
}

export default function Markdown({ value, onChange, preview = 'edit', className = '', 'data-color-mode': colorMode, compact = false, ...props }: MarkdownProps) {
	const [theme, setTheme] = useState<'light' | 'dark'>('light')

	useEffect(() => {
		// Detecta o tema atual
		const isDark = document.documentElement.classList.contains('dark')
		setTheme(isDark ? 'dark' : 'light')

		// Observer para mudanças de tema
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				if (mutation.attributeName === 'class') {
					const isDark = document.documentElement.classList.contains('dark')
					setTheme(isDark ? 'dark' : 'light')
				}
			})
		})

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class'],
		})

		return () => observer.disconnect()
	}, [])

	// Force remove inline styles para ocupar altura máxima
	useEffect(() => {
		const removeInlineHeights = () => {
			const editor = document.querySelector('.md-editor-custom .w-md-editor')
			if (editor) {
				// Remove altura fixa de todos os elementos filhos
				const elementsWithHeight = editor.querySelectorAll('*[style*="height"]')
				elementsWithHeight.forEach((el) => {
					const element = el as HTMLElement
					if (element.style.height && element.style.height !== 'auto' && element.style.height !== '100%') {
						element.style.height = 'auto'
					}
				})

				// Força estrutura flexível nos containers principais
				const containers = editor.querySelectorAll('.w-md-editor-content, .w-md-editor-text, .w-md-editor-preview, .w-md-editor-text-container')
				containers.forEach((container) => {
					const element = container as HTMLElement
					element.style.display = 'flex'
					element.style.flexDirection = 'column'
					element.style.flex = '1'
					element.style.minHeight = '0'
					element.style.height = 'auto'
				})
			}
		}

		// Execute imediatamente e depois a cada 100ms por 2 segundos para garantir
		removeInlineHeights()
		const interval = setInterval(removeInlineHeights, 100)
		const timeout = setTimeout(() => clearInterval(interval), 2000)

		return () => {
			clearInterval(interval)
			clearTimeout(timeout)
		}
	}, [value]) // Re-executa quando o valor muda

	// CSS Styles inline
	const styles = `
		/* MD Editor customizations - altura máxima (flex-1) */
		.md-editor-custom {
			height: 100% !important;
			flex: 1 !important;
			display: flex !important;
			flex-direction: column !important;
			min-height: 400px !important;
		}

		.md-editor-custom .w-md-editor {
			border-color: ${theme === 'dark' ? 'rgb(63 63 70)' : 'rgb(228 228 231)'};
			height: 100% !important;
			flex: 1 !important;
			display: flex !important;
			flex-direction: column !important;
			position: relative !important;
		}

		/* Container principal */
		.md-editor-custom .w-md-editor-content {
			flex: 1 !important;
			height: auto !important;
			display: flex !important;
			flex-direction: column !important;
			min-height: 0 !important;
			overflow: hidden !important;
		}

		/* Áreas de edição e preview */
		.md-editor-custom .w-md-editor-text,
		.md-editor-custom .w-md-editor-preview {
			flex: 1 !important;
			height: auto !important;
			min-height: 0 !important;
			overflow-y: auto !important;
			display: flex !important;
			flex-direction: column !important;
		}

		/* Container de texto */
		.md-editor-custom .w-md-editor-text-container {
			height: auto !important;
			flex: 1 !important;
			display: flex !important;
			flex-direction: column !important;
			min-height: 0 !important;
		}

		/* Textarea - altura máxima */
		.md-editor-custom .w-md-editor-text-input,
		.md-editor-custom .w-md-editor-text-textarea {
			height: 100% !important;
			flex: 1 !important;
			resize: none !important;
			border: none !important;
		}

		/* Preview */
		.md-editor-custom .w-md-editor-preview {
			flex: 1 !important;
			overflow-y: auto !important;
		}

		/* Remove altura fixa para ocupar espaço máximo */
		.md-editor-custom .w-md-editor *[style*="height"] { 
			height: auto !important; 
		}

		/* Força containers internos para flex */
		.md-editor-custom .w-md-editor > div { 
			display: flex !important; 
			flex-direction: column !important; 
			height: 100% !important; 
		}

		/* Toolbar styling */
		.md-editor-custom .w-md-editor-toolbar {
			border-bottom-color: ${theme === 'dark' ? 'rgb(63 63 70)' : 'rgb(228 228 231)'};
			background-color: ${theme === 'dark' ? 'rgb(39 39 42)' : 'rgb(249 250 251)'};
		}

		.md-editor-custom .w-md-editor-toolbar ul {
			display: flex;
			align-items: center;
		}

		.md-editor-custom .w-md-editor-toolbar-divider {
			background-color: ${theme === 'dark' ? 'rgb(82 82 91)' : 'rgb(228 228 231)'};
			align-self: center;
		}

		/* Dividers dos grupos de botões */
		.md-editor-custom .w-md-editor-toolbar ul li.w-md-editor-toolbar-divider {
			background-color: ${theme === 'dark' ? 'rgb(82 82 91)' : 'rgb(228 228 231)'};
			align-self: center;
			margin: 0 4px;
			height: 20px;
			width: 1px;
			display: flex;
			align-items: center;
			justify-content: center;
		}

		.md-editor-custom .w-md-editor-toolbar ul li .w-md-editor-toolbar-divider {
			background-color: ${theme === 'dark' ? 'rgb(82 82 91)' : 'rgb(228 228 231)'};
			align-self: center;
			margin: 0 4px;
			height: 16px;
			width: 2px;
			display: block;
			vertical-align: middle;
		}

		/* Botões da toolbar - aumentados e centralizados */
		.md-editor-custom .w-md-editor-toolbar ul li button,
		.md-editor-custom .w-md-editor-toolbar ul li .w-md-editor-toolbar-item {
			height: 40px;
			width: 40px;
			font-size: 16px;
			display: flex;
			align-items: center;
			justify-content: center;
			background: transparent;
			border: 0;
			border-radius: 8px;
			color: ${theme === 'dark' ? 'rgb(212 212 216)' : 'rgb(63 63 70)'};
		}

		.md-editor-custom .w-md-editor-toolbar ul li button:hover,
		.md-editor-custom .w-md-editor-toolbar ul li .w-md-editor-toolbar-item:hover {
			background-color: ${theme === 'dark' ? 'rgb(63 63 70)' : 'rgb(228 228 231)'};
			color: ${theme === 'dark' ? 'rgb(244 244 245)' : 'rgb(24 24 27)'};
		}

		.md-editor-custom .w-md-editor-toolbar ul li button svg {
			height: 20px;
			width: 20px;
		}

		/* Botão ativo */
		.md-editor-custom .w-md-editor-toolbar ul li button.active {
			background-color: ${theme === 'dark' ? 'rgb(63 63 70)' : 'rgb(228 228 231)'};
			color: ${theme === 'dark' ? 'rgb(244 244 245)' : 'rgb(24 24 27)'};
			border-radius: 8px;
		}

		/* Editor de texto - Background separado do texto */
		.md-editor-custom .w-md-editor-text-input,
		.md-editor-custom .w-md-editor-text-textarea,
		.md-editor-custom .w-md-editor-text {
			border-color: ${theme === 'dark' ? 'rgb(63 63 70)' : 'rgb(228 228 231)'};
			background-color: transparent;
		}

		/* Cor do texto específica para textarea */
		.md-editor-custom .w-md-editor-text-input {
			color: ${theme === 'dark' ? 'rgb(244 244 245)' : 'rgb(24 24 27)'} !important;
		}

		/* Preview do markdown - usando os mesmos estilos da base de conhecimento */
		.md-editor-custom .w-md-editor-preview {
			background-color: ${theme === 'dark' ? 'rgb(24 24 27)' : '#ffffff'};
			color: ${theme === 'dark' ? 'rgb(228 228 231)' : 'rgb(63 63 70)'};
			border-color: ${theme === 'dark' ? 'rgb(63 63 70)' : 'rgb(228 228 231)'};
		}

		/* Área do preview markdown - aplicando estilos consistentes com a base de conhecimento */
		.md-editor-custom .w-md-editor-preview .wmde-markdown {
			background-color: ${theme === 'dark' ? 'rgb(24 24 27)' : '#ffffff'};
			color: ${theme === 'dark' ? 'rgb(228 228 231)' : 'rgb(63 63 70)'};
			font-size: 14px;
		}

		/* Elementos de markdown com espaçamento consistente */
		.md-editor-custom .w-md-editor-preview .wmde-markdown > * {
			margin-bottom: 12px;
		}

		/* Títulos seguindo a hierarquia da base de conhecimento */
		.md-editor-custom .w-md-editor-preview .wmde-markdown h1 {
			font-size: 18px;
			font-weight: 700;
			color: ${theme === 'dark' ? 'rgb(228 228 231)' : 'rgb(63 63 70)'};
			border-bottom: none;
			padding-bottom: 0;
		}

		.md-editor-custom .w-md-editor-preview .wmde-markdown h2 {
			font-size: 16px;
			font-weight: 600;
			color: ${theme === 'dark' ? 'rgb(228 228 231)' : 'rgb(63 63 70)'};
			border-bottom: none;
			padding-bottom: 0;
		}

		.md-editor-custom .w-md-editor-preview .wmde-markdown h3 {
			font-size: 14px;
			font-weight: 500;
			color: ${theme === 'dark' ? 'rgb(228 228 231)' : 'rgb(63 63 70)'};
			border-bottom: none;
			padding-bottom: 0;
		}

		.md-editor-custom .w-md-editor-preview .wmde-markdown h4,
		.md-editor-custom .w-md-editor-preview .wmde-markdown h5,
		.md-editor-custom .w-md-editor-preview .wmde-markdown h6 {
			font-size: 14px;
			font-weight: 500;
			color: ${theme === 'dark' ? 'rgb(228 228 231)' : 'rgb(63 63 70)'};
			border-bottom: none;
			padding-bottom: 0;
		}

		/* Parágrafos */
		.md-editor-custom .w-md-editor-preview .wmde-markdown p {
			line-height: 1.625;
			color: ${theme === 'dark' ? 'rgb(228 228 231)' : 'rgb(63 63 70)'};
		}

		/* Listas */
		.md-editor-custom .w-md-editor-preview .wmde-markdown ul {
			padding-left: 16px;
			list-style-type: disc;
		}

		.md-editor-custom .w-md-editor-preview .wmde-markdown ol {
			padding-left: 16px;
			list-style-type: decimal;
		}

		/* Links */
		.md-editor-custom .w-md-editor-preview .wmde-markdown a {
			color: ${theme === 'dark' ? 'rgb(96 165 250)' : 'rgb(37 99 235)'};
		}

		/* Citações */
		.md-editor-custom .w-md-editor-preview .wmde-markdown blockquote {
			border-left: 4px solid ${theme === 'dark' ? 'rgb(63 63 70)' : 'rgb(212 212 216)'};
			padding-left: 16px;
			font-style: italic;
			color: ${theme === 'dark' ? 'rgb(228 228 231)' : 'rgb(63 63 70)'};
		}

		/* Código inline */
		.md-editor-custom .w-md-editor-preview .wmde-markdown code {
			background-color: ${theme === 'dark' ? 'rgb(39 39 42)' : 'rgb(244 244 245)'};
			padding: 2px 4px;
			border-radius: 4px;
			font-size: 12px;
			color: ${theme === 'dark' ? 'rgb(228 228 231)' : 'rgb(63 63 70)'};
		}

		/* Blocos de código */
		.md-editor-custom .w-md-editor-preview .wmde-markdown pre {
			background-color: ${theme === 'dark' ? 'rgb(39 39 42)' : 'rgb(244 244 245)'};
			padding: 12px;
			border-radius: 6px;
		}

		.md-editor-custom .w-md-editor-preview .wmde-markdown pre code {
			background: transparent;
			color: ${theme === 'dark' ? 'rgb(228 228 231)' : 'rgb(63 63 70)'};
		}

		/* Tabelas */
		.md-editor-custom .w-md-editor-preview .wmde-markdown table {
			border-color: ${theme === 'dark' ? 'rgb(63 63 70)' : 'rgb(228 228 231)'};
		}

		.md-editor-custom .w-md-editor-preview .wmde-markdown th,
		.md-editor-custom .w-md-editor-preview .wmde-markdown td {
			border-color: ${theme === 'dark' ? 'rgb(63 63 70)' : 'rgb(228 228 231)'};
		}

		.md-editor-custom .w-md-editor-preview .wmde-markdown th {
			background-color: ${theme === 'dark' ? 'rgb(39 39 42)' : 'rgb(249 250 251)'};
		}
	`

	// Configuração da barra de ferramentas compacta
	const compactCommands = compact ? [commands.bold, commands.italic, commands.strikethrough, commands.divider, commands.unorderedListCommand, commands.orderedListCommand, commands.divider, commands.link, commands.code] : undefined

	return (
		<>
			{/* Inject styles */}
			<style dangerouslySetInnerHTML={{ __html: styles }} />

			{/* MDEditor component */}
			<MDEditor value={value} onChange={(val) => onChange(val || '')} preview={preview} className={`md-editor-custom ${className}`} data-color-mode={colorMode || theme} {...(compact && { commands: compactCommands })} {...props} />
		</>
	)
}
