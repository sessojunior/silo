#!/bin/sh
set -e

echo "🚀 Iniciando entrypoint do Silo API..."

export DRIZZLE_TELEMETRY_DISABLED=1

echo "⏳ Aguardando banco de dados ficar acessível..."
MAX_RETRIES=30
COUNT=0

while :; do
  if node - <<'NODE'
const { Client } = require('pg');
(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
    connectionTimeoutMillis: 3000,
  });
  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    process.exit(0);
  } catch (e) {
    try { await client.end(); } catch {}
    process.exit(1);
  }
})();
NODE
  then
    echo "✅ Banco de dados acessível!"
    break
  fi

  COUNT=$((COUNT+1))
  if [ "$COUNT" -ge "$MAX_RETRIES" ]; then
    echo "❌ Timeout aguardando banco. Abortando."
    exit 1
  fi

  sleep 2
done

echo "📦 Sincronizando schema do banco..."
# drizzle-kit push sincroniza o schema direto, sem depender de journal/migrations.
# Remove a tabela de tracking do migrate antigo (se existir) para evitar o prompt
# interativo de "data-loss" que trava o entrypoint.
node - <<NODE
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: false });
  try {
    await client.connect();
    await client.query('DROP TABLE IF EXISTS __drizzle_migrations CASCADE');
    console.log('✅ Tabela __drizzle_migrations removida (se existia).');
    await client.end();
  } catch (e) {
    try { await client.end(); } catch {}
    console.log('⚠️ Não foi possível remover __drizzle_migrations, continuando...');
  }
})();
NODE
export DRIZZLE_DATABASE_URL="${DATABASE_URL}"
cd /app/packages/db && npx drizzle-kit push --config drizzle.config.ts

echo "🌱 Executando seed (cria usuários iniciais se necessário)..."
npm run db:seed -w @silo/database || echo "⚠️ Seed falhou, mas API subirá mesmo assim."

# Volta para o diretório raiz para que ./node_modules/.bin/tsx funcione
cd /app

echo "✅ Iniciando API..."
if [ $# -eq 0 ]; then
  exec ./node_modules/.bin/tsx apps/api/src/index.ts
else
  exec "$@"
fi
