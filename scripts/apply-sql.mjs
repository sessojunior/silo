#!/usr/bin/env node
import fs from 'fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/apply-sql.mjs <path-to-sql-file>');
    process.exit(2);
  }
  const sqlPath = resolve(process.cwd(), file);
  if (!fs.existsSync(sqlPath)) {
    console.error('SQL file not found:', sqlPath);
    process.exit(2);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  const dbUrl = process.env.DRIZZLE_DATABASE_URL || process.env.DATABASE_URL_DEV || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('No database URL found in environment (DRIZZLE_DATABASE_URL or DATABASE_URL_DEV or DATABASE_URL)');
    process.exit(2);
  }

  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    console.log('Connected to DB, executing:', sqlPath);
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('SQL executed successfully.');
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('SQL execution failed:', err);
    try { await client.query('ROLLBACK'); } catch (e) {}
    try { await client.end(); } catch (e) {}
    process.exit(1);
  }
}

main();
