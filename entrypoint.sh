#!/bin/sh
set -e

echo "\n🚀 Iniciando entrypoint do Silo..."

# Desativar telemetria do Drizzle para limpar logs
export DRIZZLE_TELEMETRY_DISABLED=1

if [ "${NODE_ENV:-production}" = "production" ]; then
  DB_URL="${DATABASE_URL_PROD}"
else
  DB_URL="${DATABASE_URL_DEV}"
fi

echo -e "\n📂 Verificando diretório de uploads..."
if [ -d "/app/uploads" ]; then
    echo "✅ Diretório /app/uploads existe."
else
    echo "⚠️ Diretório /app/uploads não encontrado. Criando..."
    mkdir -p /app/uploads
fi


echo -e "\n⏳ Aguardando banco de dados ficar acessível (via DATABASE_URL)..."
MAX_RETRIES=30
SLEEP_SECS=1
COUNT=0

while :; do
  if DATABASE_URL="$DB_URL" node - <<'NODE'
const { Client } = require('pg');

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL não definida");
    process.exit(2);
  }

  const client = new Client({
    connectionString: url,
    // Em rede Docker interna normalmente é sem SSL:
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
    console.error(e.message || e);
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
    echo "❌ Timeout aguardando banco. Abortando startup."
    exit 1
  fi

  sleep "$SLEEP_SECS"
done

# 1. Executar migrações do banco de dados
echo -e "\n📦 [1/3] Executando migrações do banco de dados..."
# Tenta rodar a migração. Se falhar (ex: banco indisponível), o container reinicia e tenta de novo.
npm run db:migrate

# 2. Executar Seed (população inicial)
echo -e "\n\n🌱 [2/3] Verificando e populando dados iniciais (Seed)..."
# O script de seed é idempotente (verifica se já existem dados antes de criar)
npm run db:seed

# 3. Iniciar a aplicação
echo -e "\n✅ [3/3] Iniciando a aplicação..."

# Se nenhum argumento foi passado (CMD vazio), define o padrão
if [ $# -eq 0 ]; then
    echo "⚠️ Nenhum comando passado. Iniciando padrão: npm run start"
    set -- npm run start
fi

echo -e "\n👉 Executando: $@"
exec "$@"
