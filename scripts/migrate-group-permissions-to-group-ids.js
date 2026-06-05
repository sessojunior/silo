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
    console.log('Dropping existing FK constraint (if any)...');
    await client.query('ALTER TABLE group_permissions DROP CONSTRAINT IF EXISTS group_permissions_group_id_fkey;');

    console.log('Updating group_permissions.group_id by matching names between groups and "group"...');
    const updateSql = `UPDATE group_permissions gp
SET group_id = g2.id
FROM groups g1
JOIN "group" g2 ON g1.name = g2.name
WHERE gp.group_id = g1.id;`;
    const res = await client.query(updateSql);
    console.log('Update result:', res.rowCount);

    console.log('Adding new FK constraint referencing "group"...');
    await client.query('ALTER TABLE group_permissions ADD CONSTRAINT group_permissions_group_id_fkey FOREIGN KEY (group_id) REFERENCES "group"(id) ON DELETE CASCADE;');

    console.log('Migration of group_permissions group_id values completed successfully.');
  }catch(err){
    console.error('Migration failed:', err);
    try{ await client.query('ROLLBACK;') } catch(e){}
    process.exit(2);
  }finally{ await client.end(); }
})();
