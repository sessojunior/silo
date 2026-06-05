#!/usr/bin/env node
import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { Client } from 'pg';

// Load .env from repo root (like other scripts)
dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

const dbUrl = process.env.DRIZZLE_DATABASE_URL || process.env.DATABASE_URL_DEV || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('No database URL found in environment (DRIZZLE_DATABASE_URL or DATABASE_URL_DEV or DATABASE_URL)');
  process.exit(2);
}

async function main() {
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    console.log('Connected to DB (host hidden)');

    const cols = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'group_permissions'
        AND column_name IN ('resource_v2','action_v2','id')
      ORDER BY column_name
    `);
    console.log('\nColumns in group_permissions:');
    if (cols.rows.length === 0) console.log('  (no matching columns found)');
    for (const r of cols.rows) console.log('  -', r.column_name, '|', r.data_type, '| default=', r.column_default, '| nullable=', r.is_nullable);

    const uq = await client.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'group_permissions'::regclass
        AND conname = 'unique_group_permission_v2'
      LIMIT 1
    `);
    console.log('\nUnique constraint `unique_group_permission_v2` present:', uq.rowCount > 0);

    const idx = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'group_permissions' AND indexname IN ('idx_group_permission_resource_v2','idx_group_permission_group_id_v2')
    `);
    console.log('Indexes present: ', idx.rows.map(r => r.indexname));

    // Check id default
    const idDef = await client.query(`
      SELECT column_default
      FROM information_schema.columns
      WHERE table_name = 'group_permissions' AND column_name = 'id'
      LIMIT 1
    `);
    console.log('\n`id` default:', idDef.rows[0]?.column_default ?? '(none)');

    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('Error checking migration status:', err);
    try { await client.end(); } catch (e) {}
    process.exit(1);
  }
}

main();
