/**
 * RAG (Retrieval-Augmented Generation) para o assistente de IA.
 *
 * Busca semanticamente problemas e soluções similares no banco
 * usando o operador <=> do pgvector. Enriquece o prompt do Ollama
 * com dados relevantes, permitindo respostas como:
 * "Esse problema é similar ao incidente X de 3 dias atrás..."
 */
import { db } from "@silo/database";
import { sql } from "drizzle-orm";
import { generateEmbedding, toVectorLiteral } from "../infra/llm/embedding-client.js";

const DEFAULT_RAG_LIMIT = 5;
const MIN_RAG_SIMILARITY = 0.50;

type SimilarProblem = {
  id: string;
  title: string;
  description: string | null;
  similarity: number;
};

type SimilarSolution = {
  id: string;
  description: string;
  similarity: number;
};

type RagContext = {
  similarProblems: SimilarProblem[];
  similarSolutions: SimilarSolution[];
};

/**
 * Busca problemas similares à pergunta do usuário.
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

  const rows = await db.execute<{
    id: string;
    title: string;
    description: string | null;
    similarity: number;
  }>(
    sql`
      SELECT
        p.id,
        p.title,
        p.description,
        1 - (p.embedding <=> ${sql.raw(vectorLiteral)}) AS similarity
      FROM product_problem p
      WHERE p.embedding IS NOT NULL
      ORDER BY p.embedding <=> ${sql.raw(vectorLiteral)}
      LIMIT ${sql.raw(String(limit))}
    `,
  );

  return rows.rows
    .map((row) => ({
      id: String(row.id ?? ""),
      title: String(row.title ?? ""),
      description: row.description ? String(row.description) : null,
      similarity: Number(row.similarity ?? 0),
    }))
    .filter((p) => p.similarity >= MIN_RAG_SIMILARITY);
}

/**
 * Busca soluções similares à pergunta do usuário.
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

  const rows = await db.execute<{
    id: string;
    description: string;
    similarity: number;
  }>(
    sql`
      SELECT
        s.id,
        s.description,
        1 - (s.embedding <=> ${sql.raw(vectorLiteral)}) AS similarity
      FROM product_solution s
      WHERE s.embedding IS NOT NULL
      ORDER BY s.embedding <=> ${sql.raw(vectorLiteral)}
      LIMIT ${sql.raw(String(limit))}
    `,
  );

  return rows.rows
    .map((row) => ({
      id: String(row.id ?? ""),
      description: String(row.description ?? ""),
      similarity: Number(row.similarity ?? 0),
    }))
    .filter((s) => s.similarity >= MIN_RAG_SIMILARITY);
}

/**
 * Constrói o contexto RAG completo para enriquecer o prompt do Ollama.
 * Adapta a busca conforme o escopo detectado.
 */
export async function buildRagContext(
  question: string,
  scope: string,
): Promise<RagContext> {
  const scopesWithRag = new Set(["models", "problems", "solutions", "general"]);

  if (!scopesWithRag.has(scope)) {
    return { similarProblems: [], similarSolutions: [] };
  }

  const [similarProblems, similarSolutions] = await Promise.all([
    findSimilarProblems(question),
    findSimilarSolutions(question),
  ]);

  return { similarProblems, similarSolutions };
}

/**
 * Formata o contexto RAG como texto para inclusão no prompt do Ollama.
 */
export function formatRagContextForPrompt(context: RagContext): string {
  const lines: string[] = [];

  if (context.similarProblems.length > 0) {
    lines.push("### Problemas similares já registrados no SILO:");
    for (const problem of context.similarProblems) {
      lines.push(`- "${problem.title}" (similaridade: ${(problem.similarity * 100).toFixed(0)}%)`);
      if (problem.description) {
        lines.push(`  Descrição: ${problem.description.slice(0, 150)}`);
      }
    }
  }

  if (context.similarSolutions.length > 0) {
    lines.push("### Soluções similares já aplicadas:");
    for (const solution of context.similarSolutions) {
      lines.push(`- "${solution.description.slice(0, 200)}" (similaridade: ${(solution.similarity * 100).toFixed(0)}%)`);
    }
  }

  return lines.join("\n");
}
