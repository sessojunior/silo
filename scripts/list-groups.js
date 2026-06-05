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
    const r1 = await client.query('SELECT id, name FROM "group" ORDER BY name');
    console.log('\n"group" rows:');
    console.table(r1.rows);
    const r2 = await client.query('SELECT id, name FROM groups ORDER BY name');
    console.log('\ngroups rows:');
    console.table(r2.rows);
  }catch(err){console.error(err);}finally{await client.end();}
})();
