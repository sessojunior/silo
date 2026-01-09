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

# ------------------------------------------------------
# Executa o build da aplicação Next.js
# Isso gera a pasta .next necessária para o next start
# ------------------------------------------------------
RUN npm run build

# ------------------------------------------------------
# Expõe a porta padrão do Next.js
# ------------------------------------------------------
EXPOSE 3000

# ------------------------------------------------------
# Comando de inicialização do container
# Usa o servidor de produção do Next.js
# ------------------------------------------------------
CMD ["npm", "run", "start"]
