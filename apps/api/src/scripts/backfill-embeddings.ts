/**
 * Script de backfill: gera embeddings para problemas e soluções existentes.
 *
 * Executar uma vez após a migration do pgvector:
 *   npx tsx apps/api/src/scripts/backfill-embeddings.ts
 *
 * Processa em batches de 50 para não sobrecarregar o Ollama.
 */
import { db } from "@silo/database";
import { productProblem, productSolution } from "@silo/database/schema";
import { sql, isNotNull, isNull } from "drizzle-orm";
import { generateEmbedding, toVectorLiteral } from "../infra/llm/embedding-client.js";

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

async function main(): Promise<void> {
  console.log("🚀 [BACKFILL] Iniciando backfill de embeddings...\n");

  const startedAt = Date.now();

  await backfillProblems();
  console.log();
  await backfillSolutions();

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n✨ [BACKFILL] Concluído em ${elapsed}s.`);
}

main().catch((err) => {
  console.error("❌ [BACKFILL] Erro fatal:", err);
  process.exit(1);
});
