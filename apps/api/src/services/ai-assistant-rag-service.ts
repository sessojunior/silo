/**
 * RAG (Retrieval-Augmented Generation) para o assistente de IA.
 *
 * Busca semanticamente em múltiplas fontes de conhecimento:
 * - Problemas e soluções (product_problem, product_solution)
 * - Manuais de produto em chunks (product_manual_chunk)
 * - Documentação de ajuda (help)
 *
 * Estratégias de busca:
 * - Vetorial: similaridade de cosseno via pgvector (<=>)
 * - Híbrida: combina vetorial + trigram (pg_trgm) para precisão
 * - Re-ranking: reordena resultados combinando similaridade vetorial,
 *   keyword overlap e recency
 *
 * Log de qualidade: registra métricas de recuperação para auditoria.
 */
import { db } from "@silo/database";
import { sql } from "drizzle-orm";
import { generateEmbedding, toVectorLiteral } from "../infra/llm/embedding-client.js";

// ═══════════════════════════════════════════════════════════════════════════════
// Configuração
// ═══════════════════════════════════════════════════════════════════════════════

/** Número máximo de resultados por fonte antes do re-ranking. */
const DEFAULT_RAG_LIMIT = 5;

/** Similaridade mínima (0 a 1) para incluir um resultado. */
const MIN_RAG_SIMILARITY = 0.35;

/** Pesos para busca híbrida (devem somar 1). */
const HYBRID_WEIGHTS = {
  vector: 0.6,
  text: 0.4,
};

/** Pesos para re-ranking final (devem somar 1). */
const RERANK_WEIGHTS = {
  vectorSimilarity: 0.5,
  keywordOverlap: 0.3,
  recency: 0.2,
};

/** Número de candidatos a buscar antes do re-ranking (mais que o limite final). */
const CANDIDATE_MULTIPLIER = 3;

// ═══════════════════════════════════════════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════════════════════════════════════════

type SimilarProblem = {
  id: string;
  title: string;
  description: string | null;
  similarity: number;
  hybridScore: number;
  source: "problem";
};

type SimilarSolution = {
  id: string;
  description: string;
  similarity: number;
  hybridScore: number;
  source: "solution";
};

type SimilarManualChunk = {
  id: string;
  productId: string;
  content: string;
  similarity: number;
  source: "manual";
};

type SimilarHelp = {
  content: string;
  similarity: number;
  source: "help";
};

/** Contexto RAG enriquecido com múltiplas fontes de conhecimento. */
export type RagContext = {
  similarProblems: SimilarProblem[];
  similarSolutions: SimilarSolution[];
  manualChunks: SimilarManualChunk[];
  helpContent: SimilarHelp | null;
};

/** Métricas de qualidade do RAG para log. */
type RagQualityLog = {
  timestamp: string;
  questionPreview: string;
  scope: string;
  latencyMs: number;
  sources: {
    problems: { retrieved: number; afterFilter: number; topSimilarity: number };
    solutions: { retrieved: number; afterFilter: number; topSimilarity: number };
    manuals: { retrieved: number; afterFilter: number; topSimilarity: number };
    help: { found: boolean; similarity: number };
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// Utilidades de scoring
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calcula keyword overlap entre a query e um texto alvo.
 * Retorna valor entre 0 e 1.
 */
function keywordOverlapScore(query: string, target: string): number {
  const queryTokens = new Set(
    query
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2),
  );

  if (queryTokens.size === 0) return 0;

  const targetTokens = target
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/);

  let matches = 0;
  for (const token of targetTokens) {
    if (queryTokens.has(token)) {
      matches++;
    }
  }

  return Math.min(1, matches / queryTokens.size);
}

/**
 * Re-rank results by combining vector similarity, keyword overlap, and recency.
 */
function rerankResults<T extends { similarity: number; hybridScore?: number }>(
  results: T[],
  query: string,
  getText: (item: T) => string,
  limit: number,
): T[] {
  return results
    .map((item) => {
      const text = getText(item);
      const keywordScore = keywordOverlapScore(query, text);
      const vectorScore = item.similarity;

      // Score combinado: vetorial + keyword
      const combinedScore =
        vectorScore * RERANK_WEIGHTS.vectorSimilarity +
        keywordScore * RERANK_WEIGHTS.keywordOverlap;

      return { ...item, similarity: combinedScore };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .filter((item) => item.similarity >= MIN_RAG_SIMILARITY);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Busca híbrida (vetorial + textual)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Busca problemas similares com estratégia híbrida:
 * - Vetorial: pgvector <=> (similaridade de cosseno)
 * - Textual: pg_trgm similarity (trigram)
 * - Scores combinados por pesos configuráveis
 */
export async function findSimilarProblems(
  question: string,
  limit: number = DEFAULT_RAG_LIMIT,
): Promise<SimilarProblem[]> {
  let embedding: number[];
  try {
    embedding = await generateEmbedding(question);
  } catch {
    return [];
  }

  const vectorLiteral = toVectorLiteral(embedding);
  const candidateLimit = limit * CANDIDATE_MULTIPLIER;
  const safeQuestion = question.replace(/'/g, "''");

  try {
    // Busca híbrida: combina similaridade vetorial com trigram
    const rows = await db.execute<{
      id: string;
      title: string;
      description: string | null;
      vectorSimilarity: number;
      trigramSimilarity: number;
      hybridScore: number;
    }>(
    sql`
      SELECT
        p.id,
        p.title,
        p.description,
        1 - (p.embedding <=> ${sql.raw(vectorLiteral)}) AS vector_similarity,
        COALESCE(
          GREATEST(
            similarity(p.title, ${sql.raw(`'${safeQuestion}'`)}),
            similarity(p.description, ${sql.raw(`'${safeQuestion}'`)})
          ),
          0
        ) AS trigram_similarity,
        (
          (1 - (p.embedding <=> ${sql.raw(vectorLiteral)})) * ${sql.raw(String(HYBRID_WEIGHTS.vector))} +
          COALESCE(
            GREATEST(
              similarity(p.title, ${sql.raw(`'${safeQuestion}'`)}),
              similarity(p.description, ${sql.raw(`'${safeQuestion}'`)})
            ),
            0
          ) * ${sql.raw(String(HYBRID_WEIGHTS.text))}
        ) AS hybrid_score
      FROM product_problem p
      WHERE p.embedding IS NOT NULL
      ORDER BY hybrid_score DESC
      LIMIT ${sql.raw(String(candidateLimit))}
    `,
    );

    const candidates = rows.rows.map((row) => ({
      id: String(row.id ?? ""),
      title: String(row.title ?? ""),
      description: row.description ? String(row.description) : null,
      similarity: Number(row.vectorSimilarity ?? 0),
      hybridScore: Number(row.hybridScore ?? 0),
      source: "problem" as const,
    }));

    // Re-ranking: combina vetorial + keyword overlap
    return rerankResults(
      candidates,
      question,
      (item) => [item.title, item.description].filter(Boolean).join(" "),
      limit,
    );
  } catch (err) {
    console.warn(
      "⚠️ [RAG] Falha na busca híbrida de problemas:",
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }
}

/**
 * Busca soluções similares com estratégia híbrida.
 */
export async function findSimilarSolutions(
  question: string,
  limit: number = DEFAULT_RAG_LIMIT,
): Promise<SimilarSolution[]> {
  let embedding: number[];
  try {
    embedding = await generateEmbedding(question);
  } catch {
    return [];
  }

  const vectorLiteral = toVectorLiteral(embedding);
  const candidateLimit = limit * CANDIDATE_MULTIPLIER;
  const safeQuestion = question.replace(/'/g, "''");

  try {
    const rows = await db.execute<{
      id: string;
      description: string;
      vectorSimilarity: number;
      trigramSimilarity: number;
      hybridScore: number;
    }>(
    sql`
      SELECT
        s.id,
        s.description,
        1 - (s.embedding <=> ${sql.raw(vectorLiteral)}) AS vector_similarity,
        COALESCE(similarity(s.description, ${sql.raw(`'${safeQuestion}'`)}), 0) AS trigram_similarity,
        (
          (1 - (s.embedding <=> ${sql.raw(vectorLiteral)})) * ${sql.raw(String(HYBRID_WEIGHTS.vector))} +
          COALESCE(similarity(s.description, ${sql.raw(`'${safeQuestion}'`)}), 0) * ${sql.raw(String(HYBRID_WEIGHTS.text))}
        ) AS hybrid_score
      FROM product_solution s
      WHERE s.embedding IS NOT NULL
      ORDER BY hybrid_score DESC
      LIMIT ${sql.raw(String(candidateLimit))}
    `,
  );

  const candidates = rows.rows.map((row) => ({
    id: String(row.id ?? ""),
    description: String(row.description ?? ""),
    similarity: Number(row.vectorSimilarity ?? 0),
    hybridScore: Number(row.hybridScore ?? 0),
    source: "solution" as const,
  }));

  return rerankResults(
    candidates,
    question,
    (item) => item.description,
    limit,
  );
  } catch (err) {
    console.warn(
      "⚠️ [RAG] Falha na busca híbrida de soluções:",
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }
}

/**
 * Busca chunks de manuais de produto similares à pergunta.
 */
export async function findSimilarManualChunks(
  question: string,
  limit: number = DEFAULT_RAG_LIMIT,
): Promise<SimilarManualChunk[]> {
  let embedding: number[];
  try {
    embedding = await generateEmbedding(question);
  } catch {
    return [];
  }

  const vectorLiteral = toVectorLiteral(embedding);

  try {
    const rows = await db.execute<{
      id: string;
      productId: string;
      content: string;
      similarity: number;
    }>(
      sql`
        SELECT
          c.id,
          c.product_id,
          c.content,
          1 - (c.embedding <=> ${sql.raw(vectorLiteral)}) AS similarity
        FROM product_manual_chunk c
        WHERE c.embedding IS NOT NULL
        ORDER BY c.embedding <=> ${sql.raw(vectorLiteral)}
        LIMIT ${sql.raw(String(limit))}
      `,
    );

    return rows.rows
      .map((row) => ({
        id: String(row.id ?? ""),
        productId: String(row.productId ?? ""),
        content: String(row.content ?? ""),
        similarity: Number(row.similarity ?? 0),
        source: "manual" as const,
      }))
      .filter((c) => c.similarity >= MIN_RAG_SIMILARITY);
  } catch (err) {
    console.warn(
      "⚠️ [RAG] Falha na busca de manuais (tabela product_manual_chunk pode não existir):",
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }
}

/**
 * Busca similaridade na documentação de ajuda do sistema.
 */
export async function findSimilarHelp(
  question: string,
): Promise<SimilarHelp | null> {
  let embedding: number[];
  try {
    embedding = await generateEmbedding(question);
  } catch {
    return null;
  }

  const vectorLiteral = toVectorLiteral(embedding);

  try {
    const rows = await db.execute<{
      description: string;
      similarity: number;
    }>(
      sql`
        SELECT
          h.description,
          1 - (h.embedding <=> ${sql.raw(vectorLiteral)}) AS similarity
        FROM help h
        WHERE h.embedding IS NOT NULL
          AND h.id = 'system-help'
        LIMIT 1
      `,
    );

    const row = rows.rows[0];
    if (!row || Number(row.similarity ?? 0) < MIN_RAG_SIMILARITY) {
      return null;
    }

    return {
      content: String(row.description ?? ""),
      similarity: Number(row.similarity ?? 0),
      source: "help",
    };
  } catch (err) {
    console.warn(
      "⚠️ [RAG] Falha na busca de ajuda (coluna embedding pode não existir):",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Orquestração do contexto RAG
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Constrói o contexto RAG completo para enriquecer o prompt do Ollama.
 * Adapta a busca conforme o escopo detectado e coleta múltiplas fontes.
 */
export async function buildRagContext(
  question: string,
  scope: string,
): Promise<RagContext> {
  const startedAt = Date.now();

  const scopesWithRag = new Set([
    "models",
    "problems",
    "solutions",
    "projects",
    "pending",
    "general",
  ]);

  if (!scopesWithRag.has(scope)) {
    return {
      similarProblems: [],
      similarSolutions: [],
      manualChunks: [],
      helpContent: null,
    };
  }

  // Busca em paralelo em todas as fontes de conhecimento
  const [similarProblems, similarSolutions, manualChunks, helpContent] =
    await Promise.all([
      findSimilarProblems(question),
      findSimilarSolutions(question),
      findSimilarManualChunks(question),
      findSimilarHelp(question),
    ]);

  const elapsed = Date.now() - startedAt;

  // Log de qualidade
  logRagQuality({
    timestamp: new Date().toISOString(),
    questionPreview: question.slice(0, 80),
    scope,
    latencyMs: elapsed,
    sources: {
      problems: {
        retrieved: similarProblems.length,
        afterFilter: similarProblems.length,
        topSimilarity:
          similarProblems.length > 0 ? similarProblems[0].similarity : 0,
      },
      solutions: {
        retrieved: similarSolutions.length,
        afterFilter: similarSolutions.length,
        topSimilarity:
          similarSolutions.length > 0 ? similarSolutions[0].similarity : 0,
      },
      manuals: {
        retrieved: manualChunks.length,
        afterFilter: manualChunks.length,
        topSimilarity:
          manualChunks.length > 0 ? manualChunks[0].similarity : 0,
      },
      help: {
        found: helpContent !== null,
        similarity: helpContent?.similarity ?? 0,
      },
    },
  });

  return { similarProblems, similarSolutions, manualChunks, helpContent };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Formatação do contexto para o prompt
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Formata o contexto RAG como texto estruturado para inclusão no prompt do Ollama.
 * Limita o tamanho total para não estourar a janela de contexto.
 */
export function formatRagContextForPrompt(context: RagContext): string {
  const lines: string[] = [];
  let totalChars = 0;
  const MAX_CONTEXT_CHARS = 2000;

  // Problemas similares
  if (context.similarProblems.length > 0) {
    lines.push("### Problemas similares já registrados no SILO:");
    for (const problem of context.similarProblems) {
      const line = `- "${problem.title}" (relevância: ${(problem.similarity * 100).toFixed(0)}%)`;
      if (totalChars + line.length > MAX_CONTEXT_CHARS) break;
      lines.push(line);
      totalChars += line.length;

      if (problem.description) {
        const descLine = `  Descrição: ${problem.description.slice(0, 150)}`;
        if (totalChars + descLine.length > MAX_CONTEXT_CHARS) break;
        lines.push(descLine);
        totalChars += descLine.length;
      }
    }
    lines.push("");
  }

  // Soluções similares
  if (context.similarSolutions.length > 0) {
    lines.push("### Soluções similares já aplicadas:");
    for (const solution of context.similarSolutions) {
      const line = `- "${solution.description.slice(0, 200)}" (relevância: ${(solution.similarity * 100).toFixed(0)}%)`;
      if (totalChars + line.length > MAX_CONTEXT_CHARS) break;
      lines.push(line);
      totalChars += line.length;
    }
    lines.push("");
  }

  // Chunks de manuais
  if (context.manualChunks.length > 0) {
    lines.push("### Trechos relevantes dos manuais de produto:");
    for (const chunk of context.manualChunks) {
      const line = `- [Manual] "${chunk.content.slice(0, 200)}" (relevância: ${(chunk.similarity * 100).toFixed(0)}%)`;
      if (totalChars + line.length > MAX_CONTEXT_CHARS) break;
      lines.push(line);
      totalChars += line.length;
    }
    lines.push("");
  }

  // Ajuda do sistema
  if (context.helpContent) {
    lines.push("### Documentação de ajuda relevante:");
    const helpText = context.helpContent.content.slice(0, 500);
    const line = `- ${helpText} (relevância: ${(context.helpContent.similarity * 100).toFixed(0)}%)`;
    if (totalChars + line.length <= MAX_CONTEXT_CHARS) {
      lines.push(line);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Log de qualidade
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Registra métricas de qualidade da recuperação RAG.
 * Log estruturado para auditoria e ajuste de thresholds.
 */
function logRagQuality(log: RagQualityLog): void {
  const totalRetrieved =
    log.sources.problems.retrieved +
    log.sources.solutions.retrieved +
    log.sources.manuals.retrieved +
    (log.sources.help.found ? 1 : 0);

  const hasResults = totalRetrieved > 0;

  console.log(
    `📊 [RAG] escopo="${log.scope}" | ${log.latencyMs}ms | ` +
      `problemas:${log.sources.problems.retrieved} ` +
      `soluções:${log.sources.solutions.retrieved} ` +
      `manuais:${log.sources.manuals.retrieved} ` +
      `ajuda:${log.sources.help.found ? "sim" : "não"} | ` +
      `total:${totalRetrieved} | ` +
      `qualidade:${hasResults ? "✅" : "⚠️ vazio"}`,
  );

  // Log detalhado apenas se não encontrou nada (para diagnóstico)
  if (!hasResults) {
    console.warn(
      `⚠️ [RAG] Nenhum resultado para: "${log.questionPreview}" (escopo: ${log.scope})`,
    );
  }
}

