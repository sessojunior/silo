/**
 * Classe utilitária para estilização consistente de markdown com Tailwind v4
 */
export const markdownStyles = {
	// Para textos em geral (tamanho normal)
	base: 'text-base [&>*]:my-2 [&>h1]:text-2xl [&>h1]:font-bold [&>h2]:text-xl [&>h2]:font-semibold [&>h3]:text-lg [&>h3]:font-medium [&>h4]:text-base [&>h4]:font-medium [&>p]:leading-relaxed [&>ul]:pl-5 [&>ul]:list-disc [&>ol]:pl-4 [&>ol]:list-decimal [&>blockquote]:border-l-4 [&>blockquote]:border-zinc-300 [&>blockquote]:pl-4 [&>blockquote]:italic [&>pre]:bg-zinc-100 [&>pre]:p-3 [&>pre]:rounded [&>code]:bg-zinc-100 [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>code]:text-xs dark:[&>blockquote]:border-zinc-700 dark:[&>pre]:bg-zinc-800 dark:[&>code]:bg-zinc-800',

	// Para textos compactos (soluções, respostas)
	compact: 'text-sm [&>*]:my-1 [&>h1]:text-base [&>h1]:font-bold [&>h2]:text-sm [&>h2]:font-semibold [&>h3]:text-sm [&>h3]:font-medium [&>p]:leading-relaxed [&>ul]:pl-5 [&>ul]:list-disc [&>ol]:pl-4 [&>ol]:list-decimal [&>blockquote]:border-l-2 [&>blockquote]:border-zinc-300 [&>blockquote]:pl-3 [&>blockquote]:italic [&>pre]:bg-zinc-100 [&>pre]:p-2 [&>pre]:rounded [&>code]:bg-zinc-100 [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>code]:text-xs dark:[&>blockquote]:border-zinc-700 dark:[&>pre]:bg-zinc-800 dark:[&>code]:bg-zinc-800',
}

/**
 * Função para aplicar estilos de markdown com cores específicas
 */
export function getMarkdownClasses(variant: keyof typeof markdownStyles, textColor?: string) {
	const baseClasses = markdownStyles[variant]
	const color = textColor || 'text-zinc-700 dark:text-zinc-200'
	return `${baseClasses} ${color}`
}
