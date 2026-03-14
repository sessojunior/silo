import "dotenv/config";
import readline from "readline";
import { Pool } from "pg";
import { config } from "@/lib/config";

const shouldUseSsl = (url: string): boolean => {
  const lower = url.toLowerCase();
  if (lower.includes("sslmode=require")) return true;
  if (lower.includes("neon.tech")) return true;
  return false;
};

async function ask(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function run() {
  console.log("⚠️  RESET DO BANCO DE DADOS: isto irá apagar TODAS as tabelas e registros.");
  console.log("   Este comando SÓ PODE SER EXECUTADO em ambiente de TESTE (NODE_ENV=test).");

  // Segurança extra: garantir que estamos em ambiente de desenvolvimento
  // O reset NUNCA deve ser executado em produção.
  if (config.nodeEnv === "production") {
    console.error(
      `
Erro: ambiente detectado É produção (NODE_ENV=${config.nodeEnv}).
O script de reset NUNCA pode ser executado em produção.
Abortando.
`,
    );
    process.exit(1);
  }

  if (config.nodeEnv !== "development") {
    console.error(
      `
Erro: ambiente detectado não é de desenvolvimento (NODE_ENV=${config.nodeEnv}).
O script de reset só pode ser executado com NODE_ENV=development.
Defina NODE_ENV=development e a variável DATABASE_URL_DEV apontando para o banco de desenvolvimento antes de executar.
`,
    );
    process.exit(1);
  }

  const a = await ask("Digite 'CONFIRMO' para iniciar (ou qualquer outra coisa para cancelar): ");
  if (a !== "CONFIRMO") {
    console.log("Operação cancelada.");
    process.exit(0);
  }

  const b = await ask("CONFIRMAR NOVAMENTE: digite 'CONFIRMO' para apagar tudo: ");
  if (b !== "CONFIRMO") {
    console.log("Operação cancelada.");
    process.exit(0);
  }

  // Conectar ao banco com mesma lógica de SSL do projeto
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: 2,
    ssl:
      config.databaseUrl && shouldUseSsl(config.databaseUrl)
        ? { rejectUnauthorized: false }
        : undefined,
  });

  try {
    console.log("Truncando todas as tabelas do schema public (preservando schema e migrations)...");

    // Listar tabelas do schema public
    const res = await pool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public';`,
    );
    const tables = res.rows
      .map((r: { tablename?: string }) => r.tablename)
      .filter(Boolean) as string[];

    // Excluir tabelas de migrations se presentes (preservar histórico de migrations)
    const exclude = new Set(["drizzle_migrations", "knex_migrations", "schema_migrations"]);
    const targetTables = tables.filter((t) => !exclude.has(t));

    if (targetTables.length === 0) {
      console.log("Nenhuma tabela encontrada para truncar.");
    } else {
      const quoted = targetTables.map((t) => `"${t.replace(/"/g, '""')}"`).join(", ");
      // TRUNCATE com RESTART IDENTITY e CASCADE para limpar dados e sequences
      await pool.query(`TRUNCATE ${quoted} RESTART IDENTITY CASCADE;`);
      console.log(`Concluído: ${targetTables.length} tabela(s) truncada(s).`);
    }
  } catch (error) {
    console.error("Erro ao resetar o banco:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  run();
}
