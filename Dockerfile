# ======================================================
# Dockerfile para aplicação Next.js
# ======================================================

# Imagem base com Node.js (Alpine)
FROM node:22-alpine

# ------------------------------------------------------
# Atualiza pacotes do Alpine para correções de segurança
# ------------------------------------------------------
RUN apk update && apk upgrade && rm -rf /var/cache/apk/*

# ------------------------------------------------------
# Define o diretório de trabalho dentro do container
# ------------------------------------------------------
WORKDIR /app

# ------------------------------------------------------
# Copia apenas os arquivos de dependências
# ------------------------------------------------------
COPY package.json package-lock.json* ./

# ------------------------------------------------------
# Instala dependências de forma limpa e previsível
# npm ci é recomendado para ambientes de produção
# ------------------------------------------------------
RUN npm ci

# ------------------------------------------------------
# Copia todo o restante do código da aplicação
# ------------------------------------------------------
COPY . .

# ------------------------------------------------------
# Define explicitamente o ambiente como produção
# Evita warnings e comportamentos inconsistentes do Next.js
# ------------------------------------------------------
ENV NODE_ENV=production
ENV DRIZZLE_TELEMETRY_DISABLED=1

# ------------------------------------------------------
# Executa o build da aplicação Next.js
# Isso gera a pasta .next necessária para o next start
# ------------------------------------------------------
RUN npm run build
RUN npm prune --omit=dev

# ------------------------------------------------------
# Expõe a porta padrão do Next.js
# ------------------------------------------------------
RUN mkdir -p uploads
EXPOSE 3000

# ------------------------------------------------------
# Configura o Entrypoint para Migrations/Seed automáticos
# ------------------------------------------------------
COPY entrypoint.sh .
# Converte quebras de linha Windows (CRLF) para Linux (LF) e dá permissão de execução
RUN sed -i 's/\r$//' entrypoint.sh && chmod +x entrypoint.sh

# Executa migrações, seed e inicia a aplicação
ENTRYPOINT ["./entrypoint.sh"]

# ------------------------------------------------------
# Comando de inicialização do container
# Usa o servidor de produção do Next.js
# ------------------------------------------------------
CMD ["npm", "run", "start"]
