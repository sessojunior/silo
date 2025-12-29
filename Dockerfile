# Dockerfile simplificado para Next.js
FROM node:22-alpine

# Atualiza pacotes do Alpine para corrigir vulnerabilidades de segurança
RUN apk update && apk upgrade && rm -rf /var/cache/apk/*

# Define diretório de trabalho
WORKDIR /app

# Copia os arquivos package.json e package-lock.json para o diretório de trabalho /app (.)
COPY package*.json .

# Instala as dependências (ci = clean install) removendo node_modules e instalando as dependências novamente
# Ou poderia usar o npm install, mas o npm ci é mais rápido e seguro
RUN npm ci

# Copia todo o conteúdo do projeto que está no diretório atual (.) para o diretório de trabalho /app (.)
COPY . .

# Build da aplicação
RUN npm run build

# Expõe porta 3000
EXPOSE 3000

# Comando de inicialização (executa como root/admin)
CMD ["npm", "start"]
