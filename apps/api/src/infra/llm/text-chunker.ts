/**
 * Utilitário de chunking de texto para RAG.
 *
 * Divide textos longos (Markdown, manuais) em chunks menores
 * com overlap controlado para preservar contexto entre fronteiras.
 *
 * Estratégia:
 * - Prioriza quebras naturais: parágrafos, headings Markdown, listas
 * - Tamanho alvo: ~512 tokens (~2048 caracteres em português)
 * - Overlap: ~64 tokens (~256 caracteres) entre chunks consecutivos
 * - Fallback: quebra por sentenças se o chunk for muito longo
 */

/** Tamanho alvo de cada chunk em caracteres (≈512 tokens para pt-BR). */
const CHUNK_SIZE_CHARS = 2048;

/** Overlap entre chunks consecutivos em caracteres (≈64 tokens). */
const CHUNK_OVERLAP_CHARS = 256;

/** Tamanho mínimo de um chunk para ser considerado válido. */
const MIN_CHUNK_SIZE_CHARS = 100;

export type TextChunk = {
  /** Conteúdo do chunk (texto puro, sem Markdown). */
  content: string;
  /** Índice do chunk (0-based). */
  index: number;
  /** Estimativa de tokens (≈ chars / 4 para pt-BR). */
  tokenCount: number;
};

/**
 * Divide um bloco de texto Markdown em chunks semânticos.
 * Preserva a estrutura quando possível, quebra por sentenças quando necessário.
 */
export function chunkMarkdown(markdown: string): TextChunk[] {
  if (!markdown || markdown.trim().length === 0) {
    return [];
  }

  // Etapa 1: Divide por headings Markdown (##, ###) para preservar estrutura
  const sections = splitByHeadings(markdown);

  // Etapa 2: Para cada seção, divide em parágrafos e depois em chunks
  const chunks: TextChunk[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    const sectionChunks = chunkSection(section, chunkIndex);
    chunks.push(...sectionChunks);
    chunkIndex += sectionChunks.length;
  }

  // Etapa 3: Garante tamanho mínimo — junta chunks muito pequenos com o anterior
  return mergeSmallChunks(chunks);
}

/**
 * Divide o texto por headings Markdown (linhas que começam com #).
 */
function splitByHeadings(text: string): string[] {
  const headingRegex = /^(#{1,6}\s+.+)$/gm;
  const sections: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(text)) !== null) {
    // Texto antes deste heading vira uma seção
    const beforeHeading = text.slice(lastIndex, match.index).trim();
    if (beforeHeading.length > 0) {
      sections.push(beforeHeading);
    }

    lastIndex = match.index;
  }

  // Última seção
  const remaining = text.slice(lastIndex).trim();
  if (remaining.length > 0) {
    sections.push(remaining);
  }

  // Se não encontrou headings, retorna o texto inteiro como uma seção
  if (sections.length === 0 && text.trim().length > 0) {
    sections.push(text.trim());
  }

  return sections;
}

/**
 * Divide uma seção em chunks de tamanho controlado.
 */
function chunkSection(section: string, startIndex: number): TextChunk[] {
  // Limpa formatação Markdown básica para o conteúdo do chunk
  const cleaned = cleanMarkdown(section);

  // Se a seção já é menor que o tamanho alvo, retorna como um chunk
  if (cleaned.length <= CHUNK_SIZE_CHARS) {
    return [
      {
        content: cleaned,
        index: startIndex,
        tokenCount: estimateTokens(cleaned),
      },
    ];
  }

  // Divide em parágrafos primeiro
  const paragraphs = splitParagraphs(cleaned);
  const chunks: TextChunk[] = [];
  let currentChunk = "";
  let chunkIdx = startIndex;

  for (const paragraph of paragraphs) {
    // Se adicionar este parágrafo não estoura o limite
    if (currentChunk.length + paragraph.length + 1 <= CHUNK_SIZE_CHARS) {
      currentChunk = currentChunk
        ? `${currentChunk}\n\n${paragraph}`
        : paragraph;
      continue;
    }

    // Salva chunk atual
    if (currentChunk.length >= MIN_CHUNK_SIZE_CHARS) {
      chunks.push({
        content: currentChunk,
        index: chunkIdx,
        tokenCount: estimateTokens(currentChunk),
      });
      chunkIdx++;

      // Overlap: mantém as últimas palavras do chunk anterior
      const overlapText = extractOverlap(currentChunk);
      currentChunk = overlapText ? `${overlapText}\n\n${paragraph}` : paragraph;
    } else {
      // Parágrafo muito grande — quebra por sentenças
      const sentenceChunks = chunkBySentences(
        currentChunk + "\n\n" + paragraph,
        chunkIdx,
      );
      chunks.push(...sentenceChunks);
      chunkIdx += sentenceChunks.length;
      currentChunk = "";
    }
  }

  // Último chunk
  if (currentChunk.length >= MIN_CHUNK_SIZE_CHARS) {
    chunks.push({
      content: currentChunk,
      index: chunkIdx,
      tokenCount: estimateTokens(currentChunk),
    });
  }

  return chunks;
}

/**
 * Divide parágrafos do texto.
 */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Divide um texto longo em chunks baseados em sentenças.
 */
function chunkBySentences(text: string, startIndex: number): TextChunk[] {
  // Divide por pontuação de fim de sentença: . ! ? seguido de espaço
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const chunks: TextChunk[] = [];
  let currentChunk = "";
  let chunkIdx = startIndex;

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length + 1 <= CHUNK_SIZE_CHARS) {
      currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
      continue;
    }

    if (currentChunk.length >= MIN_CHUNK_SIZE_CHARS) {
      chunks.push({
        content: currentChunk,
        index: chunkIdx,
        tokenCount: estimateTokens(currentChunk),
      });
      chunkIdx++;
      currentChunk = sentence;
    } else {
      // Sentença gigante — trunca
      chunks.push({
        content: sentence.slice(0, CHUNK_SIZE_CHARS),
        index: chunkIdx,
        tokenCount: estimateTokens(sentence.slice(0, CHUNK_SIZE_CHARS)),
      });
      chunkIdx++;
      currentChunk = "";
    }
  }

  if (currentChunk.length >= MIN_CHUNK_SIZE_CHARS) {
    chunks.push({
      content: currentChunk,
      index: chunkIdx,
      tokenCount: estimateTokens(currentChunk),
    });
  }

  return chunks;
}

/**
 * Extrai as últimas palavras de um chunk para overlap.
 */
function extractOverlap(chunk: string): string {
  const words = chunk.split(/\s+/);
  if (words.length <= 10) return "";

  // Pega últimas palavras que cabem no overlap
  let overlap = "";
  for (let i = words.length - 1; i >= 0; i--) {
    const candidate = words[i] + (overlap ? " " + overlap : "");
    if (candidate.length > CHUNK_OVERLAP_CHARS) break;
    overlap = candidate;
  }

  return overlap;
}

/**
 * Junta chunks muito pequenos com o anterior.
 */
function mergeSmallChunks(chunks: TextChunk[]): TextChunk[] {
  if (chunks.length <= 1) return chunks;

  const merged: TextChunk[] = [];
  let current = chunks[0];

  for (let i = 1; i < chunks.length; i++) {
    const next = chunks[i];

    if (
      current.content.length < MIN_CHUNK_SIZE_CHARS &&
      current.content.length + next.content.length <= CHUNK_SIZE_CHARS
    ) {
      // Junta com o próximo
      current = {
        content: `${current.content}\n\n${next.content}`,
        index: current.index,
        tokenCount: estimateTokens(
          `${current.content}\n\n${next.content}`,
        ),
      };
    } else {
      merged.push(current);
      current = next;
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Remove formatação Markdown mantendo o texto legível.
 */
function cleanMarkdown(markdown: string): string {
  return markdown
    // Remove headers (# ## etc)
    .replace(/^#{1,6}\s+/gm, "")
    // Remove bold/italic
    .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, "$2")
    // Remove links mantendo texto
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Remove imagens
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "")
    // Remove código inline
    .replace(/`([^`]*)`/g, "$1")
    // Remove blocos de código
    .replace(/```[\s\S]*?```/g, "")
    // Remove list markers (-, *, 1.)
    .replace(/^[\s]*[-*+]\s+/gm, "")
    .replace(/^[\s]*\d+\.\s+/gm, "")
    // Remove blockquotes
    .replace(/^>\s+/gm, "")
    // Remove linhas horizontais
    .replace(/^[-*_]{3,}\s*$/gm, "")
    // Normaliza espaços
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Estima número de tokens (≈ 4 caracteres por token para português).
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
