/**
 * Classe utilitária para estilização consistente de markdown com Tailwind v4
 */
// Seletores usam [&_X] (descendente) em vez de [&>X] (filho direto) para
// funcionar através do <div> wrapper que o ReactMarkdown insere em conteúdo
// multi-bloco. O [&>div>*]:my-2 garante espaçamento entre os elementos internos.
export const markdownStyles = {
  // Para textos em geral (tamanho normal)
  base: "text-base [&>*]:my-2 [&>div>*]:my-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-medium [&_h4]:text-base [&_h4]:font-medium [&_p]:leading-relaxed [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:pl-4 [&_ol]:list-decimal [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_pre]:bg-zinc-100 [&_pre]:p-3 [&_pre]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs dark:[&_blockquote]:border-zinc-700 dark:[&_pre]:bg-zinc-800 dark:[&_code]:bg-zinc-800",

  // Para textos compactos (soluções, respostas)
  compact:
    "text-sm [&>*]:my-1 [&>div>*]:my-1 [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-medium [&_p]:leading-relaxed [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:pl-4 [&_ol]:list-decimal [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_pre]:bg-zinc-100 [&_pre]:p-2 [&_pre]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs dark:[&_blockquote]:border-zinc-700 dark:[&_pre]:bg-zinc-800 dark:[&_code]:bg-zinc-800",
};

export function getMarkdownClasses(
  variant: keyof typeof markdownStyles,
  textColor?: string,
) {
  const baseClasses = markdownStyles[variant];
  const color = textColor || "text-zinc-700 dark:text-zinc-200";
  return `${baseClasses} ${color}`;
}
