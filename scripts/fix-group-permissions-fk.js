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
    console.log('Altering FK on group_permissions to reference "group"...');
    const sql = `BEGIN;
ALTER TABLE group_permissions DROP CONSTRAINT IF EXISTS group_permissions_group_id_fkey;
ALTER TABLE group_permissions ADD CONSTRAINT group_permissions_group_id_fkey FOREIGN KEY (group_id) REFERENCES "group"(id) ON DELETE CASCADE;
COMMIT;`;
    await client.query(sql);
    console.log('FK updated successfully');
  }catch(err){console.error('FK update failed:', err); try{await client.query('ROLLBACK;')}catch(e){}; process.exit(2);}finally{await client.end();}
})();
