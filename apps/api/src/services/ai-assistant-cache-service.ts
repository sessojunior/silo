/**
 * Cache semântico de respostas do assistente de IA.
 *
 * Armazena embeddings das respostas e busca por similaridade de cosseno
 * usando o operador <=> do pgvector. Se uma pergunta similar já foi respondida
 * nas últimas 6 horas, retorna a resposta cacheada sem chamar o Ollama.
 *
 * Segurança: o cache é escopo ao usuário (filtra por thread.user_id).
 * Só retorna mensagens do tipo "assistant".
 */
import { db } from "@silo/database";
import { sql } from "drizzle-orm";
import { generateEmbedding } from "../infra/llm/embedding-client.js";

/** Similaridade mínima (0 a 1) para considerar cache hit. */
const CACHE_SIMILARITY_THRESHOLD = 0.90;

/** Janela de validade do cache. Dados operacionais mudam, 6h é seguro. */
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

type CachedResponse = {
  content: string;
  thinking: string | null;
  metadata: Record<string, unknown>;
  similarity: number;
};

function toVectorParameter(embedding: number[]): string {
  if (
    embedding.length === 0 ||
    !embedding.every((value) => Number.isFinite(value))
  ) {
    throw new Error("Embedding inválido para cache semântico.");
  }

  return `[${embedding.join(",")}]`;
}

/**
 * Busca no banco uma resposta cacheada para a pergunta.
 * Retorna null se não encontrar nada com similaridade suficiente.
 */
export async function findCachedAssistantResponse(
  userId: string,
  question: string,
): Promise<CachedResponse | null> {
  const startedAt = Date.now();

  let embedding: number[];
  try {
    embedding = await generateEmbedding(question);
  } catch (err) {
    console.warn("⚠️ [CACHE] Falha ao gerar embedding:", err instanceof Error ? err.message : String(err));
    return null;
  }

  const vectorValue = toVectorParameter(embedding);
  const minDate = new Date(Date.now() - CACHE_MAX_AGE_MS);

  // Busca a mensagem de assistente com embedding mais próximo
  // Filtra por usuário via thread para impedir cache cross-user.
  const rows = await db.execute<{
    content: string;
    metadata: Record<string, unknown>;
    similarity: number;
  }>(
    sql`
      SELECT
        m.content,
        m.metadata,
        1 - (m.embedding <=> ${vectorValue}::vector) AS similarity
      FROM ai_assistant_message m
      INNER JOIN ai_assistant_thread t ON t.id = m.thread_id
      WHERE
        m.embedding IS NOT NULL
        AND m.sender_type = 'assistant'
        AND t.user_id = ${userId}
        AND m.created_at >= ${minDate}
      ORDER BY m.embedding <=> ${vectorValue}::vector
      LIMIT 1
    `,
  );

  const result = rows.rows[0] as
    | { content: string; metadata: Record<string, unknown>; similarity: number }
    | undefined;

  if (!result || result.similarity < CACHE_SIMILARITY_THRESHOLD) {
    const elapsed = Date.now() - startedAt;
    console.log(`🔍 [CACHE] Miss (${elapsed}ms, best similarity: ${result ? (result.similarity * 100).toFixed(1) + '%' : 'nenhum'})`);
    return null;
  }

  const metadata =
    typeof result.metadata === "object" && result.metadata !== null
      ? (result.metadata as Record<string, unknown>)
      : {};

  const elapsed = Date.now() - startedAt;
  console.log(`✅ [CACHE] Hit — similarity: ${(result.similarity * 100).toFixed(1)}% (${elapsed}ms)`);

  return {
    content: result.content,
    thinking: typeof metadata.thinking === "string" ? metadata.thinking : null,
    metadata,
    similarity: result.similarity,
  };
}

/**
 * Salva o embedding de uma mensagem do assistente no banco.
 * Chamado após gerar uma nova resposta (cache miss).
 */
export async function saveAssistantResponseEmbedding(
  messageId: string,
  content: string,
): Promise<void> {
  let embedding: number[];
  try {
    embedding = await generateEmbedding(content);
  } catch (err) {
    console.warn("⚠️ [CACHE] Falha ao gerar embedding para persistência:", err instanceof Error ? err.message : String(err));
    return;
  }

  const vectorValue = toVectorParameter(embedding);

  await db.execute(
    sql`
      UPDATE ai_assistant_message
      SET embedding = ${vectorValue}::vector
      WHERE id = ${messageId}
    `,
  );
}
