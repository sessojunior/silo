/**
 * Script para aplicar a migration do pgvector.
 * Executa o SQL diretamente via conexão pg, sem depender de psql ou Docker.
 *
 * Uso: npx tsx packages/db/run-migration.ts
 */
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";

// Carrega .env da raiz do projeto
const rootDir = resolve(process.cwd());
dotenv.config({ path: resolve(rootDir, ".env") });

const databaseUrl =
  process.env.DATABASE_URL_DEV ||
  process.env.DATABASE_URL_PROD;

if (!databaseUrl) {
  console.error("❌ DATABASE_URL_DEV ou DATABASE_URL_PROD não definido no .env");
  process.exit(1);
}

/**
 * Executa um arquivo de migration SQL, dividindo em statements individuais.
 * Trata erros de "already exists" como warnings.
 */
async function runMigrationFile(pool: Pool, fileName: string): Promise<void> {
  const migrationPath = resolve(rootDir, "packages/db/drizzle", fileName);
  console.log(`\n📄 Rodando migration: ${fileName}...`);
  const sql = readFileSync(migrationPath, "utf-8");

  // Divide o SQL em statements individuais, removendo comentários
  const statements = sql
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.toUpperCase().startsWith("CREATE EXTENSION"));

  for (const statement of statements) {
    const preview = statement.replace(/\s+/g, " ").slice(0, 100);
    console.log(`   Executando: ${preview}...`);

    try {
      await pool.query(statement);
      console.log("   ✅ OK");
    } catch (err) {
      // IF NOT EXISTS já trata conflitos; outros erros propagam
      if (
        err instanceof Error &&
        (err.message.includes("already exists") || err.message.includes("duplicate"))
      ) {
        console.log("   ⚠️ Já existe, ignorado.");
      } else {
        throw err;
      }
    }
  }
}

async function main() {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("neon.tech")
      ? { rejectUnauthorized: false }
      : undefined,
  });

  try {
    // Etapa 1: Criar extensões
    console.log("1/3 Criando extensões...");
    await pool.query("CREATE EXTENSION IF NOT EXISTS vector;");
    await pool.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
    const { rows: extRows } = await pool.query(
      "SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'pg_trgm');",
    );
    for (const ext of extRows) {
      console.log(`   ✅ Extensão: ${ext.extname} v${ext.extversion}`);
    }

    // Etapa 2: Rodar migration pgvector
    await runMigrationFile(pool, "0007_pgvector_embeddings.sql");

    // Etapa 3: Rodar migration RAG enhancements
    await runMigrationFile(pool, "0008_rag_enhancements.sql");

    // Etapa 4: Verificar colunas e índices
    console.log("\n3/3 Verificando estrutura...");

    // Colunas embedding
    const { rows: cols } = await pool.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE column_name = 'embedding'
        AND table_name IN ('ai_assistant_message', 'product_problem', 'product_solution', 'help', 'product_manual_chunk');
    `);
    for (const col of cols) {
      console.log(`   ✅ ${col.table_name}.${col.column_name} (${col.data_type})`);
    }

    if (cols.length === 0) {
      console.log("   ⚠️ Nenhuma coluna embedding encontrada!");
    }

    // Índices
    const { rows: idxs } = await pool.query(`
      SELECT indexname FROM pg_indexes
      WHERE indexname LIKE 'idx_%embedding%' OR indexname LIKE 'idx_%trgm%';
    `);
    for (const idx of idxs) {
      console.log(`   ✅ Índice: ${idx.indexname}`);
    }

    console.log("\n✨ Migration aplicada com sucesso!");
  } catch (err) {
    console.error("❌ Erro na migration:", err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.message.includes("syntax error")) {
      console.error("   Verifique a sintaxe SQL em 0007_pgvector_embeddings.sql");
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
