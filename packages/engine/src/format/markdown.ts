/**
 * Classe utilitária para estilização consistente de markdown com Tailwind v4
 *
 * Usa o plugin oficial @tailwindcss/typography (classe prose), que oferece
 * tipografia completa e consistente para conteúdo markdown renderizado.
 */
export const markdownStyles = {
  // Para textos em geral (tamanho normal)
  base: "prose prose-zinc max-w-none dark:prose-invert",

  // Para textos compactos (soluções, respostas)
  compact: "prose prose-sm prose-zinc max-w-none dark:prose-invert",
};

export function getMarkdownClasses(
  variant: keyof typeof markdownStyles,
  textColor?: string,
) {
  const baseClasses = markdownStyles[variant];
  const color = textColor || "text-zinc-700 dark:text-zinc-200";
  return `${baseClasses} ${color}`;
}
