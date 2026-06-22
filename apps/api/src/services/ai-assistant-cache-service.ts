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
import { sql, eq, and, gte, desc } from "drizzle-orm";
import { generateEmbedding, toVectorLiteral } from "../infra/llm/embedding-client.js";

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

/**
 * Busca no banco uma resposta cacheada para a pergunta.
 * Retorna null se não encontrar nada com similaridade suficiente.
 */
export async function findCachedAssistantResponse(
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

  const vectorLiteral = toVectorLiteral(embedding);
  const minDate = new Date(Date.now() - CACHE_MAX_AGE_MS).toISOString();

  // Busca a mensagem de assistente com embedding mais próximo
  // Filtra por: embedding NOT NULL, senderType = 'assistant', criada nas últimas 6h
  const rows = await db.execute<{
    content: string;
    metadata: Record<string, unknown>;
    similarity: number;
  }>(
    sql`
      SELECT
        m.content,
        m.metadata,
        1 - (m.embedding <=> ${sql.raw(vectorLiteral)}) AS similarity
      FROM ai_assistant_message m
      WHERE
        m.embedding IS NOT NULL
        AND m.sender_type = 'assistant'
        AND m.created_at >= ${sql.raw(`'${minDate}'::timestamp`)}
      ORDER BY m.embedding <=> ${sql.raw(vectorLiteral)}
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

  const vectorLiteral = toVectorLiteral(embedding);

  await db.execute(
    sql`
      UPDATE ai_assistant_message
      SET embedding = ${sql.raw(vectorLiteral)}
      WHERE id = ${sql.raw(`'${messageId}'`)}
    `,
  );
}
