const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
const connectionString = process.env.DATABASE_URL_DEV || process.env.DATABASE_URL || process.env.DATABASE_URL_PROD;
if (!connectionString) { console.error('No connection string'); process.exit(1); }
const shouldUseSsl = (cs) => cs && (cs.toLowerCase().includes('sslmode=require') || cs.toLowerCase().includes('neon.tech') || cs.toLowerCase().includes('sslmode=verify-full'));
const client = new Client({ connectionString, ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined });
const groupId = process.argv[2] || 'e3df07a9-c414-43e2-97d6-9f70947bbe62';

(async ()=>{
  try{
    await client.connect();
    console.log('Checking group id', groupId);
    const r1 = await client.query('SELECT id, name, role FROM "group" WHERE id = $1', [groupId]);
    console.log('"group" row:', r1.rows);
    const r2 = await client.query('SELECT id, name, role FROM groups WHERE id = $1', [groupId]);
    console.log('groups row:', r2.rows);

    const ug = await client.query('SELECT * FROM user_group WHERE group_id = $1 LIMIT 5', [groupId]);
    console.log('user_group rows (sample):', ug.rows.slice(0,5));

    const gp = await client.query('SELECT * FROM group_permissions WHERE group_id = $1 LIMIT 5', [groupId]);
    console.log('group_permissions rows (sample):', gp.rows.slice(0,5));
  }catch(err){console.error('ERR', err);}finally{ await client.end(); }
})();
