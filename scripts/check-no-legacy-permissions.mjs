#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const exts = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md']);
const resources = ['products', 'projects', 'groups', 'users', 'reports', 'chat'];
const actions = ['list', 'create', 'update', 'delete'];

const found = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.git', '.github', 'dist', 'build'].includes(e.name)) continue;
      walk(full);
      continue;
    }
    if (!exts.has(path.extname(e.name))) continue;
    if (full.includes('scripts' + path.sep + 'check-no-legacy-permissions.mjs')) continue;
    let content = '';
    try { content = fs.readFileSync(full, 'utf8'); } catch (err) { continue; }

    for (const r of resources) {
      for (const a of actions) {
        const token = `${r}:${a}`;
        if (content.includes(token)) found.push({ file: full, match: token });
      }
    }

    for (const a of actions) {
      const actionPattern = new RegExp(`["']action["']\s*[:=]\s*["']${a}["']`, 'g');
      if (actionPattern.test(content)) found.push({ file: full, match: `action:${a}` });
    }
  }
}

walk(root);

if (found.length > 0) {
  console.error('Legacy permission tokens found:');
  for (const f of found) console.error(`${f.file} → ${f.match}`);
  process.exit(2);
}

console.log('No legacy permission tokens found.');
process.exit(0);
