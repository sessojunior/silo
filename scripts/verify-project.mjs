#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const rootDir = process.cwd();
const useShell = process.platform === 'win32';
function runStep(name, command, args, shell = useShell) {
  console.log(`\n==> ${name}`);
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
    shell,
  });

  if (result.error) {
    console.error(`Falha ao executar ${name}:`, result.error.message);
    return false;
  }

  if (result.status !== 0) {
    console.error(`Etapa ${name} terminou com código ${result.status ?? 'desconhecido'}.`);
    return false;
  }

  return true;
}

const steps = [
  ['lint', 'npm', ['run', 'lint']],
  ['typecheck', 'npm', ['run', 'typecheck']],
  ['test', 'npm', ['run', 'test']],
  ['build', 'npm', ['run', 'build']],
  ['legacy permissions', process.execPath, [path.join('scripts', 'check-no-legacy-permissions.mjs')], false],
];

const failures = [];

for (const [name, command, args, shell] of steps) {
  const success = runStep(name, command, args, shell);
  if (!success) {
    failures.push(name);
  }
}

if (failures.length > 0) {
  console.error('\nVerificação concluída com falhas nas etapas:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('\nVerificação completa sem falhas.');