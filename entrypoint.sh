#!/bin/sh
set -e

echo "\n🚀 Iniciando entrypoint do Silo..."

echo -e "\n📂 Verificando diretório de uploads..."
if [ -d "/app/uploads" ]; then
    echo "✅ Diretório /app/uploads existe."
else
    echo "⚠️ Diretório /app/uploads não encontrado. Criando..."
    mkdir -p /app/uploads
fi

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
