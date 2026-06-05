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
    const q = `SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name IN ('group','groups')
ORDER BY table_name, ordinal_position;`;
    const res = await client.query(q);
    console.table(res.rows);
  }catch(err){console.error(err);}finally{await client.end();}
})();
