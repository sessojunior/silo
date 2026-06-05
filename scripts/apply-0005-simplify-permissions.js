const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');

// Carrega .env da raiz
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const sqlPath = path.resolve(__dirname, '../packages/db/drizzle/0005_simplify_permissions.sql');
if (!fs.existsSync(sqlPath)) {
  console.error('SQL file not found:', sqlPath);
  process.exit(1);
}
const sql = fs.readFileSync(sqlPath, 'utf8');

const connectionString = process.env.DATABASE_URL_DEV || process.env.DATABASE_URL || process.env.DATABASE_URL_PROD;
if (!connectionString) {
  console.error('ERRO: nenhuma string de conexão encontrada. Defina DATABASE_URL_DEV ou DATABASE_URL.');
  process.exit(1);
}

const shouldUseSsl = (cs) => {
  if (!cs) return false;
  const lower = cs.toLowerCase();
  return lower.includes('sslmode=require') || lower.includes('neon.tech') || lower.includes('sslmode=verify-full');
};

const client = new Client({
  connectionString,
  ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
});

(async () => {
  try {
    console.log('Conectando ao banco...');
    await client.connect();
    console.log('Executando migration:', sqlPath);
    const res = await client.query(sql);
    console.log('Migration executada com sucesso. Resultado:', res && typeof res.rowCount !== 'undefined' ? `rowCount=${res.rowCount}` : 'ok');
    process.exit(0);
  } catch (err) {
    console.error('Erro ao aplicar migration:', err);
    process.exit(2);
  } finally {
    try { await client.end(); } catch {};
  }
})();
