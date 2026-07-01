/**
 * Script de backfill: gera embeddings para registros existentes.
 *
 * Cobre:
 * - Problemas (product_problem)
 * - Soluções (product_solution)
 * - Manuais de produto (product_manual → chunks)
 * - Ajuda do sistema (help)
 *
 * Executar uma vez após a migration 0008_rag_enhancements.sql:
 *   npx tsx apps/api/src/scripts/backfill-embeddings.ts
 *
 * Processa em batches de 50 para não sobrecarregar o Ollama.
 */
import { db } from "@silo/database";
import { productProblem, productSolution, productManual } from "@silo/database/schema";
import { sql, isNull } from "drizzle-orm";
import { generateEmbedding, toVectorLiteral } from "../infra/llm/embedding-client.js";
import { chunkMarkdown } from "../infra/llm/text-chunker.js";

const BATCH_SIZE = 50;

async function backfillProblems(): Promise<void> {
  console.log("🔄 [BACKFILL] Buscando problemas sem embedding...");

  const problems = await db
    .select({ id: productProblem.id, title: productProblem.title, description: productProblem.description })
    .from(productProblem)
    .where(isNull(sql`embedding`));

  console.log(`   ${problems.length} problemas encontrados.`);

  for (let i = 0; i < problems.length; i += BATCH_SIZE) {
    const batch = problems.slice(i, i + BATCH_SIZE);

    for (const problem of batch) {
      try {
        const text = [problem.title, problem.description].filter(Boolean).join(" ");
        const embedding = await generateEmbedding(text);
        const vectorLiteral = toVectorLiteral(embedding);

        await db.execute(
          sql`UPDATE product_problem SET embedding = ${sql.raw(vectorLiteral)} WHERE id = ${sql.raw(`'${problem.id}'`)}`,
        );
      } catch (err) {
        console.warn(`   ⚠️ Falha no problema ${problem.id}:`, err instanceof Error ? err.message : String(err));
      }
    }

    const done = Math.min(i + BATCH_SIZE, problems.length);
    console.log(`   ✅ ${done}/${problems.length} problemas processados`);
  }
}

async function backfillSolutions(): Promise<void> {
  console.log("🔄 [BACKFILL] Buscando soluções sem embedding...");

  const solutions = await db
    .select({ id: productSolution.id, description: productSolution.description })
    .from(productSolution)
    .where(isNull(sql`embedding`));

  console.log(`   ${solutions.length} soluções encontradas.`);

  for (let i = 0; i < solutions.length; i += BATCH_SIZE) {
    const batch = solutions.slice(i, i + BATCH_SIZE);

    for (const solution of batch) {
      try {
        const embedding = await generateEmbedding(solution.description);
        const vectorLiteral = toVectorLiteral(embedding);

        await db.execute(
          sql`UPDATE product_solution SET embedding = ${sql.raw(vectorLiteral)} WHERE id = ${sql.raw(`'${solution.id}'`)}`,
        );
      } catch (err) {
        console.warn(`   ⚠️ Falha na solução ${solution.id}:`, err instanceof Error ? err.message : String(err));
      }
    }

    const done = Math.min(i + BATCH_SIZE, solutions.length);
    console.log(`   ✅ ${done}/${solutions.length} soluções processadas`);
  }
}

async function backfillManuals(): Promise<void> {
  console.log("🔄 [BACKFILL] Buscando manuais para chunking...");

  const manuals = await db
    .select({
      id: productManual.id,
      productId: productManual.productId,
      description: productManual.description,
    })
    .from(productManual);

  console.log(`   ${manuals.length} manuais encontrados.`);

  for (const manual of manuals) {
    try {
      // Remove chunks antigos
      await db.execute(
        sql`DELETE FROM product_manual_chunk WHERE product_manual_id = ${sql.raw(`'${manual.id}'`)}`,
      );

      const chunks = chunkMarkdown(manual.description);
      if (chunks.length === 0) continue;

      for (const chunk of chunks) {
        try {
          const embedding = await generateEmbedding(chunk.content);
          const vectorLiteral = toVectorLiteral(embedding);
          const chunkId = `${manual.id}_chunk_${chunk.index}`;
          const safeContent = chunk.content.replace(/'/g, "''");

          await db.execute(
            sql`
              INSERT INTO product_manual_chunk (id, product_manual_id, product_id, chunk_index, content, token_count, embedding)
              VALUES (
                ${sql.raw(`'${chunkId}'`)},
                ${sql.raw(`'${manual.id}'`)},
                ${sql.raw(`'${manual.productId}'`)},
                ${sql.raw(String(chunk.index))},
                ${sql.raw(`'${safeContent}'`)},
                ${sql.raw(String(chunk.tokenCount))},
                ${sql.raw(vectorLiteral)}
              )
            `,
          );
        } catch (chunkErr) {
          console.warn(`   ⚠️ Falha no chunk ${chunk.index} do manual ${manual.id}:`, chunkErr instanceof Error ? chunkErr.message : String(chunkErr));
        }
      }

      console.log(`   ✅ Manual ${manual.id}: ${chunks.length} chunks indexados`);
    } catch (err) {
      console.warn(`   ⚠️ Falha no manual ${manual.id}:`, err instanceof Error ? err.message : String(err));
    }
  }
}

async function backfillHelp(): Promise<void> {
  console.log("🔄 [BACKFILL] Indexando ajuda do sistema...");

  const rows = await db.execute<{ description: string }>(
    sql`SELECT description FROM help WHERE id = 'system-help' AND embedding IS NULL`,
  );

  const helpRow = rows.rows[0];
  if (!helpRow || !helpRow.description) {
    console.log("   Nenhuma ajuda sem embedding encontrada.");
    return;
  }

  try {
    const embedding = await generateEmbedding(String(helpRow.description));
    const vectorLiteral = toVectorLiteral(embedding);

    await db.execute(
      sql`UPDATE help SET embedding = ${sql.raw(vectorLiteral)} WHERE id = 'system-help'`,
    );

    console.log("   ✅ Ajuda indexada com sucesso.");
  } catch (err) {
    console.warn("   ⚠️ Falha ao indexar ajuda:", err instanceof Error ? err.message : String(err));
  }
}

async function main(): Promise<void> {
  console.log("🚀 [BACKFILL] Iniciando backfill de embeddings...\n");

  const startedAt = Date.now();

  await backfillProblems();
  console.log();
  await backfillSolutions();
  console.log();
  await backfillManuals();
  console.log();
  await backfillHelp();

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n✨ [BACKFILL] Concluído em ${elapsed}s.`);
}

main().catch((err) => {
  console.error("❌ [BACKFILL] Erro fatal:", err);
  process.exit(1);
});
