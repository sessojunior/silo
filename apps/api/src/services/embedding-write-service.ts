/**
 * Serviço de escrita de embeddings.
 *
 * Responsável por gerar e persistir embeddings de forma assíncrona
 * quando problemas, soluções, manuais ou ajuda são criados/atualizados.
 *
 * Fire-and-forget: não bloqueia a resposta da API.
 * Erros são logados mas não propagados para o usuário.
 */
import { db } from "@silo/database";
import { sql } from "drizzle-orm";
import { generateEmbedding, toVectorLiteral } from "../infra/llm/embedding-client.js";
import { chunkMarkdown } from "../infra/llm/text-chunker.js";

/**
 * Gera e persiste embedding para um problema.
 * Chamado após INSERT ou UPDATE de product_problem.
 */
export async function upsertProblemEmbedding(
  problemId: string,
  title: string,
  description: string,
): Promise<void> {
  try {
    const text = [title, description].filter(Boolean).join(" ");
    const embedding = await generateEmbedding(text);
    const vectorLiteral = toVectorLiteral(embedding);

    await db.execute(
      sql`UPDATE product_problem SET embedding = ${sql.raw(vectorLiteral)} WHERE id = ${sql.raw(`'${problemId}'`)}`,
    );
  } catch (err) {
    console.warn(
      `⚠️ [EMBEDDING] Falha ao gerar embedding do problema ${problemId}:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Gera e persiste embedding para uma solução.
 * Chamado após INSERT ou UPDATE de product_solution.
 */
export async function upsertSolutionEmbedding(
  solutionId: string,
  description: string,
): Promise<void> {
  try {
    const embedding = await generateEmbedding(description);
    const vectorLiteral = toVectorLiteral(embedding);

    await db.execute(
      sql`UPDATE product_solution SET embedding = ${sql.raw(vectorLiteral)} WHERE id = ${sql.raw(`'${solutionId}'`)}`,
    );
  } catch (err) {
    console.warn(
      `⚠️ [EMBEDDING] Falha ao gerar embedding da solução ${solutionId}:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Gera e persiste embeddings para os chunks de um manual.
 * Remove chunks antigos e recria com o conteúdo atualizado.
 * Chamado após upsert de product_manual.
 */
export async function upsertManualChunks(
  manualId: string,
  productId: string,
  markdown: string,
): Promise<void> {
  try {
    // Remove chunks antigos
    await db.execute(
      sql`DELETE FROM product_manual_chunk WHERE product_manual_id = ${sql.raw(`'${manualId}'`)}`,
    );

    // Divide o markdown em chunks
    const chunks = chunkMarkdown(markdown);

    if (chunks.length === 0) return;

    // Gera embeddings e insere chunks em lote
    for (const chunk of chunks) {
      try {
        const embedding = await generateEmbedding(chunk.content);
        const vectorLiteral = toVectorLiteral(embedding);
        const chunkId = `${manualId}_chunk_${chunk.index}`;

        await db.execute(
          sql`
            INSERT INTO product_manual_chunk (id, product_manual_id, product_id, chunk_index, content, token_count, embedding)
            VALUES (
              ${sql.raw(`'${chunkId}'`)},
              ${sql.raw(`'${manualId}'`)},
              ${sql.raw(`'${productId}'`)},
              ${sql.raw(String(chunk.index))},
              ${sql.raw(`'${chunk.content.replace(/'/g, "''")}'`)},
              ${sql.raw(String(chunk.tokenCount))},
              ${sql.raw(vectorLiteral)}
            )
          `,
        );
      } catch (chunkErr) {
        console.warn(
          `⚠️ [EMBEDDING] Falha no chunk ${chunk.index} do manual ${manualId}:`,
          chunkErr instanceof Error ? chunkErr.message : String(chunkErr),
        );
      }
    }

    console.log(
      `📝 [EMBEDDING] ${chunks.length} chunks indexados para o manual ${manualId}`,
    );
  } catch (err) {
    console.warn(
      `⚠️ [EMBEDDING] Falha ao processar manual ${manualId}:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Gera e persiste embedding para o documento de ajuda.
 * Chamado após update de help.
 */
export async function upsertHelpEmbedding(description: string): Promise<void> {
  try {
    if (!description || description.trim().length === 0) return;

    const embedding = await generateEmbedding(description);
    const vectorLiteral = toVectorLiteral(embedding);

    await db.execute(
      sql`UPDATE help SET embedding = ${sql.raw(vectorLiteral)} WHERE id = 'system-help'`,
    );
  } catch (err) {
    console.warn(
      "⚠️ [EMBEDDING] Falha ao gerar embedding da ajuda:",
      err instanceof Error ? err.message : String(err),
    );
  }
}
