const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

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

const client = new Client({ connectionString, ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined });

(async () => {
  try {
    await client.connect();
    console.log('Inspecting group_permissions column defaults...');
    const q = `SELECT column_name, column_default, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'group_permissions'
ORDER BY ordinal_position;`;
    const res = await client.query(q);
    console.log('Columns for group_permissions:');
    console.table(res.rows);

    const ext = await client.query("SELECT extname FROM pg_extension WHERE extname IN ('pgcrypto','uuid-ossp');");
    console.log('Installed UUID extensions:', ext.rows.map(r => r.extname));

    const defaults = await client.query("SELECT column_default FROM information_schema.columns WHERE table_name='group_permissions' AND column_name='id';");
    console.log('id column_default:', defaults.rows[0] && defaults.rows[0].column_default);
  } catch (err) {
    console.error('Inspect failed:', err);
    process.exit(2);
  } finally {
    try { await client.end(); } catch {}
  }
})();
