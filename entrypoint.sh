#!/bin/sh
set -e

echo "\n🚀 Iniciando entrypoint do Silo..."

# Desativar telemetria do Drizzle para limpar logs
export DRIZZLE_TELEMETRY_DISABLED=1

echo -e "\n📂 Verificando diretório de uploads..."
if [ -d "/app/uploads" ]; then
    echo "✅ Diretório /app/uploads existe."
else
    echo "⚠️ Diretório /app/uploads não encontrado. Criando..."
    mkdir -p /app/uploads
fi

# Aguardar o banco de dados estar pronto
echo -e "\n⏳ Aguardando banco de dados (db:5432) entrar no ar..."
MAX_RETRIES=30
COUNT=0
while ! nc -z db 5432; do
  COUNT=$((COUNT+1))
  if [ $COUNT -ge $MAX_RETRIES ]; then
    echo "❌ Timeout aguardando pelo banco de dados. Continuando assim mesmo..."
    break
  fi
  sleep 1
done
echo "✅ Banco de dados detectado!"

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
