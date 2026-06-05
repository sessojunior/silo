const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
const connectionString = process.env.DATABASE_URL_DEV || process.env.DATABASE_URL || process.env.DATABASE_URL_PROD;
if (!connectionString) { console.error('No connection string'); process.exit(1); }
const shouldUseSsl = (cs) => cs && (cs.toLowerCase().includes('sslmode=require') || cs.toLowerCase().includes('neon.tech') || cs.toLowerCase().includes('sslmode=verify-full'));
const client = new Client({ connectionString, ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined });

(async ()=>{
  try{
    await client.connect();
    console.log('Copying missing rows from "group" to groups...');
    const sql = `BEGIN;
INSERT INTO groups (id, name, description, icon, color, role, active, is_default, created_at, updated_at)
SELECT id, name, description, icon, color, role, active, is_default, created_at, updated_at
FROM "group" g
WHERE NOT EXISTS (SELECT 1 FROM groups WHERE id = g.id);
COMMIT;`;
    const res = await client.query(sql);
    console.log('Copy executed, result:', res && typeof res.rowCount !== 'undefined' ? `rowCount=${res.rowCount}` : 'ok');
  }catch(err){
    console.error('Copy failed:', err);
    try { await client.query('ROLLBACK;'); } catch(e){}
    process.exit(2);
  }finally{ await client.end(); }
})();
