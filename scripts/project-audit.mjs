#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const scanRoots = [rootDir];
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const ignoredDirectories = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', 'uploads']);
const selfIgnoredFiles = new Set(['scripts/project-audit.mjs', 'scripts/verify-project.mjs']);

function toRelative(filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

function isCodeFile(filePath) {
  return allowedExtensions.has(path.extname(filePath));
}

function isConfigLike(relativePath) {
  return /(^|\/)config(\.[^/]+)?$/.test(relativePath)
    || /(^|\/)config\//.test(relativePath)
    || /(^|\/)drizzle\.config\.[^/]+$/.test(relativePath)
    || /(^|\/)next\.config\.[^/]+$/.test(relativePath)
    || /(^|\/)postcss\.config\.[^/]+$/.test(relativePath)
    || /(^|\/)tailwind\.config\.[^/]+$/.test(relativePath)
    || /(^|\/)vitest\.config\.[^/]+$/.test(relativePath)
    || /(^|\/)eslint\.config\.[^/]+$/.test(relativePath);
}

function isTestLike(relativePath) {
  return /(^|\/)(__tests__|test|tests)(\/|$)/.test(relativePath)
    || /\.test\.[^/]+$/.test(relativePath)
    || /\.spec\.[^/]+$/.test(relativePath);
}

function walk(dirPath, collectedFiles) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, collectedFiles);
      continue;
    }

    if (!isCodeFile(fullPath)) {
      continue;
    }

    collectedFiles.push(fullPath);
  }
}

function createRule(id, severity, matcher, isIgnored = () => false) {
  return { id, severity, matcher, isIgnored };
}

const rules = [
  createRule('eslint-disable', 'medium', /eslint-disable(?:-next-line|-line)?\b/),
  createRule('todo-comment', 'low', /\b(?:TODO|FIXME|HACK)\b/),
  createRule('explicit-any', 'high', /:\s*any\b|\bas\s+any\b/),
  createRule('direct-process-env', 'high', /\bprocess\.env\b/, (relativePath) => isConfigLike(relativePath) || isTestLike(relativePath)),
  createRule('package-imports-apps', 'high', /@silo\/(?:web|api|worker)\b/, (relativePath) => !relativePath.startsWith('packages/')),
  createRule('web-imports-database', 'high', /@silo\/database\b/, (relativePath) => !relativePath.startsWith('apps/web/')),
  createRule('cross-package-relative-import', 'high', /(?:from\s+['"]|import\s+['"])(?:\.\.\/)+(?:apps|packages)\//),
];

const findings = [];
const filesToScan = [];

for (const scanRoot of scanRoots) {
  walk(scanRoot, filesToScan);
}

for (const filePath of filesToScan) {
  const relativePath = toRelative(filePath);
  if (selfIgnoredFiles.has(relativePath)) {
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const rule of rules) {
      if (rule.isIgnored(relativePath)) {
        continue;
      }

      rule.matcher.lastIndex = 0;
      if (!rule.matcher.test(line)) {
        continue;
      }

      findings.push({
        rule: rule.id,
        severity: rule.severity,
        file: relativePath,
        line: index + 1,
        excerpt: line.trim().slice(0, 160),
      });
    }
  }
}

if (findings.length === 0) {
  console.log('Nenhuma irregularidade encontrada no projeto.');
  process.exit(0);
}

const groupedFindings = findings.reduce((groups, finding) => {
  const key = `${finding.severity}:${finding.rule}`;
  if (!groups.has(key)) {
    groups.set(key, []);
  }
  groups.get(key).push(finding);
  return groups;
}, new Map());

console.error(`Irregularidades encontradas: ${findings.length}`);

for (const [groupKey, groupFindings] of groupedFindings) {
  const [severity, rule] = groupKey.split(':');
  console.error(`\n[${severity}] ${rule} (${groupFindings.length})`);
  for (const finding of groupFindings) {
    console.error(`- ${finding.file}:${finding.line} -> ${finding.excerpt}`);
  }
}

process.exit(1);