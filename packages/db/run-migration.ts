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

async function main() {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("neon.tech")
      ? { rejectUnauthorized: false }
      : undefined,
  });

  try {
    // Etapa 1: Criar extensão
    console.log("1/2 Criando extensão vector...");
    await pool.query("CREATE EXTENSION IF NOT EXISTS vector;");
    const { rows: extRows } = await pool.query(
      "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';",
    );
    console.log(`   ✅ Extensão: ${extRows[0].extname} v${extRows[0].extversion}`);

    // Etapa 2: Rodar migration SQL
    const migrationPath = resolve(rootDir, "packages/db/drizzle/0007_pgvector_embeddings.sql");
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

    // Etapa 3: Verificar colunas e índices
    console.log("\n2/2 Verificando estrutura...");

    // Colunas embedding
    const { rows: cols } = await pool.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE column_name = 'embedding'
        AND table_name IN ('ai_assistant_message', 'product_problem', 'product_solution');
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
      WHERE indexname LIKE 'idx_%embedding%';
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
