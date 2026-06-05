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
    console.log('Connected to DB, inspecting group tables...');
    const r = await client.query("SELECT to_regclass('public.\"group\"') AS tbl_group, to_regclass('public.groups') AS tbl_groups;");
    const row = r.rows[0] || {};
    console.log('to_regclass results:', row);

    if (row.tbl_group) {
      const cnt = await client.query('SELECT count(*)::int AS c FROM "group"');
      console.log('"group" exists, count =', cnt.rows[0].c);
    }
    if (row.tbl_groups) {
      const cnt2 = await client.query('SELECT count(*)::int AS c FROM groups');
      console.log('groups exists, count =', cnt2.rows[0].c);
    }

    // show foreign key constraints referencing group table from group_permissions
    const fk = await client.query("SELECT conname, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE contype = 'f' AND conrelid = 'group_permissions'::regclass::oid;");
    console.log('Foreign key constraints on group_permissions (if any):', fk.rows);
  } catch (err) {
    console.error('Inspect failed:', err);
    process.exit(2);
  } finally {
    try { await client.end(); } catch {}
  }
})();
